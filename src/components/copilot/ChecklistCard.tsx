import type { ChecklistPayload } from "@/types/copilot";

export function ChecklistCard({ payload }: { payload: ChecklistPayload }) {
  return (
    <section className="tool-card">
      <p className="tool-card__label">Required documents</p>
      <h3>{payload.vendorName}</h3>
      <div className="checklist-grid">
        <div>
          <h4>Received</h4>
          <ul className="simple-list">
            {payload.received.map((document) => (
              <li key={document.label}>
                <span>{document.label}</span>
                <strong>{document.status}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Missing or blocked</h4>
          <ul className="simple-list simple-list--alert">
            {payload.missing.map((document) => (
              <li key={document.type}>
                <span>{document.label}</span>
                <strong>{document.reason}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
