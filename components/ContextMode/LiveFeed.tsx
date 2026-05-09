"use client";

import { useEffect, useRef, useState } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry } from "@/types";

interface Props {
  entries: ContextEntry[];
  latest: ContextEntry | null;
  onEntryClick: (entry: ContextEntry) => void;
}

export default function LiveFeed({ entries, latest, onEntryClick }: Props) {
  const latestIdRef = useRef<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    latestIdRef.current = latest?.id ?? null;
  }, [latest]);

  return (
    <aside
      style={{
        width: collapsed ? 48 : 260,
        flexShrink: 0,
        height: "100%",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.25s cubic-bezier(0.22,1,0.36,1)",
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: collapsed ? "14px 14px" : "14px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          cursor: "pointer",
          minHeight: 48,
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div
          className="live-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--green)",
            flexShrink: 0,
          }}
        />
        {!collapsed && (
          <>
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: "var(--text-muted)", flex: 1 }}>
              CONTEXT FEED
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "var(--text-muted)", opacity: 0.4 }}>
              <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </>
        )}
      </div>

      {/* Entry list */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {entries.length === 0 ? (
            <div style={{ padding: "24px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                Context entries will appear here
              </p>
            </div>
          ) : (
            entries.slice(0, 30).map((entry, i) => {
              const cfg = DEPT_CONFIG[entry.department];
              const isNew = i === 0 && entry.id === latestIdRef.current;
              return (
                <button
                  key={entry.id}
                  onClick={() => onEntryClick(entry)}
                  className={isNew ? "animate-feed-item-in" : ""}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 14px",
                    border: "none",
                    borderBottom: "1px solid var(--border)",
                    background: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    transition: "background 0.12s ease",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 6,
                        background: cfg.color + "1a",
                        color: cfg.color,
                        fontWeight: 500,
                      }}
                    >
                      {cfg.emoji} {cfg.label}
                    </span>
                    {isNew && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 5px",
                          borderRadius: 8,
                          background: "var(--green-dim)",
                          color: "var(--green)",
                          fontWeight: 500,
                        }}
                      >
                        NEW
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
                      {formatAgo(entry.createdAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      margin: 0,
                      lineHeight: 1.5,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {entry.summary}
                  </p>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Footer stats */}
      {!collapsed && (
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            {entries.length} entries · {new Set(entries.map((e) => e.department)).size} depts
          </p>
        </div>
      )}
    </aside>
  );
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
