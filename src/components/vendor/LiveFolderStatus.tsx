"use client";

import { useCallback, useEffect, useState } from "react";

import type { VendorWorkspace } from "@/types/vendor";

interface BoxItem {
  id: string;
  name: string;
  type: "file" | "folder";
  size?: number;
  modified_at?: string;
}

interface FolderData {
  name: string;
  folderId: string;
  items: BoxItem[];
}

interface WebhookEvent {
  id: string;
  eventType: string;
  source: { type: string; name?: string };
  createdBy?: string;
  createdAt: string;
}

interface SignEvent {
  signRequestId: string;
  status: string;
  signerEmail?: string;
  documentName?: string;
  completedAt: string;
}

interface LiveData {
  updatedAt: string;
  folders: FolderData[];
  recentEvents: WebhookEvent[];
  latestSignEvent: SignEvent | null;
}

const POLL_MS = 18_000;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function LiveFolderStatus({ workspace }: { workspace?: VendorWorkspace }) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  const vendorId = workspace?.vendorId ?? "vendor-acme-logistics";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/box-live?vendorId=${encodeURIComponent(vendorId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as LiveData;
        setData(json);
        setLastFetch(new Date().toLocaleTimeString());
      }
    } catch {
      // silent fail — network may be offline
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  // Initial fetch + polling
  useEffect(() => {
    void fetchData();
    const id = setInterval(() => void fetchData(), POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const totalItems = data?.folders.reduce((acc, f) => acc + f.items.length, 0) ?? 0;

  return (
    <section className="panel live-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Real-time sync</p>
          <h3>
            <span className={`live-dot ${loading ? "live-dot--syncing" : ""}`}>Box Folders</span>
          </h3>
        </div>
        <div className="live-panel__controls">
          {lastFetch && (
            <span className="live-panel__ts">Updated {lastFetch}</span>
          )}
          <button
            type="button"
            className="ghost-button"
            onClick={() => void fetchData()}
            disabled={loading}
          >
            {loading ? "Syncing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {!data && !loading && (
        <p className="panel__lead" style={{ fontSize: "0.85rem" }}>
          No Box token configured or folders are empty. Set <code>BOX_DEVELOPER_TOKEN</code> and real folder IDs to see live status.
        </p>
      )}

      {loading && !data && (
        <div className="live-panel__skeleton">
          <div className="live-panel__skel-row" />
          <div className="live-panel__skel-row" />
          <div className="live-panel__skel-row" />
        </div>
      )}

      {data && (
        <>
          {data.latestSignEvent?.status === "signed" && (
            <div className="sign-complete-banner">
              <span className="sign-complete-banner__icon">✓</span>
              <div>
                <strong>Signature complete</strong>
                {data.latestSignEvent.documentName && (
                  <> — {data.latestSignEvent.documentName}</>
                )}
                {data.latestSignEvent.signerEmail && (
                  <span className="sign-complete-banner__who"> by {data.latestSignEvent.signerEmail}</span>
                )}
                <span className="sign-complete-banner__when"> · {relativeTime(data.latestSignEvent.completedAt)}</span>
              </div>
            </div>
          )}
          <div className="live-folders">
            {data.folders.map((folder) => (
              <div key={folder.folderId} className="live-folder">
                <div className="live-folder__header">
                  <span className="live-folder__name">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="live-folder__icon">
                      <path d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8.414 4.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" fill="currentColor" fillOpacity="0.7" />
                    </svg>
                    {folder.name}
                  </span>
                  <span className="live-folder__count">
                    {folder.items.length} item{folder.items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {folder.items.length === 0 ? (
                  <p className="live-folder__empty">Empty folder</p>
                ) : (
                  <ul className="live-folder__items">
                    {folder.items.map((item) => (
                      <li key={item.id} className={`live-folder__item live-folder__item--${item.type}`}>
                        <span className="live-folder__item-icon">
                          {item.type === "folder" ? "📁" : "📄"}
                        </span>
                        <span className="live-folder__item-name">{item.name}</span>
                        <span className="live-folder__item-meta">
                          {item.size !== undefined && humanSize(item.size)}
                          {item.modified_at && (
                            <> · {relativeTime(item.modified_at)}</>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {data.recentEvents.length > 0 && (
            <div className="live-events">
              <p className="eyebrow" style={{ marginBottom: "10px" }}>Webhook events</p>
              <ul className="live-events__list">
                {data.recentEvents.map((ev) => (
                  <li key={ev.id} className="live-event">
                    <span className="live-event__type">{ev.eventType.replace(/_/g, " ").toLowerCase()}</span>
                    {ev.source.name && (
                      <span className="live-event__name">{ev.source.name}</span>
                    )}
                    <span className="live-event__time">{relativeTime(ev.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="live-panel__footer">
            <span className="live-panel__root">
              Root folder: <code>{workspace?.rootFolderId}</code>
            </span>
            <span className="live-panel__total">{totalItems} total items tracked</span>
          </div>
        </>
      )}
    </section>
  );
}
