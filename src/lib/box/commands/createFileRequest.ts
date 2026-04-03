import { getBoxMode } from "@/lib/box/auth";
import { runBoxCommand } from "@/lib/box/runBoxCommand";

export async function createFileRequest(folderId: string, title: string, description?: string) {
  const boxMode = getBoxMode();

  if (boxMode.mock) {
    return {
      id: "mock-file-request",
      title,
      description: description ?? "Upload the required onboarding documents.",
      url: "/forms/vendor-intake-form.pdf",
      source: "demo" as const,
      note:
        "Demo mode only: no Box file request was created. Set a valid BOX_DEVELOPER_TOKEN to create a live Box file request.",
    };
  }

  const templateId = boxMode.fileRequestTemplateId;
  if (!templateId) {
    throw new Error(
      "BOX_FILE_REQUEST_TEMPLATE_ID is not set. Obtain it from your Box account (Admin Console → Content → File Requests → Edit link shows the numeric ID)."
    );
  }

  // Box API only supports copy-from-template; POST /file_requests does not exist.
  // Syntax: box file-requests:copy <templateId> <folderId> [--title ...] [--description ...]
  const result = await runBoxCommand<{ id: string; url?: string }>([
    "file-requests:copy",
    templateId,
    folderId,
    "--title",
    title,
    "--description",
    description ?? "Upload the required onboarding documents.",
  ]);

  const rawUrl = result.data?.url;
  // Box CLI returns a relative path like /f/xxx; make it absolute
  const fullUrl = rawUrl
    ? rawUrl.startsWith("http")
      ? rawUrl
      : `https://app.box.com${rawUrl}`
    : "/forms/vendor-intake-form.pdf";

  return {
    id: result.data?.id ?? "mock-file-request",
    title,
    description: description ?? "Upload the required onboarding documents.",
    url: fullUrl,
    source: result.mock ? "demo" as const : "box" as const,
  };
}
