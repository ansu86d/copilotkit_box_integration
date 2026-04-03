import { seededVendors, seededWorkspaces } from "@/lib/demo/seedData";
import { getBoxMode } from "@/lib/box/auth";

type SignRequestResponse = {
  id: string;
  status: string;
  sign_request_id?: string;
  name?: string;
  signing_log?: { url?: string };
  signers?: Array<{ email: string; role: string; signing_url?: string; embed_url?: string }>;
};

/** Fetch real files from a Box folder and return the first PDF found, or first item. */
async function resolveFileFromFolder(folderId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.box.com/2.0/folders/${folderId}/items?fields=id,name,type&limit=50`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { entries?: Array<{ id: string; name: string; type: string }> };
    const files = (data.entries ?? []).filter((e) => e.type === "file");
    // Prefer a PDF
    const pdf = files.find((f) => f.name.toLowerCase().endsWith(".pdf"));
    return pdf?.id ?? files[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function sendSignatureRequest(
  vendorId: string,
  signerEmail: string,
  documentLabel: string,
  options?: { fileId?: string; signedFolderId?: string },
) {
  const vendor = seededVendors.find((v) => v.id === vendorId) ?? seededVendors[0];
  const workspace = seededWorkspaces[vendor.id];

  const resolvedSignedFolderId =
    options?.signedFolderId ?? workspace?.subfolders[2]?.folderId ?? workspace?.rootFolderId;
  const reviewFolderId = workspace?.subfolders[1]?.folderId;

  const boxMode = getBoxMode();

  // 1. Use explicitly provided file ID if available (most reliable)
  let sourceFileId: string | undefined = options?.fileId;

  // 2. Otherwise resolve from the review folder at runtime
  if (!sourceFileId && !boxMode.mock && reviewFolderId) {
    const liveFileId = await resolveFileFromFolder(reviewFolderId, boxMode.token);
    if (liveFileId) sourceFileId = liveFileId;
  }

  // 3. Last resort: seed data boxFileId
  if (!sourceFileId) {
    const normalized = documentLabel.toLowerCase();
    const doc =
      vendor.documents.find(
        (d) => d.boxFileId && (d.type === "nda" || d.name.toLowerCase().includes(normalized)),
      ) ?? vendor.documents.find((d) => d.boxFileId);
    sourceFileId = doc?.boxFileId;
  }

  const signedFolderId = resolvedSignedFolderId;

  const mockData: SignRequestResponse = {
    id: `demo-sign-${Date.now()}`,
    status: "converting",
    name: documentLabel,
    signers: [{ email: signerEmail, role: "signer" }],
  };

  if (boxMode.mock || !sourceFileId || !signedFolderId) {
    return {
      vendorId,
      signerEmail,
      documentLabel,
      signRequestId: mockData.id,
      status: mockData.status,
      source: "demo" as const,
    };
  }

  const body = JSON.stringify({
    signers: [{ email: signerEmail, role: "signer" }],
    source_files: [{ id: sourceFileId, type: "file" }],
    parent_folder: { id: signedFolderId, type: "folder" },
    email_subject: `Vendor NDA - ${vendor.name}`,
    email_message: `Please sign the NDA to complete onboarding for ${vendor.name}.`,
    are_reminders_enabled: true,
    are_text_signatures_enabled: true,
  });

  const res = await fetch("https://api.box.com/2.0/sign_requests", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${boxMode.token}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Box Sign API error ${res.status}: ${err}`);
  }

  const data: SignRequestResponse = await res.json();

  const signingUrl =
    data.signers?.find((s) => s.email === signerEmail)?.signing_url ??
    data.signers?.find((s) => s.email === signerEmail)?.embed_url ??
    data.signers?.[0]?.signing_url ??
    data.signers?.[0]?.embed_url;

  return {
    vendorId,
    signerEmail,
    documentLabel: data.name ?? documentLabel,
    signRequestId: data.id,
    status: data.status,
    source: "box" as const,
    signingUrl,
  };
}
