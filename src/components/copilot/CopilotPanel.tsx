"use client";

import { useEffect, useRef, useState } from "react";

import { useCopilotAction, useCopilotChat } from "@copilotkit/react-core";
import { CopilotChat, useDefaultRenderTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

import { ActivityTimeline } from "@/components/copilot/ActivityTimeline";
import { ApprovalCard } from "@/components/copilot/ApprovalCard";
import { FillPdfCard } from "@/components/copilot/FillPdfCard";
import { ChecklistCard } from "@/components/copilot/ChecklistCard";
import { FolderItemsCard } from "@/components/copilot/FolderItemsCard";
import { PlanCard } from "@/components/copilot/PlanCard";
import { FileRequestCard } from "@/components/copilot/FileRequestCard";
import { SignRequestCard } from "@/components/copilot/SignRequestCard";
import { StatusSummaryCard } from "@/components/copilot/StatusSummaryCard";
import type {
  ActivityTimelinePayload,
  ApprovalPayload,
  ChecklistPayload,
  FileRequestPayload,
  FillPdfResult,
  FillPdfStep,
  PlanPayload,
  SignRequestPayload,
  StatusSummaryPayload,
} from "@/types/copilot";
import type { FolderItemsPayload } from "@/components/copilot/FolderItemsCard";

const vendorLookupSchema = z.object({
  vendorId: z.string(),
});

const createWorkspaceSchema = z.object({
  vendorName: z.string(),
  region: z.string().optional(),
  riskTier: z.enum(["low", "medium", "high"]).optional(),
});

const reviewerSchema = z.object({
  vendorId: z.string(),
  reviewerEmail: z.string(),
  role: z.string(),
});

const signatureSchema = z.object({
  vendorId: z.string(),
  signerEmail: z.string(),
  documentLabel: z.string(),
});

async function invokeBoxAction<T>(action: string, input: Record<string, unknown>) {
  const response = await fetch("/api/box-action", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, input }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Failed to run ${action}.`;

    if (
      response.status === 401 ||
      errorMessage.toLowerCase().includes("token expired") ||
      errorMessage.toLowerCase().includes("developer token")
    ) {
      throw new Error(
        "⚠️ Your Box developer token has expired.\n\n" +
          "To fix:\n" +
          "1. Go to https://developer.box.com and open your app\n" +
          "2. Generate a new Developer Token\n" +
          "3. Update BOX_DEVELOPER_TOKEN in .env.local\n" +
          "4. Restart the server (npm run dev)\n" +
          "5. Run the wizard from Step 0 again"
      );
    }

    throw new Error(errorMessage);
  }

  return payload as T;
}

// ─── streaming step state for fillAndMoveIntakePdf ──────────────────────────
const FILL_STEP_INIT: FillPdfStep[] = [
  { id: "map_fields", status: "pending", detail: "Waiting…" },
  { id: "fill_pdf", status: "pending", detail: "Waiting…" },
  { id: "upload_intake", status: "pending", detail: "Waiting…" },
];

export function CopilotPanel() {
  const { reset } = useCopilotChat();
  const [fillSteps, setFillSteps] = useState<FillPdfStep[]>(FILL_STEP_INIT);
  const fillResultRef = useRef<FillPdfResult | null>(null);

  useEffect(() => {
    reset();
  }, [reset]);

  useCopilotAction({
    name: "createVendorWorkspace",
    description: "Create the Box folder structure for vendor onboarding and return the workspace summary.",
    parameters: [
      { name: "vendorName", type: "string", description: "Vendor display name, such as Acme Logistics", required: true },
      { name: "region", type: "string", description: "Vendor operating region", required: false },
      { name: "riskTier", type: "string", enum: ["low", "medium", "high"], description: "Risk tier", required: false },
    ],
    handler: (args) => invokeBoxAction<{ plan: PlanPayload }>("createVendorWorkspace", args),
    render: ({ status, result }) => {
      if (status !== "complete" || !result || typeof result !== "object" || !("plan" in result)) {
        return <div className="tool-inline-state">🏗️ Creating Box folder structure for the vendor workspace…</div>;
      }

      const typedResult = result as { plan: PlanPayload };

      return <PlanCard plan={typedResult.plan} />;
    },
  });

  useCopilotAction({
    name: "findMissingDocuments",
    description: "Check which required onboarding documents are still missing or not yet approved.",
    parameters: [{ name: "vendorId", type: "string", description: "Vendor id", required: true }],
    handler: (args) => invokeBoxAction<{ payload: ChecklistPayload }>("findMissingDocuments", args),
    render: ({ status, result }) => {
      if (status !== "complete" || !result || typeof result !== "object" || !("payload" in result)) {
        return <div className="tool-inline-state">📋 Scanning required documents — checking what's present and what's missing…</div>;
      }

      const typedResult = result as { payload: ChecklistPayload };

      return <ChecklistCard payload={typedResult.payload} />;
    },
  });

  useCopilotAction({
    name: "createDocumentRequest",
    description: "Create or copy a Box file request into the vendor intake folder.",
    parameters: [
      { name: "vendorId", type: "string", description: "Vendor id", required: true },
      { name: "title", type: "string", description: "Optional file request title", required: false },
      { name: "description", type: "string", description: "Optional file request description", required: false },
    ],
    handler: (args) => invokeBoxAction<{ payload: FileRequestPayload }>("createDocumentRequest", args),
    render: ({ status, result }) => {
      if (status !== "complete" || !result || typeof result !== "object" || !("payload" in result)) {
        return <div className="tool-inline-state">📥 Setting up the intake upload form in Box…</div>;
      }

      const typedResult = result as { payload: FileRequestPayload };

      return <FileRequestCard payload={typedResult.payload} />;
    },
  });

  useCopilotAction({
    name: "addReviewer",
    description: "Invite an internal reviewer to the vendor review folder.",
    parameters: [
      { name: "vendorId", type: "string", description: "Vendor id", required: true },
      { name: "reviewerEmail", type: "string", description: "Reviewer email address", required: true },
      { name: "role", type: "string", enum: ["editor", "viewer", "previewer", "uploader"], description: "Reviewer role", required: true },
    ],
    handler: (args) => invokeBoxAction<{ payload: ApprovalPayload }>("addReviewer", args),
    render: ({ status, result }) => {
      if (status !== "complete" || !result || typeof result !== "object" || !("payload" in result)) {
        return <div className="tool-inline-state">👤 Granting reviewer access to the Box review folder…</div>;
      }

      const typedResult = result as { payload: ApprovalPayload };

      return <ApprovalCard payload={typedResult.payload} />;
    },
  });

  useCopilotAction({
    name: "listVendorDocuments",
    description: "Inspect a vendor Box folder and return the actual items present.",
    parameters: [
      { name: "vendorId", type: "string", description: "Vendor id", required: true },
      { name: "folder", type: "string", enum: ["intake", "review", "signed"], description: "Folder to inspect", required: true },
    ],
    handler: (args) => invokeBoxAction<{ payload: FolderItemsPayload }>("listVendorDocuments", args),
    render: ({ status, result }) => {
      if (status !== "complete" || !result || typeof result !== "object" || !("payload" in result)) {
        return <div className="tool-inline-state">🔍 Reading folder contents from Box…</div>;
      }
      const typedResult = result as { payload: FolderItemsPayload };
      return <FolderItemsCard payload={typedResult.payload} />;
    },
  });

  useCopilotAction({
    name: "createReviewTask",
    description: "Create a Box task on a verified numeric Box file id.",
    parameters: [
      { name: "fileId", type: "string", description: "Verified numeric Box file id", required: true },
      { name: "message", type: "string", description: "Task instructions", required: true },
      { name: "dueAt", type: "string", description: "Optional ISO due date", required: false },
    ],
    handler: (args) => invokeBoxAction("createReviewTask", args),
  });

  useCopilotAction({
    name: "sendSignatureRequest",
    description: "Send a Box Sign request to the vendor signer for the NDA or agreement document.",
    parameters: [
      { name: "vendorId", type: "string", description: "Vendor id", required: true },
      { name: "signerEmail", type: "string", description: "Signer email address", required: true },
      { name: "documentLabel", type: "string", description: "Document label", required: true },
      { name: "fileId", type: "string", description: "Verified numeric Box file id from a prior folder listing — pass this to avoid re-resolution errors", required: false },
      { name: "signedFolderId", type: "string", description: "Box folder id where the signed copy will be saved", required: false },
    ],
    handler: (args) => invokeBoxAction<{ payload: SignRequestPayload }>("sendSignatureRequest", args),
    render: ({ status, result }) => {
      if (status !== "complete" || !result || typeof result !== "object" || !("payload" in result)) {
        return <div className="tool-inline-state">✍️ Sending signature request via Box Sign…</div>;
      }

      const typedResult = result as { payload: SignRequestPayload };

      return <SignRequestCard payload={typedResult.payload} />;
    },
  });

  useCopilotAction({
    name: "getVendorOnboardingStatus",
    description: "Summarize the current onboarding posture for a vendor workspace.",
    parameters: [{ name: "vendorId", type: "string", description: "Vendor id", required: true }],
    handler: (args) => invokeBoxAction<{ payload: StatusSummaryPayload }>("getVendorOnboardingStatus", args),
    render: ({ status, result }) => {
      if (status !== "complete" || !result || typeof result !== "object" || !("payload" in result)) {
        return <div className="tool-inline-state">📊 Compiling onboarding status — reviewing all document and approval states…</div>;
      }

      const typedResult = result as { payload: StatusSummaryPayload };

      return <StatusSummaryCard payload={typedResult.payload} />;
    },
  });

  useCopilotAction({
    name: "getVendorActivity",
    description: "Show the recent audit activity for a vendor onboarding flow.",
    parameters: [{ name: "vendorId", type: "string", description: "Vendor id", required: true }],
    handler: (args) => invokeBoxAction<{ payload: ActivityTimelinePayload }>("getVendorActivity", args),
    render: ({ status, result }) => {
      if (status !== "complete" || !result || typeof result !== "object" || !("payload" in result)) {
        return <div className="tool-inline-state">🕐 Loading audit activity timeline from Box…</div>;
      }

      const typedResult = result as { payload: ActivityTimelinePayload };

      return <ActivityTimeline payload={typedResult.payload} />;
    },
  });

  useCopilotAction({
    name: "fillAndMoveIntakePdf",
    description:
      "Use the LLM + pypdf to fill the vendor intake PDF form with the given content, upload it to the intake folder, and copy it to the review folder. Shows real-time step progress.",
    parameters: [
      { name: "vendorId", type: "string", description: "Vendor id", required: true },
      { name: "content", type: "string", description: "Free-form vendor information to populate the intake PDF", required: true },
    ],
    handler: async (args) => {
      setFillSteps(FILL_STEP_INIT);
      fillResultRef.current = null;

      const response = await fetch("/api/fill-intake-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as
              | { type: "step"; stepId: string; status: FillPdfStep["status"]; detail: string }
              | { type: "result"; data: FillPdfResult };

            if (event.type === "step") {
              setFillSteps((prev) =>
                prev.map((s) =>
                  s.id === event.stepId ? { ...s, status: event.status, detail: event.detail } : s,
                ),
              );
            } else if (event.type === "result") {
              fillResultRef.current = event.data;
            }
          } catch {
            // skip malformed line
          }
        }
      }

      return fillResultRef.current;
    },
    render: ({ status, result }) => {
      const finalResult = (result ?? fillResultRef.current) as FillPdfResult | null;
      return (
        <FillPdfCard
          steps={fillSteps}
          fileName={finalResult?.fileName}
          reviewFileId={finalResult?.reviewFileId}
          source={finalResult?.source}
        />
      );
    },
  });

  useDefaultRenderTool({
    render: ({ name, status }) => (
      <div className="tool-inline-state">{status === "complete" ? `Finished ${name}` : `Running ${name}…`}</div>
    ),
  });

  return (
    <section className="copilot-panel">
      <div className="copilot-panel__header">
        <p className="eyebrow">Copilot operator</p>
        <h2>Drive onboarding through intent, not a pile of manual console steps.</h2>
      </div>
      <CopilotChat
        className="copilot-chat"
        welcomeScreen={false}
        labels={{
          modalHeaderTitle: "Vendor Onboarding Copilot",
          chatInputPlaceholder: "Ask about a vendor, document status, or say: fill the intake PDF for Acme with…",
        }}
      />
    </section>
  );
}
