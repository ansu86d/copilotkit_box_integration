import type { MissingDocument } from "@/types/vendor";

export function MissingDocsPanel({ missing }: { missing: MissingDocument[] }) {
  return (
    <section className="panel panel--warning">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Attention needed</p>
          <h3>Blockers</h3>
        </div>
        <span className="panel__badge panel__badge--warning">{missing.length} open</span>
      </div>
      <ul className="simple-list simple-list--alert">
        {missing.map((document) => (
          <li key={document.type}>
            <span>{document.label}</span>
            <strong>{document.reason}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
