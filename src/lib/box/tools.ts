import { defineTool } from "@copilotkit/runtime/v2";

import { addReviewer } from "@/lib/box/commands/addReviewer";
import { createFileRequest } from "@/lib/box/commands/createFileRequest";
import { createReviewTask } from "@/lib/box/commands/createReviewTask";
import { createVendorWorkspace } from "@/lib/box/commands/createVendorWorkspace";
import { findMissingDocuments } from "@/lib/box/commands/findMissingDocuments";
import { getVendorActivity } from "@/lib/box/commands/getVendorActivity";
import { listVendorDocuments } from "@/lib/box/commands/listVendorDocuments";
import { sendSignatureRequest } from "@/lib/box/commands/sendSignatureRequest";
import { normalizeFolderItems } from "@/lib/box/normalize";
import { getWorkspaceForVendor } from "@/lib/box/workspaceRegistry";
import { getSeededVendor, seededWorkspaces } from "@/lib/demo/seedData";
import {
  createWorkspaceSchema,
  documentRequestSchema,
  reviewerSchema,
  reviewTaskSchema,
  signatureRequestSchema,
  vendorFolderLookupSchema,
  vendorLookupSchema,
} from "@/lib/vendors/schema";
import { buildStatusHeadline, getReceivedDocuments } from "@/lib/vendors/status";

export const createVendorWorkspaceTool = defineTool({
  name: "createVendorWorkspace",
  description: "Create the Box folder structure for vendor onboarding and return the workspace summary.",
  parameters: createWorkspaceSchema,
  execute: async ({ vendorName }) => {
    const workspace = await createVendorWorkspace(vendorName);

    return {
      type: "workspace",
      workspace,
      plan: {
        vendorName,
        summary: "Provision the vendor workspace, intake request, review routing, and signature handoff.",
        steps: [
          { title: "Create workspace", detail: "Provision root folder and subfolders in Box.", status: "completed" },
          { title: "Prepare intake", detail: "Create a file request for the vendor upload path.", status: "pending" },
          { title: "Track required documents", detail: "Use metadata and document status to detect gaps.", status: "pending" },
        ],
      },
    };
  },
});

export const createDocumentRequestTool = defineTool({
  name: "createDocumentRequest",
  description: "Create or copy a Box file request into the vendor intake folder.",
  parameters: documentRequestSchema,
  execute: async ({ vendorId, title, description }) => {
    const workspace = getWorkspaceForVendor(vendorId) ?? seededWorkspaces[vendorId];
    const vendor = getSeededVendor(vendorId);
    const fileRequest = await createFileRequest(
      workspace?.subfolders[0]?.folderId ?? "demo-intake-folder",
      title ?? `Upload required onboarding documents for ${workspace?.vendorName ?? vendorId}`,
      description,
    );

    return {
      type: "file_request",
      payload: {
        vendorName: workspace?.vendorName ?? vendor.name,
        title: fileRequest.title,
        url: fileRequest.url,
        source: fileRequest.source,
        note: fileRequest.note,
      },
      fileRequest,
    };
  },
});

export const findMissingDocumentsTool = defineTool({
  name: "findMissingDocuments",
  description: "Check which required onboarding documents are still missing or not yet approved.",
  parameters: vendorLookupSchema,
  execute: async ({ vendorId }) => {
    const result = await findMissingDocuments(vendorId);
    const vendor = getSeededVendor(vendorId);

    return {
      type: "checklist",
      payload: {
        vendorName: vendor.name,
        received: getReceivedDocuments(vendor),
        missing: result.missing,
      },
    };
  },
});

export const addReviewerTool = defineTool({
  name: "addReviewer",
  description: "Invite an internal reviewer to the vendor review folder.",
  parameters: reviewerSchema,
  execute: async ({ vendorId, reviewerEmail, role }) => {
    const workspace = getWorkspaceForVendor(vendorId) ?? seededWorkspaces[vendorId];
    const collaboration = await addReviewer(
      workspace?.subfolders[1]?.folderId ?? workspace?.rootFolderId ?? "demo-review-folder",
      reviewerEmail,
      role,
    );

    return {
      type: "approval",
      payload: {
        title: "Reviewer access should be approved before execution",
        actionLabel: `Invite ${reviewerEmail}`,
        reason: "This action grants access to sensitive vendor documents in the review folder.",
        riskLevel: "medium",
      },
      collaboration,
    };
  },
});

export const listVendorDocumentsTool = defineTool({
  name: "listVendorDocuments",
  description:
    "Inspect a vendor Box folder and return the actual items present. Use this before any file-based action; do not assume files exist.",
  parameters: vendorFolderLookupSchema,
  execute: async ({ vendorId, folder }) => {
    const workspace = getWorkspaceForVendor(vendorId) ?? seededWorkspaces[vendorId];
    const folderIndex = folder === "intake" ? 0 : folder === "review" ? 1 : 2;
    const folderId = workspace?.subfolders[folderIndex]?.folderId ?? workspace?.rootFolderId ?? "demo-folder";
    const items = await listVendorDocuments(folderId, vendorId);

    return {
      type: "folder_items",
      payload: {
        vendorId,
        folder,
        folderId,
        items: normalizeFolderItems(items),
        empty: items.length === 0,
      },
    };
  },
});

export const createReviewTaskTool = defineTool({
  name: "createReviewTask",
  description:
    "Create a Box task on a file to request review or remediation. Requires a verified numeric Box file id from listVendorDocuments; never pass a filename.",
  parameters: reviewTaskSchema,
  execute: async ({ fileId, message, dueAt }) => {
    const task = await createReviewTask(fileId, message, dueAt);
    return { type: "task", task };
  },
});

export const sendSignatureRequestTool = defineTool({
  name: "sendSignatureRequest",
  description: "Prepare the NDA or agreement for signature and flag that approval is required before sending.",
  parameters: signatureRequestSchema,
  execute: async ({ vendorId, signerEmail, documentLabel }) => {
    const signatureRequest = await sendSignatureRequest(vendorId, signerEmail, documentLabel);

    return {
      type: "approval",
      payload: {
        title: "Signature requests require a final confirmation",
        actionLabel: `Send ${documentLabel}`,
        reason: "The vendor will receive a live signature request once you approve this step.",
        riskLevel: "high",
      },
      signatureRequest,
    };
  },
});

export const getVendorOnboardingStatusTool = defineTool({
  name: "getVendorOnboardingStatus",
  description: "Summarize the current onboarding posture for a vendor workspace.",
  parameters: vendorLookupSchema,
  execute: async ({ vendorId }) => {
    const vendor = getSeededVendor(vendorId);
    const workspace = getWorkspaceForVendor(vendorId) ?? seededWorkspaces[vendorId];
    const summary = buildStatusHeadline(vendor, workspace);

    return {
      type: "status_summary",
      payload: {
        vendorName: vendor.name,
        phase: vendor.phase,
        headline: summary.headline,
        nextAction: summary.nextAction,
        workspace,
      },
    };
  },
});

export const getVendorActivityTool = defineTool({
  name: "getVendorActivity",
  description: "Show the recent audit activity for a vendor onboarding flow.",
  parameters: vendorLookupSchema,
  execute: async ({ vendorId }) => {
    const vendor = getSeededVendor(vendorId);
    const items = await getVendorActivity(vendorId);

    return {
      type: "activity_timeline",
      payload: {
        vendorName: vendor.name,
        items,
      },
    };
  },
});

export const onboardingTools = [
  createVendorWorkspaceTool,
  createDocumentRequestTool,
  findMissingDocumentsTool,
  addReviewerTool,
  listVendorDocumentsTool,
  createReviewTaskTool,
  sendSignatureRequestTool,
  getVendorOnboardingStatusTool,
  getVendorActivityTool,
];
