import type { BoxFolderItem } from "@/types/box";
import type { VendorWorkspace } from "@/types/vendor";

export function normalizeWorkspace(vendorId: string, vendorName: string, folderId: string): VendorWorkspace {
  return {
    id: `workspace-${vendorId}`,
    vendorId,
    vendorName,
    rootFolderId: folderId,
    subfolders: [
      { name: "01 Intake", folderId: `${folderId}-intake` },
      { name: "02 Review", folderId: `${folderId}-review` },
      { name: "03 Signed", folderId: `${folderId}-signed` },
    ],
    collaborationCount: 0,
    createdAt: new Date().toISOString(),
    source: "box",
  };
}

export function normalizeFolderItems(items: BoxFolderItem[]) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    modifiedAt: item.modified_at,
  }));
}
