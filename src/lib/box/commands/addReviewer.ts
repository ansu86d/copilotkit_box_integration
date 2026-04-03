import { getBoxMode } from "@/lib/box/auth";
import { runBoxCommand } from "@/lib/box/runBoxCommand";

/** Check whether an email is already a collaborator on a Box folder. */
async function isAlreadyCollaborator(folderId: string, email: string): Promise<boolean> {
  const boxMode = getBoxMode();
  if (boxMode.mock || folderId.startsWith("demo-")) return false;
  try {
    const result = await runBoxCommand<Array<{ accessible_by?: { login?: string } }>>(
      ["folders:collaborations", folderId],
    );
    const entries = Array.isArray(result.data) ? result.data : [];
    return entries.some((c) => c.accessible_by?.login?.toLowerCase() === email.toLowerCase());
  } catch {
    return false; // if the check fails, let the create attempt proceed
  }
}

export async function addReviewer(folderId: string, reviewerEmail: string, role: string) {
  const alreadyCollaborator = await isAlreadyCollaborator(folderId, reviewerEmail);

  if (alreadyCollaborator) {
    return {
      collaborationId: `collab-${reviewerEmail}`,
      reviewerEmail,
      role,
      source: "box" as const,
      note: "Already a collaborator — no change needed.",
    };
  }

  try {
    const result = await runBoxCommand<{ id: string }>(
      ["collaborations:create", folderId, "folder", "--role", role, "--login", reviewerEmail, "--notify"],
      { id: `collab-${reviewerEmail}` },
    );

    return {
      collaborationId: result.data?.id ?? `collab-${reviewerEmail}`,
      reviewerEmail,
      role,
      source: result.mock ? "demo" : "box",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("user_already_collaborator")) {
      return {
        collaborationId: `collab-${reviewerEmail}`,
        reviewerEmail,
        role,
        source: "box" as const,
        note: "Already a collaborator — no change needed.",
      };
    }
    throw err;
  }
}
