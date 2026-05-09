"use client";

import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry, Department } from "@/types";

interface Props {
  entries: ContextEntry[];
  activeDept: Department;
}

export default function ContextAwarenessBar({ entries, activeDept }: Props) {
  const crossDept = entries
    .filter((e) => e.department !== activeDept)
    .slice(0, 6);

  if (crossDept.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="text-xs shrink-0"
        style={{ color: "var(--text-muted)", letterSpacing: "0.05em" }}
      >
        ACTIVE CONTEXT
      </span>
      {crossDept.map((entry) => {
        const cfg = DEPT_CONFIG[entry.department];
        return (
          <div
            key={entry.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 text-xs"
            style={{
              background: cfg.color + "18",
              border: `1px solid ${cfg.color}33`,
              color: cfg.color,
              maxWidth: 200,
            }}
            title={entry.text}
          >
            <span>{cfg.emoji}</span>
            <span className="truncate" style={{ maxWidth: 140 }}>
              {entry.summary}
            </span>
          </div>
        );
      })}
    </div>
  );
}
