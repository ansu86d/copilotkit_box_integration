import type { PlanPayload } from "@/types/copilot";

export function PlanCard({ plan }: { plan: PlanPayload }) {
  return (
    <section className="tool-card">
      <p className="tool-card__label">Execution plan</p>
      <h3>{plan.vendorName}</h3>
      <p className="tool-card__lead">{plan.summary}</p>
      <ul className="tool-list">
        {plan.steps.map((step) => (
          <li key={step.title} className={`tool-list__item tool-list__item--${step.status}`}>
            <strong>{step.title}</strong>
            <span>{step.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
