import { getSeededVendor, seededWorkspaces } from "@/lib/demo/seedData";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const boxActionRequestSchema = {
  createVendorWorkspace: createWorkspaceSchema,
  createDocumentRequest: documentRequestSchema,
  findMissingDocuments: vendorLookupSchema,
  addReviewer: reviewerSchema,
  listVendorDocuments: vendorFolderLookupSchema,
  createReviewTask: reviewTaskSchema,
  sendSignatureRequest: signatureRequestSchema,
  getVendorOnboardingStatus: vendorLookupSchema,
  getVendorActivity: vendorLookupSchema,
} as const;

type BoxActionName = keyof typeof boxActionRequestSchema;

async function executeBoxAction(action: BoxActionName, input: unknown) {
  switch (action) {
    case "createVendorWorkspace": {
      const { vendorName } = boxActionRequestSchema.createVendorWorkspace.parse(input);
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
    }

    case "createDocumentRequest": {
      const { vendorId, title, description } = boxActionRequestSchema.createDocumentRequest.parse(input);
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
    }

    case "findMissingDocuments": {
      const { vendorId } = boxActionRequestSchema.findMissingDocuments.parse(input);
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
    }

    case "addReviewer": {
      const { vendorId, reviewerEmail, role } = boxActionRequestSchema.addReviewer.parse(input);
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
    }

    case "listVendorDocuments": {
      const { vendorId, folder } = boxActionRequestSchema.listVendorDocuments.parse(input);
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
    }

    case "createReviewTask": {
      const { fileId, message, dueAt } = boxActionRequestSchema.createReviewTask.parse(input);
      const task = await createReviewTask(fileId, message, dueAt);

      return {
        type: "task",
        task,
      };
    }

    case "sendSignatureRequest": {
      const { vendorId, signerEmail, documentLabel, fileId, signedFolderId } = boxActionRequestSchema.sendSignatureRequest.parse(input);
      const vendor = getSeededVendor(vendorId);
      const signatureRequest = await sendSignatureRequest(vendorId, signerEmail, documentLabel, { fileId, signedFolderId });

      return {
        type: "sign_request",
        payload: {
          vendorName: vendor.name,
          signerEmail: signatureRequest.signerEmail,
          documentName: signatureRequest.documentLabel,
          signRequestId: signatureRequest.signRequestId,
          status: signatureRequest.status,
          source: signatureRequest.source,
          signingUrl: signatureRequest.signingUrl,
        },
      };
    }

    case "getVendorOnboardingStatus": {
      const { vendorId } = boxActionRequestSchema.getVendorOnboardingStatus.parse(input);
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
    }

    case "getVendorActivity": {
      const { vendorId } = boxActionRequestSchema.getVendorActivity.parse(input);
      const vendor = getSeededVendor(vendorId);
      const items = await getVendorActivity(vendorId);

      return {
        type: "activity_timeline",
        payload: {
          vendorName: vendor.name,
          items,
        },
      };
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: string; input?: unknown };

    // Wizard-specific: move a file to a different Box folder
    if (body.action === "moveFile") {
      const { fileId, targetFolderId } = body.input as { fileId: string; targetFolderId: string };
      const { getBoxMode } = await import("@/lib/box/auth");
      const boxMode = getBoxMode();
      if (boxMode.mock) return Response.json({ error: "Box token not configured" }, { status: 503 });

      const moveSignal = AbortSignal.timeout(60_000);
      const res = await fetch(`https://api.box.com/2.0/files/${fileId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${boxMode.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ parent: { id: targetFolderId } }),
        signal: moveSignal,
      });
      if (res.status === 401) {
        return Response.json({ error: "Box developer token expired — go to developer.box.com, generate a new token, update BOX_DEVELOPER_TOKEN in .env.local, and restart the server." }, { status: 401 });
      }
      if (!res.ok) {
        const err = await res.text();
        return Response.json({ error: `Box move failed: ${err}` }, { status: res.status });
      }
      const data = (await res.json()) as { id: string; name: string; parent?: { id: string; name: string } };
      return Response.json({ id: data.id, name: data.name, parentId: data.parent?.id, parentName: data.parent?.name });
    }

    // Wizard-specific: send a Box Sign request with named signer + reviewer
    if (body.action === "signWizard") {
      const { fileId, signerEmail, signerName, reviewerEmail, reviewerName, reviewFolderId, signedFolderId } =
        body.input as {
          fileId: string;
          signerEmail: string;
          signerName: string;
          reviewerEmail: string;
          reviewerName: string;
          reviewFolderId: string;
          signedFolderId: string;
        };
      const { getBoxMode } = await import("@/lib/box/auth");
      const boxMode = getBoxMode();
      if (boxMode.mock) return Response.json({ error: "Box token not configured" }, { status: 503 });

      // File is already in the review folder (moved there at fill time)
      const signFileId = fileId;

      // ── Create sign request ───────────────────────────────────────────────

      const signBody = JSON.stringify({
        signers: [
          {
            email: reviewerEmail,
            role: "approver",
            name: reviewerName,
            embed_url_external_user_id: reviewerEmail,
            order: 1,
          },
          {
            email: signerEmail,
            role: "signer",
            name: signerName,
            embed_url_external_user_id: signerEmail,
            order: 2,
          },
        ],
        source_files: [{ id: signFileId, type: "file" }],
        parent_folder: { id: signedFolderId, type: "folder" },
        email_subject: "Vendor Document — Signature Required",
        email_message: `Please review and sign the document. Reviewer: ${reviewerName}.`,
        are_reminders_enabled: true,
        are_text_signatures_enabled: true,
      });

      const signRes = await fetch("https://api.box.com/2.0/sign_requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${boxMode.token}`, "Content-Type": "application/json" },
        body: signBody,
      });

      if (signRes.status === 401) {
        return Response.json({ error: "Box developer token expired — go to developer.box.com, generate a new token, update BOX_DEVELOPER_TOKEN in .env.local, and restart the server." }, { status: 401 });
      }
      if (!signRes.ok) {
        const errText = await signRes.text();
        let message = `Box Sign error ${signRes.status}`;
        try {
          const errData = JSON.parse(errText) as { context_info?: { errors?: Array<{ name?: string; reason?: string }> } };
          const srcFile = errData.context_info?.errors?.find((e) => e.name === "source_files");
          if (srcFile?.reason === "not_found") {
            message = "Box Sign failed: the source file was not found. Your developer token may have expired — refresh BOX_DEVELOPER_TOKEN in .env.local, restart the server, and run the wizard again from Step 0.";
          }
        } catch { /* ignore parse errors */ }
        return Response.json({ error: message }, { status: signRes.status });
      }

      const signData = (await signRes.json()) as {
        id: string;
        status: string;
        prepare_url?: string;
        signers?: Array<{ email?: string; role?: string; order?: number; signing_url?: string; embed_url?: string; prepare_url?: string }>;
      };

      console.log("[signWizard] Box Sign create status:", signData.status);
      console.log("[signWizard] signers:", JSON.stringify(signData.signers?.map(s => ({
        email: s.email, role: s.role, order: s.order,
        signing_url: s.signing_url, embed_url: s.embed_url, prepare_url: s.prepare_url,
      })), null, 2));

      // Extract per-role URLs from the CREATE response — only available here, never in GET
      const allSigners = signData.signers ?? [];
      const approverSigner = allSigners.find((s) => s.role === "approver");
      const signerSigner   = allSigners.find((s) => s.role === "signer");

      const reviewerUrl =
        approverSigner?.signing_url ??
        approverSigner?.embed_url ??
        approverSigner?.prepare_url;

      const signingUrl =
        signerSigner?.signing_url ??
        signerSigner?.embed_url ??
        signerSigner?.prepare_url ??
        signData.prepare_url;

      console.log("[signWizard] resolved reviewerUrl:", reviewerUrl);
      console.log("[signWizard] resolved signingUrl:", signingUrl);

      // Trigger resend so Box also sends the email to the signer
      // (embed_url_external_user_id suppresses the default email)
      if (signData.id) {
        fetch(`https://api.box.com/2.0/sign_requests/${signData.id}/resend`, {
          method: "POST",
          headers: { Authorization: `Bearer ${boxMode.token}` },
        }).catch(() => {}); // fire-and-forget
      }

      return Response.json({ signRequestId: signData.id, status: signData.status, reviewerUrl, signingUrl });
    }

    if (!body.action || !(body.action in boxActionRequestSchema)) {
      return Response.json({ error: "Unsupported Box action." }, { status: 400 });
    }

    const result = await executeBoxAction(body.action as BoxActionName, body.input);

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Box action error.";

    return Response.json({ error: message }, { status: 500 });
  }
}