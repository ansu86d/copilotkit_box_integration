import type { ActivityTimelinePayload } from "@/types/copilot";

export function ActivityTimeline({ payload }: { payload: ActivityTimelinePayload }) {
  return (
    <section className="tool-card">
      <p className="tool-card__label">Audit timeline</p>
      <h3>{payload.vendorName}</h3>
      <ol className="timeline">
        {payload.items.map((item) => (
          <li key={item.id}>
            <span className="timeline__time">{new Date(item.timestamp).toLocaleString()}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <small>{item.actor}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
