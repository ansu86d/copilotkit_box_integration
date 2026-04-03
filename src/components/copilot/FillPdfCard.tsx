import type { FillPdfStep } from "@/types/copilot";

interface FillPdfCardProps {
  steps: FillPdfStep[];
  fileName?: string;
  reviewFileId?: string;
  source?: "box" | "demo";
}

const STEP_LABELS: Record<string, string> = {
  map_fields: "Extract & map content",
  fill_pdf: "Fill PDF form (pypdf)",
  upload_intake: "Upload to intake folder",
  copy_review: "Create file in review folder",
};

export function FillPdfCard({ steps, fileName, reviewFileId, source }: FillPdfCardProps) {
  const isDone = steps.length > 0 && steps.every((s) => s.status === "completed" || s.status === "error");

  return (
    <section className="tool-card tool-card--accent">
      <p className="tool-card__label">intake → review</p>
      <h3>Fill &amp; Move Intake PDF</h3>
      {fileName && <p className="tool-card__lead">{fileName}</p>}

      <ul className="tool-list">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`tool-list__item tool-list__item--${step.status}`}
            style={{ "--step-index": i } as React.CSSProperties}
          >
            <strong>{STEP_LABELS[step.id] ?? step.id}</strong>
            <span>{step.detail}</span>
          </li>
        ))}

        {/* Placeholder rows while steps arrive */}
        {steps.length === 0 &&
          Object.entries(STEP_LABELS).map(([id, label]) => (
            <li key={id} className="tool-list__item tool-list__item--pending">
              <strong>{label}</strong>
              <span>Waiting…</span>
            </li>
          ))}
      </ul>

      {isDone && reviewFileId && (
        <div className="fill-pdf-card__result">
          <span className="fill-pdf-card__badge">{source === "box" ? "Live" : "Demo"}</span>
          <span>
            Review file id: <code>{reviewFileId}</code>
          </span>
        </div>
      )}
    </section>
  );
}
