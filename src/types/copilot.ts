import type { MissingDocument, VendorActivity, VendorWorkspace } from "@/types/vendor";

export interface PlanStep {
  title: string;
  detail: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
}

export interface PlanPayload {
  vendorName: string;
  summary: string;
  steps: PlanStep[];
}

export interface ApprovalPayload {
  title: string;
  actionLabel: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
}

export interface ChecklistPayload {
  vendorName: string;
  received: Array<{ label: string; status: string }>;
  missing: MissingDocument[];
}

export interface StatusSummaryPayload {
  vendorName: string;
  phase: string;
  headline: string;
  nextAction: string;
  workspace?: VendorWorkspace;
}

export interface ActivityTimelinePayload {
  vendorName: string;
  items: VendorActivity[];
}

export interface FileRequestPayload {
  vendorName: string;
  title: string;
  url: string;
  source: "box" | "demo";
  note?: string;
}

export interface SignRequestPayload {
  vendorName: string;
  signerEmail: string;
  documentName: string;
  signRequestId: string;
  status: string;
  source: "box" | "demo";
  shortId?: string;
  signingUrl?: string;
}

export interface FillPdfStep {
  id: string;
  status: "pending" | "in_progress" | "completed" | "error";
  detail: string;
}

export interface FillPdfResult {
  intakeFileId: string;
  reviewFileId: string;
  fileName: string;
  source: "box" | "demo";
}
