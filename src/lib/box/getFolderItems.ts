import { getAppEnv, isPlaceholder } from "@/lib/config/env";

export interface BoxItem {
  id: string;
  name: string;
  type: "file" | "folder";
  size?: number;
  modified_at?: string;
}

/**
 * List items in a Box folder via direct Box API (no CLI spawn).
 * Returns [] on any error (offline, bad token, etc.).
 */
export async function getFolderItems(folderId: string): Promise<BoxItem[]> {
  const env = getAppEnv();
  if (isPlaceholder(env.boxDeveloperToken)) return [];

  try {
    const res = await fetch(
      `https://api.box.com/2.0/folders/${folderId}/items?fields=id,name,type,size,modified_at&limit=100`,
      {
        headers: { Authorization: `Bearer ${env.boxDeveloperToken}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { entries?: Record<string, unknown>[] };
    const entries = data.entries ?? [];
    return entries.map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? "(unnamed)"),
      type: item.type === "folder" ? "folder" : "file",
      size: typeof item.size === "number" ? item.size : undefined,
      modified_at: typeof item.modified_at === "string" ? item.modified_at : undefined,
    }));
  } catch {
    return [];
  }
}
