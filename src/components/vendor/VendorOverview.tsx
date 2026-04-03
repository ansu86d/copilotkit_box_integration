import type { VendorRecord, VendorWorkspace } from "@/types/vendor";

export function VendorOverview({ vendor, workspace }: { vendor: VendorRecord; workspace?: VendorWorkspace }) {
  return (
    <section className="panel panel--hero">
      <div className="panel__header panel__header--stacked">
        <div>
          <p className="eyebrow">Active vendor</p>
          <h2>{vendor.name}</h2>
          <p className="panel__lead">{vendor.legalName}</p>
        </div>
        <div className={`risk-pill risk-pill--${vendor.riskTier}`}>
          {vendor.riskTier} risk
        </div>
      </div>
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="muted-label">Region</span>
          <strong>{vendor.region}</strong>
        </div>
        <div className="metric-card">
          <span className="muted-label">Risk tier</span>
          <strong>{vendor.riskTier}</strong>
        </div>
        <div className="metric-card">
          <span className="muted-label">Owner</span>
          <strong>{vendor.owner}</strong>
        </div>
        <div className="metric-card">
          <span className="muted-label">Workspace</span>
          <strong>{workspace?.rootFolderId ?? "Not created"}</strong>
        </div>
      </div>
    </section>
  );
}
