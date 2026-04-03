import type { VendorDocument } from "@/types/vendor";

export function DocumentTable({ documents }: { documents: VendorDocument[] }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Document control</p>
          <h3>Document package</h3>
        </div>
        <span className="panel__badge">{documents.length} tracked items</span>
      </div>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Reviewer</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>{document.name}</td>
                <td>{document.type}</td>
                <td>
                  <span className={`status-chip status-chip--${document.status}`}>{document.status}</span>
                </td>
                <td>{document.reviewer ?? "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
