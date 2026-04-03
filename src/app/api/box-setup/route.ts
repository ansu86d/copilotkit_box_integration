import type { NextRequest } from "next/server";

import { getBoxMode } from "@/lib/box/auth";
import { getAppEnv } from "@/lib/config/env";
import { setWorkspaceForVendor } from "@/lib/box/workspaceRegistry";
import { seededWorkspaces } from "@/lib/demo/seedData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VENDOR_ID = "vendor-acme-logistics";
const SUBFOLDER_NAMES = ["01 Intake", "02 Review", "03 Signed"];

const encoder = new TextEncoder();

function sse(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/** Build a multipart/form-data buffer for Box upload API */
function buildMultipart(
  filename: string,
  mimeType: string,
  folderId: string,
  fileBytes: Buffer,
): { body: Buffer; contentType: string } {
  const boundary = `BoxSetup${Date.now()}`;
  const CRLF = "\r\n";
  const attributes = JSON.stringify({ name: filename, parent: { id: folderId } });

  const parts: (string | Buffer)[] = [
    `--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="attributes"${CRLF}${CRLF}`,
    attributes,
    `${CRLF}--${boundary}${CRLF}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}`,
    `Content-Type: ${mimeType || "application/octet-stream"}${CRLF}${CRLF}`,
    fileBytes,
    `${CRLF}--${boundary}--${CRLF}`,
  ];

  return {
    body: Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p))),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function POST(req: NextRequest) {
  const boxMode = getBoxMode();
  if (boxMode.mock) {
    return new Response(
      JSON.stringify({ error: "BOX_DEVELOPER_TOKEN not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Read file eagerly — can't stream form-data and SSE simultaneously
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return new Response(JSON.stringify({ error: "No file" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawCompanyName = (formData.get("companyName") as string | null)?.trim();
  const companyName = rawCompanyName && rawCompanyName.length > 0 ? rawCompanyName : "Vendor Onboarding";
  const rootFolderName = `${companyName} - Onboarding`;

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const token = boxMode.token;

  const body = new ReadableStream({
    async start(ctrl) {
      const emit = (data: object) => ctrl.enqueue(sse(data));

      try {
        // ── 1. Create or reuse root folder under Box root ("0") ────────────
        emit({ type: "log", msg: `📂 Creating root folder "${rootFolderName}"...` });

        let rootFolderId: string;
        const rootCreateRes = await fetch("https://api.box.com/2.0/folders", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: rootFolderName, parent: { id: "0" } }),
        });

        if (rootCreateRes.status === 409) {
          // Already exists — extract existing ID from conflict response
          const conflict = (await rootCreateRes.json()) as {
            context_info?: { conflicts?: Array<{ id: string }> };
          };
          rootFolderId = conflict.context_info?.conflicts?.[0]?.id ?? "";
          if (!rootFolderId) throw new Error("Root folder exists but could not retrieve its ID from conflict response.");
          emit({ type: "step", msg: `  ✓ Reusing existing root folder — ID: ${rootFolderId}` });
        } else if (!rootCreateRes.ok) {
          const errText = await rootCreateRes.text();
          throw new Error(`Failed to create root folder: ${rootCreateRes.status} ${errText.slice(0, 200)}`);
        } else {
          const rootCreated = (await rootCreateRes.json()) as { id: string };
          rootFolderId = rootCreated.id;
          emit({ type: "step", msg: `  ✓ Created root folder — ID: ${rootFolderId}` });
        }

        // ── 2. Scan existing subfolders ────────────────────────────────────
        emit({ type: "log", msg: "🔍 Scanning existing subfolders..." });

        const listRes = await fetch(
          `https://api.box.com/2.0/folders/${rootFolderId}/items?fields=id,name,type&limit=100`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const listData = (await listRes.json()) as {
          entries?: Array<{ id: string; name: string; type: string }>;
        };
        const existingFolders = (listData.entries ?? []).filter((e) => e.type === "folder");

        if (existingFolders.length === 0) {
          emit({ type: "log", msg: "  (no existing subfolders found)" });
        }

        // ── 3. Delete existing subfolders ──────────────────────────────────
        for (const folder of existingFolders) {
          emit({ type: "log", msg: `🗑  Deleting "${folder.name}"...` });
          const delRes = await fetch(
            `https://api.box.com/2.0/folders/${folder.id}?recursive=true`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
          );
          if (!delRes.ok && delRes.status !== 404) {
            const errText = await delRes.text();
            emit({ type: "warn", msg: `  ⚠ Could not delete "${folder.name}": ${delRes.status} — ${errText.slice(0, 120)}` });
          } else {
            emit({ type: "step", msg: `  ✓ Deleted "${folder.name}"` });
          }
        }

        // ── 4. Create fresh subfolders ─────────────────────────────────────
        const newFolderIds: Record<string, string> = {};

        for (const name of SUBFOLDER_NAMES) {
          emit({ type: "log", msg: `📁 Creating "${name}"...` });

          const createRes = await fetch("https://api.box.com/2.0/folders", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name, parent: { id: rootFolderId } }),
          });

          if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`Failed to create "${name}": ${createRes.status} ${errText.slice(0, 160)}`);
          }

          const created = (await createRes.json()) as { id: string; name: string };
          const key = name.includes("Intake") ? "intake" : name.includes("Review") ? "review" : "signed";
          newFolderIds[key] = created.id;
          emit({ type: "step", msg: `  ✓ Created "${name}" — ID: ${created.id}` });
        }

        // ── 5. Upload file to new Intake folder ────────────────────────────
        emit({ type: "log", msg: `⬆  Uploading "${file.name}"...` });

        const { body: multipartBody, contentType } = buildMultipart(
          file.name,
          file.type,
          newFolderIds.intake,
          fileBytes,
        );

        const uploadRes = await fetch("https://upload.box.com/api/2.0/files/content", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
          body: multipartBody as unknown as BodyInit,
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          throw new Error(`Upload failed ${uploadRes.status}: ${errText.slice(0, 200)}`);
        }

        const uploadData = (await uploadRes.json()) as { entries?: Array<{ id: string; name: string }> };
        const uploadedFile = uploadData.entries?.[0];
        if (!uploadedFile) throw new Error("Upload response missing file entry");

        emit({ type: "step", msg: `  ✓ Uploaded "${uploadedFile.name}" — ID: ${uploadedFile.id}` });

        // ── 6. Update in-memory workspace registry ────────────────────────
        const existing = seededWorkspaces[VENDOR_ID];
        setWorkspaceForVendor({
          ...existing,
          rootFolderId,
          subfolders: [
            { name: "01 Intake", folderId: newFolderIds.intake },
            { name: "02 Review", folderId: newFolderIds.review },
            { name: "03 Signed", folderId: newFolderIds.signed },
          ],
        });

        emit({ type: "log", msg: "✅ Folder structure ready." });

        // ── 7. Register Box webhook on root folder ────────────────────────
        const env = getAppEnv();
        if (env.boxWebhookUrl) {
          emit({ type: "log", msg: `🔔 Registering Box webhook → ${env.boxWebhookUrl}` });
          try {
            // Delete any existing webhooks on this folder first
            const listWh = await fetch("https://api.box.com/2.0/webhooks?limit=100", {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (listWh.ok) {
              const listWhData = (await listWh.json()) as { entries?: Array<{ id: string; target?: { id: string } }> };
              for (const wh of listWhData.entries ?? []) {
                if (wh.target?.id === rootFolderId) {
                  await fetch(`https://api.box.com/2.0/webhooks/${wh.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  emit({ type: "log", msg: `  ↳ Removed old webhook ${wh.id}` });
                }
              }
            }

            const whRes = await fetch("https://api.box.com/2.0/webhooks", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                target: { id: rootFolderId, type: "folder" },
                address: env.boxWebhookUrl,
                triggers: [
                  "FILE.UPLOADED",
                  "FILE.COPIED",
                  "FILE.MOVED",
                  "FILE.RENAMED",
                  "FILE.DELETED",
                  "FILE.TRASHED",
                ],
              }),
            });

            if (whRes.ok) {
              const whData = (await whRes.json()) as { id: string };
              emit({ type: "step", msg: `  ✓ Webhook registered — ID: ${whData.id}` });
            } else {
              const errText = await whRes.text();
              emit({ type: "warn", msg: `  ⚠ Webhook registration failed: ${whRes.status} — ${errText.slice(0, 160)}` });
            }
          } catch (whErr) {
            emit({ type: "warn", msg: `  ⚠ Webhook error: ${(whErr as Error).message}` });
          }
        } else {
          emit({ type: "log", msg: "ℹ️  BOX_WEBHOOK_URL not set — skipping webhook registration." });
        }

        // ── 8. Done ────────────────────────────────────────────────────────
        emit({
          type: "done",
          fileId: uploadedFile.id,
          fileName: uploadedFile.name,
          folderIds: newFolderIds,
        });
      } catch (err) {
        emit({ type: "error", msg: (err as Error).message });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
