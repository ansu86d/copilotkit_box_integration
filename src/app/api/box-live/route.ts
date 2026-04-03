import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getFolderItems } from "@/lib/box/getFolderItems";
import { getWebhookEvents, getLatestSignEvent } from "@/lib/box/webhookStore";
import { getWorkspaceForVendor } from "@/lib/box/workspaceRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const vendorId = req.nextUrl.searchParams.get("vendorId") ?? "vendor-acme-logistics";
  const workspace = getWorkspaceForVendor(vendorId);

  if (!workspace) {
    return NextResponse.json({ error: "unknown vendor" }, { status: 404 });
  }

  const folders = await Promise.all(
    workspace.subfolders.map(async (sf) => ({
      name: sf.name,
      folderId: sf.folderId,
      items: await getFolderItems(sf.folderId),
    })),
  );

  return NextResponse.json({
    updatedAt: new Date().toISOString(),
    folders,
    recentEvents: getWebhookEvents(8),
    latestSignEvent: getLatestSignEvent() ?? null,
  });
}
