import type { FileRequestPayload } from "@/types/copilot";

export function FileRequestCard({ payload }: { payload: FileRequestPayload }) {
  return (
    <section className="tool-card tool-card--accent">
      <p className="tool-card__label">Intake upload link</p>
      <h3>{payload.vendorName}</h3>
      <p className="tool-card__lead">{payload.title}</p>
      <div className="file-request-card__meta">
        <span className={`risk-pill risk-pill--${payload.source === "box" ? "low" : "medium"}`}>
          {payload.source === "box" ? "live box request" : "demo request"}
        </span>
        <a className="ghost-button file-request-card__link" href={payload.url} target="_blank" rel="noreferrer">
          Open intake form
        </a>
      </div>
      {payload.note ? <p className="file-request-card__note">{payload.note}</p> : null}
    </section>
  );
}