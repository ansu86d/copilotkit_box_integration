"use client";

import { useState } from "react";

export interface FolderItem {
  id: string;
  name: string;
  type: string;
  modifiedAt?: string;
}

export interface FolderItemsPayload {
  vendorId: string;
  folder: string;
  folderId: string;
  items: FolderItem[];
  empty: boolean;
}

const FOLDER_LABELS: Record<string, string> = {
  intake: "01 Intake",
  review: "02 Review",
  signed: "03 Signed",
};

const FILE_ICON: Record<string, string> = {
  pdf: "📄",
  xlsx: "📊",
  docx: "📝",
  doc: "📝",
  file: "📄",
  folder: "📁",
};

function fileIcon(name: string, type: string): string {
  if (type === "folder") return FILE_ICON.folder;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_ICON[ext] ?? FILE_ICON.file;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function FolderItemsCard({ payload }: { payload: FolderItemsPayload }) {
  const [selected, setSelected] = useState<string | null>(null);

  const folderLabel = FOLDER_LABELS[payload.folder] ?? payload.folder;
  const selectedItem = payload.items.find((i) => i.id === selected);

  return (
    <section className="tool-card folder-items-card">
      <p className="tool-card__label">Box folder</p>
      <h3>{folderLabel}</h3>

      {payload.empty || payload.items.length === 0 ? (
        <p className="folder-items-empty">No files found in this folder.</p>
      ) : (
        <ul className="folder-items-list">
          {payload.items.map((item) => (
            <li
              key={item.id}
              className={`folder-item${selected === item.id ? " folder-item--selected" : ""}`}
              onClick={() => setSelected(selected === item.id ? null : item.id)}
            >
              <span className="folder-item__icon">{fileIcon(item.name, item.type)}</span>
              <span className="folder-item__name">{item.name}</span>
              {item.modifiedAt && (
                <span className="folder-item__date">{formatDate(item.modifiedAt)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedItem && (
        <div className="folder-item-detail">
          <p className="folder-item-detail__name">{selectedItem.name}</p>
          <p className="folder-item-detail__id">Box file ID: <code>{selectedItem.id}</code></p>
          {selectedItem.modifiedAt && (
            <p className="folder-item-detail__date">Modified: {formatDate(selectedItem.modifiedAt)}</p>
          )}
        </div>
      )}

      <p className="folder-items-hint">{payload.items.length} item{payload.items.length !== 1 ? "s" : ""} · folder id: <code>{payload.folderId}</code></p>
    </section>
  );
}
