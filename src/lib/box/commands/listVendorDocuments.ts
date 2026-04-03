import { seededVendors } from "@/lib/demo/seedData";
import { runBoxCommand } from "@/lib/box/runBoxCommand";

export async function listVendorDocuments(folderId: string, vendorId?: string) {
  const seededVendor = seededVendors.find((vendor) => vendor.id === vendorId);

  type FolderItem = { id: string; name: string; type: string; modified_at?: string };
  const mockEntries: FolderItem[] =
    seededVendor?.documents.map((document) => ({
      id: document.boxFileId ?? document.id,
      name: document.name,
      type: document.boxFileId ? "file" : "mock",
    })) ?? [];

  const result = await runBoxCommand<FolderItem[] | { entries?: FolderItem[] }>(
    ["folders:items", folderId, "--max-items", "100"],
    mockEntries,
  );

  // Box CLI returns a direct array for folder items; fall back to { entries } shape for safety.
  const raw = result.data;
  if (Array.isArray(raw)) return raw;
  const entries = raw && typeof raw === "object" ? (raw as { entries?: FolderItem[] }).entries : undefined;
  return Array.isArray(entries) ? entries : [];
}
