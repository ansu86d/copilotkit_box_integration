import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getBoxMode } from "@/lib/box/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const boxMode = getBoxMode();
  if (boxMode.mock) {
    return NextResponse.json(
      { error: "BOX_DEVELOPER_TOKEN not configured" },
      { status: 503 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folderId = (formData.get("folderId") as string) || "0";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Build multipart body for Box upload API
  const buf = Buffer.from(await file.arrayBuffer());
  const boundary = `----BoxUpload${Date.now()}`;

  const attributes = JSON.stringify({ name: file.name, parent: { id: folderId } });

  const CRLF = "\r\n";
  const parts: (string | Buffer)[] = [
    `--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="attributes"${CRLF}${CRLF}`,
    attributes,
    `${CRLF}--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="file"; filename="${file.name}"${CRLF}`,
    `Content-Type: ${file.type || "application/octet-stream"}${CRLF}${CRLF}`,
    buf,
    `${CRLF}--${boundary}--${CRLF}`,
  ];

  const bodyBuffer = Buffer.concat(
    parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p)),
  );

  const res = await fetch("https://upload.box.com/api/2.0/files/content", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${boxMode.token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyBuffer,
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json(
      { error: `Box upload failed ${res.status}: ${errText}` },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { entries?: Array<{ id: string; name: string }> };
  const entry = data.entries?.[0];

  return NextResponse.json({ id: entry?.id, name: entry?.name });
}
