"use client";

import { useEffect, useRef, useState } from "react";
import { useContextStore } from "@/hooks/useContextStore";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry, Department } from "@/types";

interface ToastItem {
  id: string;
  entry: ContextEntry;
  createdLocallyAt: number;
}

interface Props {
  ownDepartment: Department;
}

const TOAST_TTL_MS = 5500;
const MAX_STACK = 3;

// Global root-level toast that announces new context entries from other
// departments or external sources (MCP, Composio). Polls via useContextStore.
export default function ContextChangeToast({ ownDepartment }: Props) {
  const { latest } = useContextStore(2500);
  const [items, setItems] = useState<ToastItem[]>([]);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!latest) return;
    if (seen.current.has(latest.id)) return;
    seen.current.add(latest.id);

    const fromOtherDept = latest.department !== ownDepartment;
    const fromExternal =
      latest.source?.startsWith("mcp") ||
      latest.source?.startsWith("composio") ||
      latest.source === "chat-extract";
    if (!fromOtherDept && !fromExternal) return;

    setItems((prev) => {
      const next = [...prev, { id: latest.id, entry: latest, createdLocallyAt: Date.now() }];
      return next.slice(-MAX_STACK);
    });
  }, [latest, ownDepartment]);

  useEffect(() => {
    if (items.length === 0) return;
    const id = setInterval(() => {
      setItems((prev) => prev.filter((t) => Date.now() - t.createdLocallyAt < TOAST_TTL_MS));
    }, 500);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 300,
        pointerEvents: "none",
      }}
    >
      {items.map((t) => {
        const cfg = DEPT_CONFIG[t.entry.department];
        const sourceLabel = t.entry.source?.startsWith("mcp")
          ? "via MCP"
          : t.entry.source?.startsWith("composio")
            ? "via Composio"
            : t.entry.source === "chat-extract"
              ? "from chat"
              : "context update";
        return (
          <div
            key={t.id}
            style={{
              minWidth: 280,
              maxWidth: 360,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(17,17,16,0.92)",
              border: `1px solid ${cfg.color}55`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.4), inset 3px 0 0 ${cfg.color}`,
              backdropFilter: "blur(10px)",
              animation: "toast-in 0.3s cubic-bezier(0.22,1,0.36,1)",
              pointerEvents: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 13 }}>{cfg.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, letterSpacing: "0.04em" }}>
                {cfg.label.toUpperCase()}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>
                {sourceLabel}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              {t.entry.summary.slice(0, 140)}
              {t.entry.summary.length > 140 ? "…" : ""}
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
