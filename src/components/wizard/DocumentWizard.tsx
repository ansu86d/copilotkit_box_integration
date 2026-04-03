"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── constants ────────────────────────────────────────────────────────────────
const DEFAULT_FOLDER_IDS = {
  intake: "374620739067",
  review: "374620489799",
  signed: "374622009556",
};

const SIGNER_EMAIL        = "ansatapathy@deloitte.com";
const SIGNER_NAME         = "Ansuman Satapathy";
const DEFAULT_REVIEWER_EMAIL = "john.doe@acme-logistics.com";
const DEFAULT_REVIEWER_NAME  = "John Doe";
const VENDOR_ID           = "vendor-acme-logistics";

const DEFAULT_FILL_CONTENT =
  "Company Name: ACME Corporation, Address: 456 Industrial Parkway Suite 300 Chicago IL 60607, " +
  "Phone: 312-555-0200, Fax: 312-555-0201, Email: procurement@acmecorp.com, Website: www.acmecorp.com, " +
  "Contact: Robert Chen - Director of Vendor Relations, Contact Email: r.chen@acmecorp.com, " +
  "Contact Phone 1: 312-555-0202, Contact Phone 2: 312-555-0203, " +
  "Services: Industrial hardware components precision machined parts and MRO supplies for manufacturing and construction sectors, " +
  "Established: March 15 1998, Annual Sales: $14500000, Geographic Service Area: Midwest US IL IN WI MN OH, " +
  "Legal Structure: C-Corp, Business Type: Manufacturer Distributor, Years Registered: 6, " +
  "Insured: Yes, Bonded: Yes, Licensed: Yes, License Number: IL-MFG-2024-00847, " +
  "Additional Info: ISO 9001:2015 certified MWBE certified vendor MW-2023-4412, " +
  "Bank Name: First Midwest Bank, Bank Address: 1200 N Michigan Ave Chicago IL 60601, " +
  "Beneficiary Name: ACME Corporation, Account Number: 4471-8823-0056, " +
  "Printed Name: Robert Chen, Title: Director of Vendor Relations, Date: April 3 2026";

const STEPS = ["Upload", "Fill PDF", "In Review", "Sign", "Signing", "Done"];

const FILL_STEP_LABELS: Record<string, string> = {
  map_fields:     "Extract & map content",
  fill_pdf:       "Fill PDF form (pypdf)",
  upload_intake:  "Upload to intake folder",
  move_to_review: "Move to review folder",
};

type FillStepStatus = "pending" | "in_progress" | "completed" | "error";

interface FillStep {
  id: string;
  status: FillStepStatus;
  detail: string;
}

const FILL_STEP_INIT: FillStep[] = [
  { id: "map_fields",    status: "pending", detail: "Waiting…" },
  { id: "fill_pdf",      status: "pending", detail: "Waiting…" },
  { id: "upload_intake", status: "pending", detail: "Waiting…" },
  { id: "move_to_review", status: "pending", detail: "Waiting…" },
];

const TERMINAL_SIGN = new Set(["signed", "cancelled", "expired", "error"]);

// ─── types ────────────────────────────────────────────────────────────────────
type DocLocation = { folderId: string; folderName: string } | null;

interface FolderIds {
  intake: string;
  review: string;
  signed: string;
}

interface SignedFolderFile {
  id: string;
  name: string;
  size?: number;
  modified_at?: string;
}

interface WizardState {
  step: number;           // 0-5
  fileId: string | null;
  fileName: string | null;
  companyName: string;
  fillContent: string;
  reviewerUrl: string;
  signingUrl: string;
  signedFileId: string | null;
  signedFolderFiles: SignedFolderFile[] | null;
  signRequestId: string | null;
  signStatus: string;
  reviewerName: string;
  reviewerEmail: string;
  loading: boolean;
  error: string | null;
  folderIds: FolderIds;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
async function pollDocLocation(fileId: string): Promise<DocLocation> {
  const res = await fetch("/api/box-live?vendorId=" + VENDOR_ID);
  if (!res.ok) return null;
  const data = await res.json() as {
    folders?: Array<{ folderId: string; name: string; items: Array<{ id: string }> }>;
  };
  for (const folder of data.folders ?? []) {
    if (folder.items?.some((i) => i.id === fileId)) {
      return { folderId: folder.folderId, folderName: folder.name };
    }
  }
  return null;
}

// ─── component ────────────────────────────────────────────────────────────────
type SetupEvent = { type: string; msg: string };

export function DocumentWizard() {
  const [state, setState] = useState<WizardState>({
    step: 0, fileId: null, fileName: null,
    companyName: "",
    fillContent: DEFAULT_FILL_CONTENT,
    reviewerUrl: "", signingUrl: "", signedFileId: null, signedFolderFiles: null, signRequestId: null, signStatus: "",
    reviewerName: DEFAULT_REVIEWER_NAME,
    reviewerEmail: DEFAULT_REVIEWER_EMAIL,
    loading: false, error: null,
    folderIds: DEFAULT_FOLDER_IDS,
  });
  const [fillSteps, setFillSteps] = useState<FillStep[]>(FILL_STEP_INIT);
  const [docLocation, setDocLocation] = useState<DocLocation>(null);
  const [webhookEvents, setWebhookEvents] = useState<Array<{ eventType: string; source: { name?: string }; createdAt: string }>>([]);
  const [setupLog, setSetupLog] = useState<SetupEvent[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const set = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));

  // Poll live webhook events only — folder location is derived from wizard step
  useEffect(() => {
    if (!state.fileId) return;
    const poll = async () => {
      const liveRes = await fetch("/api/box-live?vendorId=" + VENDOR_ID).catch(() => null);
      if (liveRes?.ok) {
        const data = await liveRes.json() as { recentEvents?: typeof webhookEvents };
        if (data.recentEvents) setWebhookEvents(data.recentEvents.slice(0, 5));
      }
    };
    void poll();
    pollRef.current = setInterval(() => void poll(), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fileId]);

  // Poll sign status on Signing step — keep going until signed then advance to Done
  useEffect(() => {
    if (state.step !== 4 || !state.signRequestId) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/sign-status?id=${encodeURIComponent(stateRef.current.signRequestId!)}`);
        if (res.ok) {
          const data = await res.json() as { status?: string; reviewerUrl?: string; signingUrl?: string; signedFileId?: string };
          const patch: Partial<WizardState> = {};
          if (data.reviewerUrl && !stateRef.current.reviewerUrl) patch.reviewerUrl = data.reviewerUrl;
          if (data.signingUrl && !stateRef.current.signingUrl) patch.signingUrl = data.signingUrl;
          if (data.status) patch.signStatus = data.status;
          if (Object.keys(patch).length) set(patch);

          // Advance to Done step when signed
          if (data.status === "signed") {
            set({ step: 5, signStatus: "signed", signedFileId: data.signedFileId ?? null });
            setDocLocation({ folderId: stateRef.current.folderIds.signed, folderName: "03 Signed" });
            return;
          }
          // Stop polling (but stay on step) for other terminal statuses
          if (data.status && TERMINAL_SIGN.has(data.status)) return;
        }
      } catch { /* silent */ }
      // Keep polling every 2s
      if (!cancelled) {
        signPollRef.current = setTimeout(poll, 2000) as unknown as ReturnType<typeof setInterval>;
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (signPollRef.current) clearTimeout(signPollRef.current as unknown as ReturnType<typeof setTimeout>);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.signRequestId]);

  // On Done step — resolve signedFileId if missing (e.g. after Simulate Signed or missed poll)
  useEffect(() => {
    if (state.step !== 5 || !state.signRequestId || state.signedFileId) return;
    const resolve = async () => {
      try {
        const res = await fetch(`/api/sign-status?id=${encodeURIComponent(state.signRequestId!)}`);
        if (res.ok) {
          const data = await res.json() as { signedFileId?: string };
          if (data.signedFileId) set({ signedFileId: data.signedFileId });
        }
      } catch { /* silent */ }
    };
    void resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.signRequestId]);

  // On Done step — load all files from the signed folder
  useEffect(() => {
    if (state.step !== 5 || state.signedFolderFiles) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/box-folder-items?folderId=${encodeURIComponent(stateRef.current.folderIds.signed)}`);
        if (res.ok) {
          const data = await res.json() as { items?: SignedFolderFile[] };
          set({ signedFolderFiles: data.items ?? [] });
        }
      } catch { /* silent */ }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  // Auto-scroll setup log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [setupLog]);

  // ── Step 0: Upload ──────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (file: File) => {
    set({ loading: true, error: null });
    setSetupLog([]);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("companyName", stateRef.current.companyName.trim() || "Vendor Onboarding");
    try {
      const res = await fetch("/api/box-setup", { method: "POST", body: fd });
      if (!res.ok || !res.body) throw new Error(`Setup failed: ${(await res.text()).slice(0, 200)}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.startsWith("data: ") ? chunk.slice(6).trim() : chunk.trim();
          if (!line) continue;
          let event: { type: string; msg?: string; fileId?: string; fileName?: string; folderIds?: FolderIds; error?: string };
          try { event = JSON.parse(line); } catch { continue; }

          if (event.type === "done") {
            setSetupLog((prev) => [...prev, { type: "done", msg: "✅ Setup complete" }]);
            set({
              fileId: event.fileId!,
              fileName: event.fileName!,
              folderIds: event.folderIds ?? DEFAULT_FOLDER_IDS,
              step: 1,
              loading: false,
            });
            setDocLocation({ folderId: event.folderIds?.intake ?? DEFAULT_FOLDER_IDS.intake, folderName: "01 Intake" });
            return;
          } else if (event.type === "error") {
            setSetupLog((prev) => [...prev, { type: "error", msg: event.msg ?? "Unknown error" }]);
            set({ error: event.msg ?? "Setup failed", loading: false });
            return;
          } else {
            setSetupLog((prev) => [...prev, { type: event.type, msg: event.msg ?? "" }]);
          }
        }
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  }, [handleFileSelect]);

  // ── Step 1: Fill PDF ────────────────────────────────────────────────────────
  const fillPdf = async () => {
    if (!state.fillContent.trim()) {
      set({ error: "Please enter some vendor content to fill the PDF." });
      return;
    }
    set({ loading: true, error: null });
    setFillSteps(FILL_STEP_INIT);

    try {
      const response = await fetch("/api/fill-intake-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vendorId: VENDOR_ID, content: state.fillContent }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Fill PDF failed: ${(await response.text()).slice(0, 200)}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: { reviewFileId?: string; fileName?: string } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as
              | { type: "step"; stepId: string; status: FillStepStatus; detail: string }
              | { type: "result"; data: { reviewFileId: string; fileName: string } };

            if (event.type === "step") {
              setFillSteps((prev) =>
                prev.map((s) => s.id === event.stepId ? { ...s, status: event.status, detail: event.detail } : s),
              );
            } else if (event.type === "result") {
              result = event.data;
            }
          } catch { /* skip malformed */ }
        }
      }

      if (result) {
        set({
          fileId: result.reviewFileId ?? stateRef.current.fileId,
          fileName: result.fileName ?? stateRef.current.fileName,
          step: 2,
          loading: false,
        });
        setDocLocation({ folderId: stateRef.current.folderIds.review, folderName: "02 Review" });
      } else {
        set({ loading: false });
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  };

  // ── Step 3: Send for Signature ──────────────────────────────────────────────
  const sendForSign = async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/box-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signWizard",
          input: {
            fileId: stateRef.current.fileId!,
            signerEmail: SIGNER_EMAIL,
            signerName: SIGNER_NAME,
            reviewerEmail: stateRef.current.reviewerEmail,
            reviewerName: stateRef.current.reviewerName,
            reviewFolderId: stateRef.current.folderIds.review,
            signedFolderId: stateRef.current.folderIds.signed,
          },
        }),
      });
      const data = await res.json() as { signRequestId?: string; status?: string; reviewerUrl?: string; signingUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sign request failed");
      set({
        signRequestId: data.signRequestId!,
        signStatus: data.status ?? "converting",
        reviewerUrl: data.reviewerUrl ?? "",
        signingUrl: data.signingUrl ?? "",
        step: 4,
        loading: false,
      });
      setDocLocation({ folderId: stateRef.current.folderIds.review, folderName: "02 Review" });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  };

  const reset = () => {
    setState({
      step: 0, fileId: null, fileName: null,
      companyName: "",
      fillContent: DEFAULT_FILL_CONTENT,
      reviewerUrl: "", signingUrl: "", signedFileId: null, signedFolderFiles: null, signRequestId: null, signStatus: "",
      reviewerName: DEFAULT_REVIEWER_NAME,
      reviewerEmail: DEFAULT_REVIEWER_EMAIL,
      loading: false, error: null, folderIds: DEFAULT_FOLDER_IDS,
    });
    setFillSteps(FILL_STEP_INIT);
    setDocLocation(null);
    setWebhookEvents([]);
    setSetupLog([]);
  };

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="wizard-root">
      {/* Header */}
      <header className="wizard-header">
        <span className="wizard-logo">📦 Box Vendor Doc Wizard</span>

      </header>

      {/* Step indicator */}
      <nav className="wizard-steps">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`wizard-step ${i < state.step ? "done" : i === state.step ? "active" : "pending"}`}
          >
            <span className="wizard-step__circle">
              {i < state.step ? "✓" : i + 1}
            </span>
            <span className="wizard-step__label">{label}</span>
            {i < STEPS.length - 1 && <span className="wizard-step__line" />}
          </div>
        ))}
      </nav>

      {/* Step content */}
      <main className="wizard-body">
        {state.error && (
          <div className="wizard-error">⚠ {state.error}</div>
        )}

        {/* ── Step 0: Upload ── */}
        {state.step === 0 && (
          <div className="wizard-card">
            <h2>Upload a Document</h2>

            {!state.loading && setupLog.length === 0 && (
              <>
                <div className="wizard-field">
                  <label className="wizard-field-label" htmlFor="company-name-input">Company Name</label>
                  <input
                    id="company-name-input"
                    className="wizard-field-input"
                    type="text"
                    placeholder="e.g. ACME Corporation"
                    value={state.companyName}
                    onChange={(e) => set({ companyName: e.target.value })}
                    autoFocus
                  />
                </div>
                <p style={{ marginTop: 0 }}>Drop your document below — Box folders will be created under this company name.</p>
                <div
                  className={`drop-zone ${dragging ? "drop-zone--over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="drop-zone__icon">📄</span>
                  <span>Drop a file or click to browse</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFileSelect(f); }}
                />
              </>
            )}

            {(state.loading || setupLog.length > 0) && (
              <div className="setup-log">
                <div className="setup-log__title">
                  {state.loading
                    ? <><span className="wizard-spinner setup-log__spinner" /> Setting up Box folders…</>
                    : "Setup log"}
                </div>
                <div className="setup-log__body">
                  {setupLog.map((ev, i) => (
                    <div key={i} className={`setup-log__line setup-log__line--${ev.type}`}>
                      {ev.msg}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 1: Fill PDF ── */}
        {state.step === 1 && (
          <div className="wizard-card">
            <h2>Fill Intake PDF</h2>
            <div className="wizard-file-chip">📄 {state.fileName} — in 01 Intake</div>
            <p>Enter vendor details below. The AI will extract fields and fill the intake PDF — it will stay in intake until you send for signature.</p>

            {!state.loading && (
              <>
                <textarea
                  className="wizard-content-input"
                  rows={8}
                  placeholder={`e.g. Company Name: Acme Logistics, Address: 123 Main St Chicago IL 60601, Phone: 312-555-0100, Email: info@acme-logistics.com, Website: acme-logistics.com, Contact: John Smith - VP Operations, Contact Email: jsmith@acme-logistics.com, Services: Freight forwarding and last-mile delivery, Established: 2004, Annual Sales: $8M, Legal Structure: LLC`}
                  value={state.fillContent}
                  onChange={(e) => set({ fillContent: e.target.value, error: null })}
                />
                <button
                  className="wizard-btn"
                  onClick={() => void fillPdf()}
                  disabled={!state.fillContent.trim()}
                >
                  Fill &amp; Upload PDF →
                </button>
              </>
            )}

            {state.loading && (
              <ul className="wizard-fill-steps">
                {fillSteps.map((step) => (
                  <li key={step.id} className={`wizard-fill-step wizard-fill-step--${step.status}`}>
                    <span className="wizard-fill-step__icon">
                      {step.status === "completed"
                        ? "✓"
                        : step.status === "error"
                        ? "✗"
                        : step.status === "in_progress"
                        ? <span className="wizard-spinner wizard-spinner--sm" />
                        : "○"}
                    </span>
                    <span>
                      <strong>{FILL_STEP_LABELS[step.id] ?? step.id}</strong>
                      <span className="wizard-fill-step__detail"> — {step.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Step 2: In Review ── */}
        {state.step === 2 && (
          <div className="wizard-card">
            <h2>Filled PDF is in Review</h2>
            <div className="wizard-file-chip">📄 {state.fileName}</div>
            <p>The intake PDF has been filled and moved to <strong>02 Review</strong>.</p>
            <div className="wizard-folder-journey">
              <span className="folder-node done">01 Intake</span>
              <span className="folder-arrow">→</span>
              <span className="folder-node active">02 Review</span>
              <span className="folder-arrow muted">→</span>
              <span className="folder-node muted">03 Signed</span>
            </div>
            <div className="wizard-review-confirm">
              <span className="wizard-review-tick">✓</span> Confirmed — file is in 02 Review
            </div>
            <button className="wizard-btn" onClick={() => set({ step: 3, reviewerName: state.reviewerName, reviewerEmail: state.reviewerEmail })}>
              Proceed to Sign →
            </button>
          </div>
        )}

        {/* ── Step 3: Sign ── */}
        {state.step === 3 && (
          <div className="wizard-card">
            <h2>Send for Signature</h2>
            <div className="wizard-file-chip">📄 {state.fileName}</div>
            <p>Send the review copy for signature via Box Sign.</p>
            <div className="wizard-signers">
              <div className="signer-row">
                <span className="signer-badge signer">✍️ Signer</span>
                <span><strong>{SIGNER_NAME}</strong> <span className="signer-email">{SIGNER_EMAIL}</span></span>
              </div>
              <div className="signer-row">
                <span className="signer-badge reviewer">👁 Reviewer</span>
                <span className="signer-reviewer-inputs">
                  <input
                    className="wizard-field-input wizard-field-input--sm"
                    type="text"
                    placeholder="Reviewer Name"
                    value={state.reviewerName}
                    onChange={(e) => set({ reviewerName: e.target.value })}
                  />
                  <input
                    className="wizard-field-input wizard-field-input--sm"
                    type="email"
                    placeholder="reviewer@company.com"
                    value={state.reviewerEmail}
                    onChange={(e) => set({ reviewerEmail: e.target.value })}
                  />
                </span>
              </div>
            </div>
            <div className="wizard-folder-journey">
              <span className="folder-node done">01 Intake</span>
              <span className="folder-arrow">→</span>
              <span className="folder-node done">02 Review</span>
              <span className="folder-arrow">→</span>
              <span className="folder-node next">03 Signed</span>
            </div>
            <button className="wizard-btn" onClick={() => void sendForSign()} disabled={state.loading}>
              {state.loading ? <span className="wizard-spinner" /> : "Send for Signature →"}
            </button>
          </div>
        )}

        {/* ── Step 4: Signing (awaiting signature) ── */}
        {state.step === 4 && (
          <div className="wizard-card">
            <div className="done-icon">✍️</div>
            <h2>Awaiting Signature</h2>
            <div className="wizard-file-chip">📄 {state.fileName}</div>

            <div className="done-details">
              <div className="done-row">
                <span>Status</span>
                <strong>
                  <span className="live-dot" style={{ display: "inline-block", marginRight: 6 }} />
                  {state.signStatus || "converting"}
                </strong>
              </div>
              <div className="done-row"><span>Request ID</span><code>{state.signRequestId}</code></div>
              <div className="done-row"><span>Signer</span><strong>{SIGNER_NAME}</strong></div>
              <div className="done-row"><span>Reviewer</span><strong>{state.reviewerName}</strong></div>
              <div className="done-row"><span>Destination</span><strong>03 Signed</strong></div>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {(state.reviewerUrl || state.signingUrl) ? (
                <>
                  {state.reviewerUrl && (
                    <div className="wizard-sign-action">
                      <a
                        href={state.reviewerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wizard-sign-btn wizard-sign-btn--reviewer"
                      >
                        Review the document → click here
                      </a>
                    </div>
                  )}
                  {state.signingUrl && (
                    <div className="wizard-sign-action">
                      <a
                        href={state.signingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wizard-sign-btn"
                      >
                        Sign the document → click here
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="wizard-sign-hint" style={{ marginBottom: 8 }}>
                  <span className="live-dot" style={{ display: "inline-block", marginRight: 6 }} />
                  Preparing signing links…
                </p>
              )}
            </div>

            {state.signRequestId && (
              <button
                className="wizard-btn wizard-btn--ghost"
                style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}
                onClick={async () => {
                  await fetch("/api/sign-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: state.signRequestId, status: "signed" }),
                  });
                  set({ signStatus: "signed", step: 5, signedFileId: null });
                  setDocLocation({ folderId: stateRef.current.folderIds.signed, folderName: "03 Signed" });
                }}
              >
                ✅ Simulate Signed (Demo)
              </button>
            )}
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {state.step === 5 && (
          <div className="wizard-card wizard-card--done">
            <div className="done-icon">🎉</div>
            <h2>Signature Complete!</h2>
            <div className="wizard-file-chip">📄 {state.fileName}</div>
            <div className="wizard-success-banner">
              <span className="wizard-success-icon">✓</span>
              <span>Document signed successfully — saved to <strong>03 Signed</strong>.</span>
            </div>

            <div className="done-details">
              <div className="done-row">
                <span>Status</span>
                <strong className="done-status--signed">signed</strong>
              </div>
              <div className="done-row"><span>Request ID</span><code>{state.signRequestId}</code></div>
              <div className="done-row"><span>Signer</span><strong>{SIGNER_NAME}</strong></div>
              <div className="done-row"><span>Reviewer</span><strong>{state.reviewerName}</strong></div>
              <div className="done-row"><span>Destination</span><strong>03 Signed</strong></div>
            </div>

            {/* ── Files in Signed folder ── */}
            <div className="signed-folder-section">
              <div className="signed-folder-title">📁 Files in 03 Signed</div>
              {state.signedFolderFiles === null && (
                <div className="signed-folder-loading">
                  <span className="wizard-spinner" style={{ width: 14, height: 14, marginRight: 6 }} />
                  Loading files…
                </div>
              )}
              {state.signedFolderFiles !== null && state.signedFolderFiles.length === 0 && (
                <div className="signed-folder-empty">No files found in the signed folder.</div>
              )}
              {state.signedFolderFiles !== null && state.signedFolderFiles.length > 0 && (
                <ul className="signed-folder-list">
                  {state.signedFolderFiles.map((file) => (
                    <li key={file.id} className="signed-folder-item">
                      <a
                        href={`/api/box-download?fileId=${encodeURIComponent(file.id)}`}
                        className="done-download-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        ⬇️ {file.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button className="wizard-btn wizard-btn--ghost" style={{ marginTop: 16 }} onClick={reset}>
              Start Over
            </button>
          </div>
        )}
      </main>

      {/* Live status panel */}
      {state.fileId && (
        <aside className="wizard-live">
          <div className="wizard-live__title">
            <span className="live-dot" /> Live Status
          </div>
          {docLocation && (
            <div className="live-folder-pill live-folder-pill--active" style={{ marginBottom: 8 }}>
              📂 File in <strong>{docLocation.folderName}</strong>
            </div>
          )}
          {webhookEvents.length > 0 && (
            <div className="wizard-live__events">
              <div className="wizard-live__events-title">Webhook Events</div>
              {webhookEvents.map((ev, i) => (
                <div key={i} className="live-event-row">
                  <span className="live-event-type">{ev.eventType}</span>
                  {ev.source.name && <span className="live-event-name">{ev.source.name}</span>}
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

