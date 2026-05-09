"use client";

import { useEffect, useRef } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry } from "@/types";

interface Props {
  entries: ContextEntry[];
  latest: ContextEntry | null;
  onEntryClick: (entry: ContextEntry) => void;
}

export default function LiveFeed({ entries, latest, onEntryClick }: Props) {
  const latestIdRef = useRef<string | null>(null);

  useEffect(() => {
    latestIdRef.current = latest?.id ?? null;
  }, [latest]);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        width: 280,
        borderLeft: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
          />
          <span
            className="text-xs font-medium"
            style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
          >
            LIVE CONTEXT FEED
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {entries.slice(0, 20).map((entry, i) => {
          const cfg = DEPT_CONFIG[entry.department];
          const isNew = i === 0 && entry.id === latestIdRef.current;
          return (
            <button
              key={entry.id}
              className={`w-full text-left px-4 py-3 flex flex-col gap-1 transition-colors ${isNew ? "animate-feed-slide" : ""}`}
              style={{
                borderBottom: "1px solid var(--border)",
                background: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
              onClick={() => onEntryClick(entry)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: cfg.color + "22",
                    color: cfg.color,
                    fontWeight: 500,
                  }}
                >
                  {cfg.emoji} {cfg.label}
                </span>
                {isNew && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      color: "#22c55e",
                    }}
                  >
                    NEW
                  </span>
                )}
                <span
                  className="text-xs ml-auto"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatTimeAgo(entry.createdAt)}
                </span>
              </div>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {entry.summary}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
