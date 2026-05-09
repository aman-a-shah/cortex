"use client";

import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry, Department } from "@/types";

interface Props {
  entries: ContextEntry[];
  activeDept: Department;
}

export default function ContextAwarenessBar({ entries, activeDept }: Props) {
  const crossDept = entries.filter((e) => e.department !== activeDept).slice(0, 5);
  if (crossDept.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 24px",
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
        scrollbarWidth: "none",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", flexShrink: 0 }}>
        CONTEXT
      </span>
      {crossDept.map((entry) => {
        const cfg = DEPT_CONFIG[entry.department];
        return (
          <div
            key={entry.id}
            title={entry.text}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 10px",
              borderRadius: 20,
              background: cfg.color + "14",
              border: `1px solid ${cfg.color}28`,
              color: cfg.color,
              fontSize: 11,
              flexShrink: 0,
              maxWidth: 180,
              overflow: "hidden",
            }}
          >
            <span>{cfg.emoji}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.summary}
            </span>
          </div>
        );
      })}
    </div>
  );
}
