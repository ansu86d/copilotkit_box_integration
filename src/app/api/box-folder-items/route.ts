import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getBoxMode } from "@/lib/box/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/box-folder-items?folderId=<id>
 *
 * Returns the files (not sub-folders) inside a Box folder.
 */
export async function GET(req: NextRequest) {
  const folderId = req.nextUrl.searchParams.get("folderId");
  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const boxMode = getBoxMode();
  if (boxMode.mock) {
    return NextResponse.json({ items: [] });
  }

  const res = await fetch(
    `https://api.box.com/2.0/folders/${folderId}/items?fields=id,name,type,size,modified_at&limit=100`,
    {
      headers: { Authorization: `Bearer ${boxMode.token}` },
      signal: AbortSignal.timeout(8000),
    },
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Box API error", status: res.status }, { status: 502 });
  }

  const data = (await res.json()) as { entries?: Array<{ id: string; name: string; type: string; size?: number; modified_at?: string }> };
  const items = (data.entries ?? [])
    .filter((e) => e.type === "file")
    .map((e) => ({ id: e.id, name: e.name, size: e.size, modified_at: e.modified_at }));

  return NextResponse.json({ items });
}
