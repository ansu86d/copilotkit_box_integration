import { getBoxMode } from "@/lib/box/auth";
import { runBoxCommand } from "@/lib/box/runBoxCommand";

export async function updateDocumentMetadata(fileId: string, values: Record<string, string>) {
  const boxMode = getBoxMode();
  const replaceArgs = Object.entries(values).flatMap(([key, value]) => ["--replace", `${key}=${value}`]);

  const result = await runBoxCommand(
    [
      "files:metadata:update",
      fileId,
      "--scope",
      boxMode.metadataScope,
      "--template-key",
      boxMode.metadataTemplateKey,
      ...replaceArgs,
    ],
    { fileId, values },
  );

  return {
    fileId,
    values,
    source: result.mock ? "demo" : "box",
  };
}
