import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getBoxMode } from "@/lib/box/auth";
import { getSignEvent, pushSignEvent } from "@/lib/box/webhookStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sign-status?id=<signRequestId>
 *
 * First checks the in-memory webhook store (populated by Box webhook events).
 * Falls back to polling the Box Sign API directly when running in live mode.
 */
export async function GET(req: NextRequest) {
  const signRequestId = req.nextUrl.searchParams.get("id");
  if (!signRequestId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // 1. Check webhook store — fastest, no extra API call
  const stored = getSignEvent(signRequestId);
  if (stored) {
    return NextResponse.json({ status: stored.status, source: "webhook", completedAt: stored.completedAt });
  }

  // 2. Poll Box Sign API directly
  const boxMode = getBoxMode();
  if (boxMode.mock) {
    return NextResponse.json({ status: "sent", source: "demo" });
  }

  try {
    const res = await fetch(
      `https://api.box.com/2.0/sign_requests/${signRequestId}?fields=id,status,prepare_url,signers,signing_document`,
      {
        headers: { Authorization: `Bearer ${boxMode.token}` },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) {
      return NextResponse.json({ status: "unknown", source: "api_error" });
    }

    const data = (await res.json()) as {
      status?: string;
      id?: string;
      prepare_url?: string;
      signing_document?: { id?: string; name?: string };
      signers?: Array<{
        email?: string;
        role?: string;
        order?: number;
        signing_url?: string;
        embed_url?: string;
        prepare_url?: string;
        declined_at?: string;
        viewed_at?: string;
        signed_at?: string;
      }>;
    };

    // Log for debugging — visible in `npm run dev` terminal
    console.log("[sign-status] Box Sign status:", data.status);
    console.log("[sign-status] signers:", JSON.stringify(data.signers?.map(s => ({
      email: s.email, role: s.role, order: s.order,
      signing_url: s.signing_url, embed_url: s.embed_url, prepare_url: s.prepare_url,
    })), null, 2));

    // Extract per-role URLs
    const allSigners = data.signers ?? [];
    const approverSigner = allSigners.find((s) => s.role === "approver");
    const signerSigner   = allSigners.find((s) => s.role === "signer");

    const reviewerUrl =
      approverSigner?.signing_url ??
      approverSigner?.embed_url ??
      approverSigner?.prepare_url;

    const signingUrl =
      signerSigner?.signing_url ??
      signerSigner?.embed_url ??
      signerSigner?.prepare_url ??
      data.prepare_url;

    const signedFileId = data.status === "signed" ? data.signing_document?.id : undefined;

    return NextResponse.json({ status: data.status ?? "unknown", source: "api", reviewerUrl, signingUrl, signedFileId });
  } catch {
    return NextResponse.json({ status: "unknown", source: "timeout" });
  }
}

/**
 * POST /api/sign-status
 * Demo-only: manually inject a sign event so the wizard shows the success state.
 * Body: { id: string, status: string }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { id?: string; status?: string };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }
  pushSignEvent({
    signRequestId: body.id,
    status: body.status,
    completedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, signRequestId: body.id, status: body.status });
}
