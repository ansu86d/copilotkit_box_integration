"use client";

import { useEffect, useRef, useState } from "react";

import type { SignRequestPayload } from "@/types/copilot";

const STATUS_LABELS: Record<string, string> = {
  converting: "Preparing document…",
  created: "Sent",
  sent: "Awaiting signature",
  viewed: "Viewed by signer",
  signed: "Signed ✓",
  cancelled: "Cancelled",
  error: "Error",
  expired: "Expired",
};

const TERMINAL = new Set(["signed", "cancelled", "error", "expired"]);

type PollData = { status?: string; signingUrl?: string };

export function SignRequestCard({ payload }: { payload: SignRequestPayload }) {
  const [status, setStatus] = useState(payload.status);
  const [signingUrl, setSigningUrl] = useState(payload.signingUrl ?? "");
  const [checking, setChecking] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!payload.signRequestId || payload.source !== "box") return;
    // Don't start polling if already in terminal state
    if (TERMINAL.has(statusRef.current)) return;

    const poll = async () => {
      setChecking(true);
      try {
        const res = await fetch(
          `/api/sign-status?id=${encodeURIComponent(payload.signRequestId)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as PollData;
          if (data.status) setStatus(data.status);
          // Pick up signingUrl the moment Box finishes processing the document
          if (data.signingUrl) setSigningUrl(data.signingUrl);
        }
      } catch {
        // silent — offline fallback
      } finally {
        setChecking(false);
      }
    };

    void poll();

    // Poll every 3 seconds: fast enough to catch "signed" immediately after clicking
    const id = setInterval(() => {
      if (TERMINAL.has(statusRef.current)) {
        clearInterval(id);
        return;
      }
      void poll();
    }, 3_000);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.signRequestId, payload.source]);

  const statusLabel = STATUS_LABELS[status] ?? status;
  const isLive = payload.source === "box";
  const isSigned = status === "signed";
  const isPreparing = status === "converting" || status === "created";

  return (
    <section className={`tool-card tool-card--sign${isSigned ? " tool-card--signed" : ""}`}>
      <p className="tool-card__label">
        {isLive ? "Live Box Sign request" : "Sign request (demo)"}
        {checking && !isSigned && <span className="sign-polling-dot" />}
      </p>
      <h3>{payload.vendorName}</h3>
      <p className="tool-card__lead">
        Signature request sent for <strong>{payload.documentName}</strong>.
      </p>

      <div className="sign-request-meta">
        <div className="sign-request-row">
          <span className="muted-label">Signer</span>
          <strong>{payload.signerEmail}</strong>
        </div>
        <div className="sign-request-row">
          <span className="muted-label">Status</span>
          <span className={`status-chip status-chip--${isSigned ? "approved" : "under_review"}`}>
            {statusLabel}
          </span>
        </div>
        {payload.signRequestId && (
          <div className="sign-request-row">
            <span className="muted-label">Request ID</span>
            <code className="sign-request-id">{payload.signRequestId.slice(0, 8)}</code>
          </div>
        )}
      </div>

      {isSigned ? (
        <div className="sign-complete-banner">
          <span className="sign-complete-banner__icon">✓</span>
          <span>Signature complete — document saved to <strong>03 Signed</strong> folder.</span>
        </div>
      ) : signingUrl ? (
        <div className="sign-action-row">
          <a
            href={signingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sign-now-btn"
          >
            Sign Now →
          </a>
          <span className="sign-action-hint">Opens Box Sign in a new tab</span>
        </div>
      ) : isLive && isPreparing ? (
        <p className="sign-action-hint" style={{ marginTop: "14px" }}>
          <span className="sign-polling-dot" style={{ marginRight: 6 }} />
          Preparing signing link — this takes a few seconds…
        </p>
      ) : isLive ? (
        <p className="sign-action-hint" style={{ marginTop: "14px" }}>
          Signing link will appear here automatically.
        </p>
      ) : null}
    </section>
  );
}
