"use client";

import { useState } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { MergeCandidate } from "@/lib/merge";

interface Props {
  candidates: MergeCandidate[];
  onResolved: () => void;
}

export default function MergeApprovalQueue({ candidates, onResolved }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  async function resolve(c: MergeCandidate, action: "approve" | "reject") {
    const key = `${c.parentId}:${c.childId}`;
    setBusy(key);
    try {
      await fetch("/api/merge-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: c.parentId, childId: c.childId, action }),
      });
      onResolved();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        right: 16,
        width: 320,
        maxHeight: "70vh",
        overflowY: "auto",
        background: "rgba(17,17,16,0.92)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        backdropFilter: "blur(10px)",
        zIndex: 25,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.14em", color: "var(--text-muted)" }}>
            MANAGER QUEUE
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              color: "var(--text-secondary)",
            }}
          >
            {candidates.length}
          </span>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {open ? "hide" : "show"}
        </button>
      </div>

      {open && candidates.length === 0 && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          No pending merges. New similar entries will appear here for approval.
        </p>
      )}

      {open && candidates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {candidates.map((c) => {
            const cfg = DEPT_CONFIG[c.department];
            const key = `${c.parentId}:${c.childId}`;
            return (
              <div
                key={key}
                style={{
                  border: `1px solid ${cfg.color}33`,
                  background: cfg.color + "0F",
                  borderRadius: 8,
                  padding: 10,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: cfg.color,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: cfg.color + "22",
                    }}
                  >
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {(c.similarity * 100).toFixed(0)}% similar
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  <div style={{ opacity: 0.9 }}>
                    <strong style={{ color: cfg.color }}>parent:</strong>{" "}
                    {c.parentSummary.slice(0, 80)}
                    {c.parentSummary.length > 80 ? "…" : ""}
                  </div>
                  <div style={{ opacity: 0.7, marginTop: 4 }}>
                    <strong style={{ color: cfg.color }}>child:</strong>{" "}
                    {c.childSummary.slice(0, 80)}
                    {c.childSummary.length > 80 ? "…" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => resolve(c, "approve")}
                    disabled={busy === key}
                    style={{
                      flex: 1,
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 6,
                      cursor: busy === key ? "default" : "pointer",
                      background: cfg.color + "33",
                      border: `1px solid ${cfg.color}66`,
                      color: cfg.color,
                      opacity: busy === key ? 0.5 : 1,
                    }}
                  >
                    ✓ merge
                  </button>
                  <button
                    onClick={() => resolve(c, "reject")}
                    disabled={busy === key}
                    style={{
                      flex: 1,
                      padding: "5px 10px",
                      fontSize: 11,
                      borderRadius: 6,
                      cursor: busy === key ? "default" : "pointer",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                      opacity: busy === key ? 0.5 : 1,
                    }}
                  >
                    ✗ keep separate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
