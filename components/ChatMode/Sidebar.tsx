"use client";

import { DEPT_CONFIG } from "@/lib/dept-config";
import type { Department } from "@/types";

const DEPTS: Department[] = [
  "engineering",
  "marketing",
  "finance",
  "legal",
  "product",
  "management",
];

interface Props {
  activeDept: Department;
  onDeptChange: (dept: Department) => void;
}

export default function Sidebar({ activeDept, onDeptChange }: Props) {
  return (
    <aside
      className="flex flex-col items-center py-4 gap-1 shrink-0"
      style={{
        width: 56,
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* Logo mark */}
      <div className="mb-4 mt-1" title="Cortex">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="10" stroke="var(--accent)" strokeWidth="1.5" />
          <circle cx="11" cy="11" r="4" fill="var(--accent)" opacity="0.8" />
          <line x1="11" y1="1" x2="11" y2="7" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="11" y1="15" x2="11" y2="21" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="1" y1="11" x2="7" y2="11" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="15" y1="11" x2="21" y2="11" stroke="var(--accent)" strokeWidth="1.5" />
        </svg>
      </div>

      <div style={{ width: 32, height: 1, background: "var(--border)", marginBottom: 8 }} />

      {DEPTS.map((dept) => {
        const cfg = DEPT_CONFIG[dept];
        const isActive = dept === activeDept;
        return (
          <button
            key={dept}
            onClick={() => onDeptChange(dept)}
            title={cfg.label}
            className="relative flex items-center justify-center rounded-lg transition-all"
            style={{
              width: 36,
              height: 36,
              background: isActive ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${isActive ? cfg.color + "44" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            {isActive && (
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                style={{
                  width: 3,
                  height: 16,
                  background: cfg.color,
                  left: -1,
                }}
              />
            )}
            <span style={{ fontSize: 16, lineHeight: 1 }}>{cfg.emoji}</span>
          </button>
        );
      })}
    </aside>
  );
}
