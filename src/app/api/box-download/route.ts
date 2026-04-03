import type { NextRequest } from "next/server";

import { getBoxMode } from "@/lib/box/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/box-download?fileId=<id>
 *
 * Resolves the Box file download URL and redirects the browser to it.
 * Box returns a 302 to an authenticated S3 URL — we follow that redirect
 * and issue a final redirect to the browser so the file downloads directly.
 */
export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return new Response("fileId required", { status: 400 });
  }

  const boxMode = getBoxMode();
  if (boxMode.mock) {
    return new Response("Download not available in demo mode", { status: 503 });
  }

  const res = await fetch(`https://api.box.com/2.0/files/${fileId}/content`, {
    headers: { Authorization: `Bearer ${boxMode.token}` },
    redirect: "manual", // capture the 302, don't follow it
    signal: AbortSignal.timeout(8000),
  });

  // Box returns 302 with a Location header pointing to the S3 download URL
  const downloadUrl = res.headers.get("location");
  if (!downloadUrl) {
    return new Response("Could not resolve download URL", { status: 502 });
  }

  return Response.redirect(downloadUrl, 302);
}
