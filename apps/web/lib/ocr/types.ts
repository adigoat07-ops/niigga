export interface ExtractedResultItem {
  testName: string;
  resultValue: string | null;
  unit: string | null;
  referenceRange: string | null;
  flag: string;
  confidence?: number | null;
  rawText?: string | null;
}

export interface OcrExtractionResult {
  success: boolean;
  filename: string;
  text: string;
  results: ExtractedResultItem[];
  provider: string;
}

export interface OcrProvider {
  name: string;
  extract(file: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    reportTitle?: string;
  }): Promise<OcrExtractionResult>;
}
