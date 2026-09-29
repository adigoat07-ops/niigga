import { OcrProvider, OcrExtractionResult } from "./types";

/**
 * Google Cloud Vision Provider stub.
 * Pluggable replacement for Tesseract OCR without breaking the app contract.
 */
export class GoogleVisionProvider implements OcrProvider {
  name = "google-vision";

  async extract(file: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    reportTitle?: string;
  }): Promise<OcrExtractionResult> {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Google Vision provider selected, but GOOGLE_VISION_API_KEY is not configured in environment variables."
      );
    }

    // Google Cloud Vision Images:annotate REST API integration
    const base64Content = file.buffer.toString("base64");
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Content },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Google Vision API request failed.");
    }

    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || "";

    return {
      success: true,
      filename: file.filename,
      text: fullText,
      results: [],
      provider: this.name,
    };
  }
}
