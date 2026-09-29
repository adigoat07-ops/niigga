import { OcrProvider } from "./types";
import { FastApiTesseractProvider } from "./fastapi-provider";
import { GoogleVisionProvider } from "./google-vision-provider";

export * from "./types";

export function getOcrProvider(): OcrProvider {
  const provider = process.env.OCR_PROVIDER?.toLowerCase();
  if (provider === "google_vision" || provider === "google-vision") {
    return new GoogleVisionProvider();
  }
  return new FastApiTesseractProvider();
}
