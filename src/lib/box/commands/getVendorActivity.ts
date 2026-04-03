import type { VendorActivity } from "@/types/vendor";

import { getSeededVendor } from "@/lib/demo/seedData";
import { runBoxCommand } from "@/lib/box/runBoxCommand";

export async function getVendorActivity(vendorId: string): Promise<VendorActivity[]> {
  const vendor = getSeededVendor(vendorId);

  // Build a date 2 weeks ago in ISO format (Box CLI requires ISO 8601)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  type BoxEvent = {
    event_id?: string;
    id?: string;
    event_type?: string;
    created_at?: string;
    created_by?: { name?: string; login?: string };
    source?: { name?: string; type?: string; id?: string };
  };

  const result = await runBoxCommand<{ entries?: BoxEvent[] } | BoxEvent[]>(
    ["events", "--created-after", twoWeeksAgo, "--limit", "20"],
    { entries: vendor.activity as unknown as BoxEvent[] },
  );

  if (!result.mock && result.data) {
    const raw = result.data;
    const entries: BoxEvent[] = Array.isArray(raw)
      ? (raw as BoxEvent[])
      : ((raw as { entries?: BoxEvent[] }).entries ?? []);

    if (entries.length > 0) {
      return entries.map((event, idx): VendorActivity => ({
        id: event.event_id ?? event.id ?? `evt-live-${idx}`,
        timestamp: event.created_at ?? new Date().toISOString(),
        title: event.event_type ?? "Box Event",
        detail: event.source?.name
          ? `${event.source.name}${event.source.type ? ` (${event.source.type})` : ""}`
          : (event.event_type ?? "Activity recorded"),
        actor: event.created_by?.name ?? event.created_by?.login ?? "Box",
        source: "box",
      }));
    }
  }

  return vendor.activity;
}
