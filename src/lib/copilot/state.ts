import type {
  ActivityTimelinePayload,
  ApprovalPayload,
  ChecklistPayload,
  PlanPayload,
  StatusSummaryPayload,
} from "@/types/copilot";

export interface AppWorkspaceSnapshot {
  plan?: PlanPayload;
  checklist?: ChecklistPayload;
  approval?: ApprovalPayload;
  statusSummary?: StatusSummaryPayload;
  activity?: ActivityTimelinePayload;
}
