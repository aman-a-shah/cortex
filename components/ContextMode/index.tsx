"use client";

import { useState } from "react";
import BubbleUniverse from "./BubbleUniverse";
import LiveFeed from "./LiveFeed";
import ContextDetail from "./ContextDetail";
import { useContextStore } from "@/hooks/useContextStore";
import type { ContextEntry } from "@/types";
import { DEPT_CONFIG } from "@/lib/dept-config";

export default function ContextMode() {
  const { entries, latest } = useContextStore(2000);
  const [selected, setSelected] = useState<ContextEntry | null>(null);

  const deptCount = new Set(entries.map((e) => e.department)).size;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Left sidebar: live feed */}
      <LiveFeed entries={entries} latest={latest} onEntryClick={setSelected} />

      {/* Right: bubble visualization */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Floating header */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            background: "linear-gradient(to bottom, rgba(17,17,16,0.95) 0%, rgba(17,17,16,0) 100%)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="17" stroke="var(--text-muted)" strokeWidth="1.2" />
              <circle cx="18" cy="18" r="5" fill="var(--accent)" opacity="0.9" />
              <line x1="18" y1="1" x2="18" y2="11" stroke="var(--text-muted)" strokeWidth="1.2" />
              <line x1="18" y1="25" x2="18" y2="35" stroke="var(--text-muted)" strokeWidth="1.2" />
              <line x1="1" y1="18" x2="11" y2="18" stroke="var(--text-muted)" strokeWidth="1.2" />
              <line x1="25" y1="18" x2="35" y2="18" stroke="var(--text-muted)" strokeWidth="1.2" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", color: "var(--text-muted)" }}>
              GLOBAL CONTEXT
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", opacity: 0.6 }}>
              · {entries.length} entries · {deptCount} departments
            </span>
          </div>

          {/* Dept legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Object.entries(DEPT_CONFIG).map(([dept, cfg]) => {
              const count = entries.filter((e) => e.department === dept).length;
              if (count === 0) return null;
              return (
                <div
                  key={dept}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: cfg.color,
                    opacity: 0.8,
                  }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />
                  <span>{cfg.label}</span>
                  <span style={{ opacity: 0.5 }}>({count})</span>
                </div>
              );
            })}
          </div>
        </div>

        <BubbleUniverse entries={entries} onBubbleClick={setSelected} />
      </div>

      {/* Detail modal */}
      {selected && <ContextDetail entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
