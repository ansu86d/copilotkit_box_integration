import type { ApprovalPayload } from "@/types/copilot";

export function ApprovalCard({ payload }: { payload: ApprovalPayload }) {
  return (
    <section className="tool-card tool-card--warning">
      <p className="tool-card__label">Approval required</p>
      <h3>{payload.title}</h3>
      <p className="tool-card__lead">{payload.reason}</p>
      <div className="approval-row">
        <span className={`risk-pill risk-pill--${payload.riskLevel}`}>{payload.riskLevel} risk</span>
        <button type="button" className="ghost-button">
          {payload.actionLabel}
        </button>
      </div>
    </section>
  );
}
