import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getOcrProvider, ExtractedResultItem } from "@/lib/ocr";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to upload and save reports." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const reportTitle = String(formData.get("reportTitle") || "Lab report").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, JPG, and PNG are supported." },
        { status: 400 }
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 15MB limit." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Persist uploaded file to storage (local uploads folder)
    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${Date.now()}-${safeName}`;
    const fullStoragePath = path.join(uploadsDir, uniqueFileName);
    await fs.writeFile(fullStoragePath, buffer);
    const relativeStoragePath = path.join("uploads", uniqueFileName).replace(/\\/g, "/");

    // 2. Persist report and file metadata to PostgreSQL via Prisma
    const report = await prisma.$transaction(async (tx) => {
      const createdReport = await tx.labReport.create({
        data: {
          title: reportTitle || "Lab report",
          status: "uploaded",
          userId: session.userId,
        },
      });

      await tx.uploadedFile.create({
        data: {
          fileName: uniqueFileName,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          storagePath: relativeStoragePath,
          userId: session.userId,
          reportId: createdReport.id,
        },
      });

      return createdReport;
    });

    // 3. Attempt OCR extraction if service is configured/reachable
    let extractedText = "";
    let results: ExtractedResultItem[] = [];
    let ocrProviderName: string | null = null;
    let ocrWarning: string | null = null;

    try {
      const ocrProvider = getOcrProvider();
      ocrProviderName = ocrProvider.name;
      const ocrResult = await ocrProvider.extract({
        buffer,
        filename: file.name,
        mimeType: file.type,
        reportTitle,
      });

      extractedText = ocrResult.text || "";
      results = ocrResult.results || [];

      if (results.length > 0) {
        await prisma.extractedLabResult.createMany({
          data: results.map((res: ExtractedResultItem) => ({
            reportId: report.id,
            testName: res.testName || "Unknown Test",
            resultValue: res.resultValue !== null && res.resultValue !== undefined ? String(res.resultValue) : null,
            unit: res.unit || null,
            referenceRange: res.referenceRange || null,
            flag: res.flag || "unclear",
            confidence: typeof res.confidence === "number" ? res.confidence : 0.75,
            rawText: res.rawText || null,
          })),
        });
      }

      await prisma.labReport.update({
        where: { id: report.id },
        data: { status: "completed" },
      });
    } catch (ocrErr) {
      console.warn("OCR service unavailable or failed during upload:", ocrErr instanceof Error ? ocrErr.message : ocrErr);
      ocrWarning = "File uploaded and saved securely. OCR extraction was skipped or service is currently offline.";
    }

    return NextResponse.json({
      success: true,
      reportId: report.id,
      filename: file.name,
      storedPath: relativeStoragePath,
      extractedText,
      results,
      provider: ocrProviderName,
      warning: ocrWarning,
      status: results.length > 0 ? "completed" : "uploaded",
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unexpected upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
