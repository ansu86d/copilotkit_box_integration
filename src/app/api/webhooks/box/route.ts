import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { pushWebhookEvent, pushSignEvent } from "@/lib/box/webhookStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOX_WEBHOOK_SIGNATURE_KEY = process.env.BOX_WEBHOOK_SIGNATURE_KEY ?? "";

/**
 * Verify Box webhook HMAC-SHA256 signature.
 * If no key is configured we skip verification (dev/demo mode).
 */
function verifySignature(body: string, primary: string | null, secondary: string | null): boolean {
  if (!BOX_WEBHOOK_SIGNATURE_KEY || (!primary && !secondary)) return true;

  const hmac = crypto
    .createHmac("sha256", BOX_WEBHOOK_SIGNATURE_KEY)
    .update(body)
    .digest("base64");

  return hmac === primary || hmac === secondary;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const primary = req.headers.get("box-signature-primary");
  const secondary = req.headers.get("box-signature-secondary");

  if (!verifySignature(body, primary, secondary)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const source = (payload.source ?? {}) as Record<string, unknown>;
  const trigger = String(payload.trigger ?? payload.event_type ?? "UNKNOWN");

  // ── Handle Box Sign webhook events ────────────────────────────────────────
  if (trigger.startsWith("SIGN_REQUEST.")) {
    const signSource = source as Record<string, unknown>;
    const signerId =
      typeof payload.created_by === "object" && payload.created_by !== null
        ? String((payload.created_by as Record<string, unknown>).login ?? "")
        : undefined;
    pushSignEvent({
      signRequestId: String(signSource.id ?? payload.id ?? crypto.randomUUID()),
      status: trigger === "SIGN_REQUEST.COMPLETED" ? "signed"
        : trigger === "SIGN_REQUEST.DECLINED" ? "cancelled"
        : trigger === "SIGN_REQUEST.EXPIRED" ? "expired"
        : "sent",
      signerEmail: signerId,
      documentName: typeof signSource.name === "string" ? signSource.name : undefined,
      completedAt: typeof payload.created_at === "string" ? payload.created_at : new Date().toISOString(),
    });
  }

  pushWebhookEvent({
    id: String(payload.id ?? crypto.randomUUID()),
    eventType: trigger,
    source: {
      type: String(source.type ?? "unknown"),
      name: typeof source.name === "string" ? source.name : undefined,
      id: typeof source.id === "string" ? source.id : undefined,
    },
    createdBy:
      typeof payload.created_by === "object" && payload.created_by !== null
        ? String((payload.created_by as Record<string, unknown>).name ?? "")
        : undefined,
    createdAt: typeof payload.created_at === "string" ? payload.created_at : new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
