import { seededWorkspaces } from "@/lib/demo/seedData";
import { normalizeWorkspace } from "@/lib/box/normalize";
import { runBoxCommand } from "@/lib/box/runBoxCommand";
import { setWorkspaceForVendor } from "@/lib/box/workspaceRegistry";

function getExistingFolderIdFromError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const match = error.message.match(/item_name_in_use[\s\S]*?ID: '?(\d+)'?/i);

  return match?.[1] ?? null;
}

async function createOrReuseFolder(
  parentFolderId: string,
  folderName: string,
  fallbackId: string,
): Promise<{ folderId: string; source: "box" | "demo" }> {
  try {
    const result = await runBoxCommand<{ id: string }>(["folders:create", parentFolderId, folderName], {
      id: fallbackId,
    });

    return {
      folderId: result.data?.id ?? fallbackId,
      source: result.mock ? "demo" : "box",
    };
  } catch (error) {
    const existingFolderId = getExistingFolderIdFromError(error);

    if (!existingFolderId) {
      throw error;
    }

    return {
      folderId: existingFolderId,
      source: "box" as const,
    };
  }
}

export async function createVendorWorkspace(vendorName: string) {
  const vendorId = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const mockWorkspace = seededWorkspaces[vendorId] ?? normalizeWorkspace(vendorId, vendorName, "demo-root-folder");

  const rootFolder = await createOrReuseFolder("0", `${vendorName} - Onboarding`, mockWorkspace.rootFolderId);
  const rootFolderId = rootFolder.folderId;
  const workspace = normalizeWorkspace(vendorId, vendorName, rootFolderId);

  const subfolders = [];

  for (const subfolder of ["01 Intake", "02 Review", "03 Signed"]) {
    const subfolderResult = await createOrReuseFolder(
      rootFolderId,
      subfolder,
      `${rootFolderId}-${subfolder.toLowerCase().split(" ")[1]}`,
    );

    subfolders.push({
      name: subfolder,
      folderId: subfolderResult.folderId,
    });
  }

  return setWorkspaceForVendor({
    ...workspace,
    subfolders,
    source: rootFolder.source,
  });
}
