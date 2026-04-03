export type VendorPhase =
  | "workspace_pending"
  | "collecting_documents"
  | "under_review"
  | "signature_pending"
  | "completed";

export type DocumentStatus =
  | "requested"
  | "uploaded"
  | "under_review"
  | "approved"
  | "rejected"
  | "signed"
  | "missing";

export type VendorDocumentType =
  | "w9"
  | "certificate_of_insurance"
  | "security_questionnaire"
  | "nda";

export interface VendorDocument {
  id: string;
  name: string;
  type: VendorDocumentType;
  status: DocumentStatus;
  required: boolean;
  source: "box" | "demo";
  boxFileId?: string;
  uploadedAt?: string;
  reviewer?: string;
  notes?: string;
}

export interface VendorWorkspace {
  id: string;
  vendorId: string;
  vendorName: string;
  rootFolderId: string;
  subfolders: Array<{
    name: string;
    folderId: string;
  }>;
  fileRequestId?: string;
  fileRequestUrl?: string;
  collaborationCount: number;
  createdAt: string;
  source: "box" | "demo";
}

export interface VendorActivity {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  actor: string;
  source: "box" | "copilot" | "demo";
}

export interface VendorRecord {
  id: string;
  name: string;
  legalName: string;
  owner: string;
  region: string;
  riskTier: "low" | "medium" | "high";
  phase: VendorPhase;
  boxFolderId?: string;
  fileRequestId?: string;
  signerEmail?: string;
  requiredDocuments: VendorDocumentType[];
  documents: VendorDocument[];
  activity: VendorActivity[];
}

export interface MissingDocument {
  type: VendorDocumentType;
  label: string;
  reason: string;
}
