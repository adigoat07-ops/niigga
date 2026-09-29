export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  createdAt: Date | string;
}

export interface UploadedFileMetadata {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  userId: string;
  reportId: string;
  createdAt: Date | string;
}

export interface ExtractedResultItem {
  testName: string;
  resultValue?: string | number | null;
  unit?: string | null;
  referenceRange?: string | null;
  flag?: "normal" | "low" | "high" | "unclear" | string;
  confidence?: number;
  rawText?: string | null;
}

export interface LabReportDetail {
  id: string;
  title: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  userId: string;
  familyMemberId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  uploadedFile?: UploadedFileMetadata | null;
  extractedResults?: ExtractedResultItem[];
}
