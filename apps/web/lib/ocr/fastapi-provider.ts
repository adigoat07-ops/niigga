import { OcrProvider, OcrExtractionResult } from "./types";

export class FastApiTesseractProvider implements OcrProvider {
  name = "fastapi-tesseract";

  async extract(file: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    reportTitle?: string;
  }): Promise<OcrExtractionResult> {
    const fastApiUrl = process.env.FASTAPI_URL || "http://localhost:8000";

    const uploadBody = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimeType });
    uploadBody.append("file", blob, file.filename);
    uploadBody.append("reportTitle", file.reportTitle || "Lab report");

    const response = await fetch(`${fastApiUrl}/ocr`, {
      method: "POST",
      body: uploadBody,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "OCR processing failed.");
    }

    return {
      success: true,
      filename: payload.filename || file.filename,
      text: payload.text || "",
      results: payload.results || [],
      provider: this.name,
    };
  }
}
