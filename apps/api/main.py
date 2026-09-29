from __future__ import annotations

import io
import os
import re
import shutil
from typing import Any

import fitz
import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, ImageFilter

TESSERACT_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    shutil.which("tesseract"),
]

TESSERACT_PATH = next((path for path in TESSERACT_CANDIDATES if path and os.path.exists(path)), None)
if TESSERACT_PATH:
    os.environ["PATH"] = os.path.dirname(TESSERACT_PATH) + os.pathsep + os.environ.get("PATH", "")
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
else:
    raise RuntimeError("Tesseract OCR is not installed or not found in the expected Windows install locations.")

app = FastAPI(title="LAB SAATHI OCR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "lab-saathi-ocr"}


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_text_from_image(image_bytes: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.grayscale(image)
        image = ImageOps.autocontrast(image)
        image = image.filter(ImageFilter.SHARPEN)
        text = pytesseract.image_to_string(image, config="--psm 6")
        if not text.strip():
            text = pytesseract.image_to_string(image)
        return text
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image OCR failed: {exc}") from exc


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages: list[str] = []
        for page in doc:
            # 1. First check if text is directly embedded in the PDF
            direct_text = page.get_text()
            if direct_text and len(direct_text.strip()) > 50:
                pages.append(direct_text)
                continue

            # 2. Otherwise run high-resolution OCR
            pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5))
            image = Image.open(io.BytesIO(pix.tobytes("png")))
            image = ImageOps.grayscale(image)
            image = ImageOps.autocontrast(image)
            text = pytesseract.image_to_string(image, config="--psm 6")
            if not text.strip():
                text = pytesseract.image_to_string(image)
            pages.append(text)
        return "\n".join(pages)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF OCR failed: {exc}") from exc


# Non-medical header / demographic lines to completely exclude
# Metadata patterns are intentionally specific so they do NOT match medical test lines.
# The key discipline: NEVER use words that appear in test names (total, count, ratio, etc.)
# Match only clear admin/demographic context clues.
METADATA_PATTERNS = [
    # Patient header fields — must have a colon or label prefix
    r"^\s*(patient'?s?\s*name|pt\.?\s*name)\s*:",
    r"^\s*(age|gender|sex)\s*[:/]",
    r"^\s*(dob|date\s*of\s*birth)\s*:",
    r"^\s*(uhid|mrn|reg\.?\s*no|reg\.?\s*date|regn\.?|ipd\s*no|opd\s*no|barcode)\s*:",
    r"^\s*(date|time|collected\s*(on|at)?|drawn|received|reported|printed)\s*:",
    r"^\s*(dr\.?|doctor|consultant|physician|referred\s*by|ref\.?\s*by)\s*:",
    r"^\s*(hospital|clinic|diagnostics?|laboratory|centre|center)\s*$",
    r"^\s*(address|street|city|state|road|email|phone|mobile|contact|tel|pin)\s*:",
    # Pure demographic values (standalone lines, no numerics that look like test results)
    r"^\s*(male|female|transgender|others?)\s*$",
    # Footer / admin
    r"^\s*(page\s*\d+|end\s*of\s*report|sheet\s*\d+)\s*$",
    r"^\s*(signature|verified\s*by|authorized\s*by|technician|pathologist|biochemist)\b",
    r"^\s*(nabl|iso|accredited|disclaimer|accuracy\s*note|terms\s*and\s*conditions)\b",
    # Bill / financial
    r"^\s*(bill\s*no|invoice|amount|total\s*amount|rupees|rs\.?\s*\d|paid|balance\s*due)\b",
]

COMPILED_METADATA = [re.compile(p, re.IGNORECASE | re.MULTILINE) for p in METADATA_PATTERNS]

# Knowledge base of clinical lab tests with alias regexes and standard reference ranges
KNOWN_MEDICAL_TESTS = [
    ("Hemoglobin (Hb)", r"\b(hemoglobin|haemoglobin|hb)\b", "12.0 - 17.5", "g/dL"),
    ("Total RBC Count", r"\b(total\s*rbc|rbc\s*count|red\s*blood\s*cells?)\b", "4.0 - 6.0", "mil/uL"),
    ("Total WBC Count (TLC)", r"\b(total\s*wbc|wbc\s*count|white\s*blood\s*cells?|total\s*leukocyte|tlc)\b", "4000 - 11000", "/cumm"),
    ("Platelet Count", r"\b(platelets?|platelet\s*count|thrombocytes?)\b", "150000 - 450000", "/cumm"),
    ("Hematocrit (PCV)", r"\b(hematocrit|haematocrit|pcv|packed\s*cell\s*volume)\b", "36.0 - 50.0", "%"),
    ("MCV", r"\b(mcv|mean\s*corpuscular\s*volume)\b", "80.0 - 100.0", "fL"),
    ("MCH", r"\b(mch|mean\s*corpuscular\s*hemoglobin)\b", "27.0 - 33.0", "pg"),
    ("MCHC", r"\b(mchc|mean\s*corpuscular\s*hemoglobin\s*concentration)\b", "32.0 - 36.0", "g/dL"),
    ("RDW", r"\b(rdw|red\s*cell\s*distribution\s*width)\b", "11.5 - 15.0", "%"),
    ("Neutrophils", r"\b(neutrophils?|polymorphs?|polys?)\b", "40.0 - 75.0", "%"),
    ("Lymphocytes", r"\b(lymphocytes?|lymphs?)\b", "20.0 - 45.0", "%"),
    ("Monocytes", r"\b(monocytes?)\b", "2.0 - 10.0", "%"),
    ("Eosinophils", r"\b(eosinophils?|eos)\b", "1.0 - 6.0", "%"),
    ("Basophils", r"\b(basophils?)\b", "0.0 - 2.0", "%"),
    ("ESR", r"\b(esr|erythrocyte\s*sedimentation\s*rate)\b", "0 - 20", "mm/hr"),
    ("Fasting Blood Sugar (FBS)", r"\b(fasting\s*blood\s*sugar|fbs|fasting\s*glucose|glucose\s*fasting)\b", "70 - 100", "mg/dL"),
    ("Post Prandial Sugar (PPBS)", r"\b(post\s*prandial\s*blood\s*sugar|ppbs|pp\s*glucose|glucose\s*pp)\b", "< 140", "mg/dL"),
    ("Random Blood Sugar (RBS)", r"\b(random\s*blood\s*sugar|rbs|random\s*glucose|glucose\s*random)\b", "70 - 140", "mg/dL"),
    ("HbA1c", r"\b(hba1c|glycated\s*hemoglobin|glycosylated\s*hemoglobin)\b", "4.0 - 5.6", "%"),
    ("Serum Creatinine", r"\b(serum\s*creatinine|creatinine)\b", "0.6 - 1.2", "mg/dL"),
    ("Blood Urea", r"\b(blood\s*urea|urea)\b", "15.0 - 45.0", "mg/dL"),
    ("BUN", r"\b(bun|blood\s*urea\s*nitrogen)\b", "7.0 - 20.0", "mg/dL"),
    ("Serum Uric Acid", r"\b(serum\s*uric\s*acid|uric\s*acid)\b", "3.5 - 7.2", "mg/dL"),
    ("Total Bilirubin", r"\b(total\s*bilirubin|bilirubin\s*total)\b", "0.2 - 1.2", "mg/dL"),
    ("Direct Bilirubin", r"\b(direct\s*bilirubin|conjugated\s*bilirubin)\b", "0.0 - 0.3", "mg/dL"),
    ("Indirect Bilirubin", r"\b(indirect\s*bilirubin|unconjugated\s*bilirubin)\b", "0.1 - 0.9", "mg/dL"),
    ("SGOT / AST", r"\b(sgot|ast|aspartate\s*aminotransferase)\b", "< 40", "U/L"),
    ("SGPT / ALT", r"\b(sgpt|alt|alanine\s*aminotransferase)\b", "< 40", "U/L"),
    ("Alkaline Phosphatase (ALP)", r"\b(alkaline\s*phosphatase|alp)\b", "44 - 147", "U/L"),
    ("Total Protein", r"\b(total\s*protein|protein\s*total)\b", "6.0 - 8.3", "g/dL"),
    ("Serum Albumin", r"\b(serum\s*albumin|albumin)\b", "3.5 - 5.2", "g/dL"),
    ("Serum Globulin", r"\b(serum\s*globulin|globulin)\b", "2.0 - 3.5", "g/dL"),
    ("A/G Ratio", r"\b(a/g\s*ratio|albumin\s*globulin\s*ratio)\b", "1.1 - 2.2", ""),
    ("Total Cholesterol", r"\b(total\s*cholesterol|cholesterol\s*total)\b", "< 200", "mg/dL"),
    ("Triglycerides", r"\b(triglycerides?|tg)\b", "< 150", "mg/dL"),
    ("HDL Cholesterol", r"\b(hdl|hdl\s*cholesterol)\b", "> 40", "mg/dL"),
    ("LDL Cholesterol", r"\b(ldl|ldl\s*cholesterol)\b", "< 100", "mg/dL"),
    ("VLDL Cholesterol", r"\b(vldl|vldl\s*cholesterol)\b", "< 30", "mg/dL"),
    ("TSH", r"\b(tsh|thyroid\s*stimulating\s*hormone)\b", "0.4 - 4.5", "uIU/mL"),
    ("Total T3", r"\b(total\s*t3|t3\s*total|triiodothyronine)\b", "0.8 - 2.0", "ng/mL"),
    ("Total T4", r"\b(total\s*t4|t4\s*total|thyroxine)\b", "5.1 - 14.1", "ug/dL"),
    ("Free T3 (FT3)", r"\b(free\s*t3|ft3)\b", "2.0 - 4.4", "pg/mL"),
    ("Free T4 (FT4)", r"\b(free\s*t4|ft4)\b", "0.9 - 1.7", "ng/dL"),
    ("Vitamin D (25-OH)", r"\b(vitamin\s*d|25-?oh\s*vitamin\s*d)\b", "30.0 - 100.0", "ng/mL"),
    ("Vitamin B12", r"\b(vitamin\s*b12|b12|cyanocobalamin)\b", "200 - 900", "pg/mL"),
    ("Serum Calcium", r"\b(serum\s*calcium|calcium)\b", "8.5 - 10.5", "mg/dL"),
    ("Serum Sodium", r"\b(serum\s*sodium|sodium|na\+?)\b", "136 - 145", "mmol/L"),
    ("Serum Potassium", r"\b(serum\s*potassium|potassium|k\+?)\b", "3.5 - 5.1", "mmol/L"),
    ("Serum Chloride", r"\b(serum\s*chloride|chloride|cl-?)\b", "96 - 106", "mmol/L"),
    ("CRP", r"\b(crp|c-?reactive\s*protein)\b", "< 6.0", "mg/L"),
]


def is_metadata_line(line: str) -> bool:
    for pattern in COMPILED_METADATA:
        if pattern.search(line):
            return True
    return False


def parse_reference_range(ref_str: str) -> tuple[float | None, float | None]:
    clean = ref_str.strip().replace("–", "-").replace("—", "-").replace("to", "-")

    # 1. Dual range: 12.0 - 16.0 or 70 - 100
    m_dual = re.search(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)", clean)
    if m_dual:
        return float(m_dual.group(1)), float(m_dual.group(2))

    # 2. Upper bound only: < 200 or <= 200 or Up to 200
    m_up = re.search(r"(?:<|<=|less\s*than|up\s*to)\s*(\d+(?:\.\d+)?)", clean, re.IGNORECASE)
    if m_up:
        return None, float(m_up.group(1))

    # 3. Lower bound only: > 40 or >= 40 or Above 40
    m_low = re.search(r"(?:>|>=|more\s*than|above)\s*(\d+(?:\.\d+)?)", clean, re.IGNORECASE)
    if m_low:
        return float(m_low.group(1)), None

    return None, None


def detect_range(value: float, reference_range: str | None) -> str:
    if not reference_range:
        return "unclear"

    low, high = parse_reference_range(reference_range)
    if low is None and high is None:
        return "unclear"

    if low is not None and value < low:
        return "low"
    if high is not None and value > high:
        return "high"
    return "normal"



def is_numeric_value(s: str) -> bool:
    """Return True if string looks like a standalone lab result number."""
    s = s.strip()
    return bool(re.match(r"^-?\d+(?:\.\d+)?$", s))


def is_unit_string(s: str) -> bool:
    """Return True if string looks like a lab unit."""
    s = s.strip()
    return bool(re.match(
        r"^(mg/dL|g/dL|mmol/L|mmol/l|IU/L|U/L|fL|pg/mL|pg|ng/mL|ug/dL|mcg/dL|"
        r"%|/cumm|K/uL|x10\^3/uL|mil/uL|uIU/mL|mL/min|mm/hr|mmHg|mEq/L|g/L|"
        r"nmol/L|pmol/L|mcIU/mL|ng/dL|ug/L|mg/L|seconds?|ratio|cells/uL)$",
        s, re.IGNORECASE
    ))


def is_range_string(s: str) -> bool:
    """Return True if string looks like a reference range."""
    s = s.strip()
    return bool(re.match(
        r"^(?:\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?|[<>]=?\s*\d+(?:\.\d+)?).*$",
        s, re.IGNORECASE
    ))


def match_known_test(name: str) -> tuple[str, str, str] | None:
    """Try to match a line to a known medical test. Returns (canonical_name, default_range, default_unit) or None."""
    name_clean = name.strip().lower()
    for canonical, regex, def_range, def_unit in KNOWN_MEDICAL_TESTS:
        if re.search(regex, name_clean, re.IGNORECASE):
            return (canonical, def_range, def_unit)
    return None


def parse_multiline_results(lines: list[str]) -> list[dict[str, Any]]:
    """
    Handle PDFs where each column is on its own line:
        Haemoglobin     <- test name
        11.3            <- result value
        g/dL            <- unit
        12.0 - 15.0     <- reference range
    """
    parsed: list[dict[str, Any]] = []
    seen: set[str] = set()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or is_metadata_line(line):
            i += 1
            continue

        # Try to match a test name
        test_match = match_known_test(line)

        if test_match:
            canonical, def_range, def_unit = test_match
            if canonical in seen:
                i += 1
                continue

            result_value: str | None = None
            unit: str = def_unit
            ref_range: str = def_range

            # Look ahead up to 4 lines for value, unit, range
            lookahead = lines[i + 1 : i + 5]
            consumed = 0
            for j, next_line in enumerate(lookahead):
                nl = next_line.strip()
                if not nl or is_metadata_line(nl):
                    consumed = j + 1
                    continue
                if result_value is None and is_numeric_value(nl):
                    result_value = nl
                    consumed = j + 1
                    continue
                if result_value is not None and is_unit_string(nl):
                    unit = nl
                    consumed = j + 1
                    continue
                if result_value is not None and is_range_string(nl):
                    ref_range = nl
                    consumed = j + 1
                    break
                # If we hit another test name or non-relevant line, stop
                if match_known_test(nl) is not None or (not is_numeric_value(nl) and not is_unit_string(nl) and not is_range_string(nl)):
                    break

            if result_value is None:
                i += 1
                continue

            try:
                val_float = float(result_value)
                flag = detect_range(val_float, ref_range)
            except ValueError:
                i += 1
                continue

            seen.add(canonical)
            parsed.append({
                "testName": canonical,
                "resultValue": result_value,
                "unit": unit,
                "referenceRange": ref_range,
                "flag": flag,
                "confidence": 0.95,
                "rawText": line,
            })
            i += consumed + 1
        else:
            i += 1

    return parsed


def parse_lab_results(raw_text: str) -> list[dict[str, Any]]:
    lines = [normalize_whitespace(line) for line in raw_text.splitlines() if line.strip()]

    # --- Strategy 1: Single-line format ---
    # e.g.  "Hemoglobin    10.2    12.0-16.0    g/dL"
    single_line_results = _parse_single_line(lines)

    # --- Strategy 2: Multi-line column format ---
    # e.g.  each field on its own line
    multiline_results = parse_multiline_results(lines)

    # Merge: prefer whichever found more results, deduplicate by test name
    seen: set[str] = set()
    final: list[dict[str, Any]] = []
    primary = single_line_results if len(single_line_results) >= len(multiline_results) else multiline_results
    secondary = multiline_results if primary is single_line_results else single_line_results

    for r in primary + secondary:
        if r["testName"] not in seen:
            seen.add(r["testName"])
            final.append(r)

    return final[:50]


def _parse_single_line(lines: list[str]) -> list[dict[str, Any]]:
    """Original single-line parser for formats like: Hemoglobin 10.2 12.0-16.0 g/dL"""
    parsed: list[dict[str, Any]] = []
    seen_tests: set[str] = set()

    for line in lines:
        if not re.search(r"\d", line):
            continue
        if is_metadata_line(line):
            continue

        # 1. Check known medical test whitelist
        matched_test = None
        for name, regex, def_range, def_unit in KNOWN_MEDICAL_TESTS:
            if re.search(regex, line, re.IGNORECASE):
                matched_test = (name, def_range, def_unit)
                break

        if matched_test:
            test_name, def_range, def_unit = matched_test
            if test_name in seen_tests:
                continue

            range_match = re.search(
                r"(?:<|<=|>|>=)?\s*\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?|(?:\b(?:<|<=|>|>=|up\s*to|less\s*than)\s*\d+(?:\.\d+)?)",
                line,
                re.IGNORECASE,
            )
            ref_range = range_match.group(0).strip() if range_match else def_range

            unit_match = re.search(
                r"\b(mg/dL|g/dL|mmol/L|mmol/l|IU/L|U/L|fL|pg/mL|pg|ng/mL|ug/dL|mcg/dL|%|/cumm|K/uL|x10\^3/uL|mil/uL|uIU/mL|mL/min|mm/hr)\b",
                line,
                re.IGNORECASE,
            )
            unit = unit_match.group(0) if unit_match else def_unit

            numbers = re.findall(r"\b\d+(?:\.\d+)?\b", line)
            if not numbers:
                continue

            result_val = numbers[0]
            try:
                val_float = float(result_val)
                flag = detect_range(val_float, ref_range)
            except ValueError:
                flag = "unclear"

            seen_tests.add(test_name)
            parsed.append({
                "testName": test_name,
                "resultValue": result_val,
                "unit": unit,
                "referenceRange": ref_range,
                "flag": flag,
                "confidence": 0.95,
                "rawText": line,
            })
            continue

        # 2. Generic medical match: must have unit or range to qualify
        generic_match = re.search(
            r"(?P<test>[A-Za-z][A-Za-z0-9 /().,-]{2,60})\s+(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>mg/dL|g/dL|mmol/L|IU/L|U/L|fL|pg|ng/mL|%|/cumm|K/uL|x10\^3/uL|uIU/mL|mL/min|mm/hr)?\s*(?:(?P<range>\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?)|(?P<range_alt>[<>]=?\s*\d+(?:\.\d+)?))?",
            line,
            re.IGNORECASE,
        )

        if generic_match:
            g_test = generic_match.group("test").strip(" ,;:-")
            g_val = generic_match.group("value")
            g_unit = generic_match.group("unit") or ""
            g_range = generic_match.group("range") or generic_match.group("range_alt") or ""

            if (g_unit or g_range) and g_test not in seen_tests and not is_metadata_line(g_test):
                try:
                    val_float = float(g_val)
                    flag = detect_range(val_float, g_range) if g_range else "unclear"
                except ValueError:
                    flag = "unclear"

                seen_tests.add(g_test)
                parsed.append({
                    "testName": g_test,
                    "resultValue": g_val,
                    "unit": g_unit,
                    "referenceRange": g_range or "Unclear",
                    "flag": flag,
                    "confidence": 0.80,
                    "rawText": line,
                })

    return parsed



@app.post("/ocr")
async def ocr_report(file: UploadFile = File(...)) -> dict[str, Any]:
    if file is None:
        raise HTTPException(status_code=400, detail="A file is required")

    content_type = file.content_type or ""
    allowed_types = {"application/pdf", "image/png", "image/jpeg"}
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF, JPG, and PNG files are supported")

    raw_bytes = await file.read()

    if getattr(file, "filename", None) is None or not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    if len(raw_bytes) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 15MB limit")

    try:
        if content_type == "application/pdf":
            extracted_text = extract_text_from_pdf(raw_bytes)
        else:
            extracted_text = extract_text_from_image(raw_bytes)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {exc}") from exc

    results = parse_lab_results(extracted_text)

    return {
        "success": True,
        "filename": file.filename,
        "text": extracted_text,
        "results": results,
    }
