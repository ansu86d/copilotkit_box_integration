import type { StatusSummaryPayload } from "@/types/copilot";

export function StatusSummaryCard({ payload }: { payload: StatusSummaryPayload }) {
  return (
    <section className="tool-card tool-card--accent">
      <p className="tool-card__label">Onboarding status</p>
      <h3>{payload.vendorName}</h3>
      <p className="tool-card__lead">{payload.headline}</p>
      <div className="status-summary-grid">
        <div>
          <span className="muted-label">Phase</span>
          <strong>{payload.phase}</strong>
        </div>
        <div>
          <span className="muted-label">Next action</span>
          <strong>{payload.nextAction}</strong>
        </div>
        {payload.workspace ? (
          <div>
            <span className="muted-label">Root folder</span>
            <strong>{payload.workspace.rootFolderId}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}
