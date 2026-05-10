"use client";

import { useEffect } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry } from "@/types";

interface Props {
  entry: ContextEntry;
  onClose: () => void;
}

function polarityStatus(entry: ContextEntry): "pass" | "warning" | "fail" | "error" | null {
  const metaStatus = entry.metadata?.status;
  if (
    metaStatus === "pass" ||
    metaStatus === "warning" ||
    metaStatus === "fail" ||
    metaStatus === "error"
  ) {
    return metaStatus;
  }

  if (entry.source !== "ai-generated-code") return null;
  const match = entry.summary.match(/\b(pass|warning|fail|error)\b/i);
  return match ? (match[1].toLowerCase() as "pass" | "warning" | "fail" | "error") : "error";
}

const POLARITY_STATUS_COLOR = {
  pass: "#3ecf8e",
  warning: "#f2b84b",
  fail: "#ff6b6b",
  error: "#9ca3af",
} as const;

export default function ContextDetail({ entry, onClose }: Props) {
  const cfg = DEPT_CONFIG[entry.department];
  const scanStatus = polarityStatus(entry);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-detail-rise"
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--surface)",
          border: `1px solid ${cfg.color}28`,
          borderRadius: 18,
          padding: "24px",
          boxShadow: `0 0 60px ${cfg.color}18, 0 24px 60px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: cfg.color + "1a",
              border: `1px solid ${cfg.color}38`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
              flexShrink: 0,
            }}
          >
            {cfg.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: cfg.color }}>
              {cfg.label}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {new Date(entry.createdAt).toLocaleString()}
              {entry.source ? ` · ${entry.source}` : ""}
            </div>
          </div>
          {scanStatus && (
            <span
              style={{
                fontSize: 11,
                padding: "3px 9px",
                borderRadius: 999,
                background: POLARITY_STATUS_COLOR[scanStatus] + "22",
                color: POLARITY_STATUS_COLOR[scanStatus],
                border: `1px solid ${POLARITY_STATUS_COLOR[scanStatus]}55`,
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Polarity {scanStatus}
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              transition: "all 0.12s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            ✕
          </button>
        </div>

        {/* Summary */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: cfg.color + "10",
            borderLeft: `2px solid ${cfg.color}`,
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0, lineHeight: 1.5 }}>
            {entry.summary}
          </p>
        </div>

        {/* Full text */}
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.7, maxHeight: 340, overflowY: "auto" }}>
          {entry.text}
        </p>

        {/* Media */}
        {entry.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.mediaUrl}
            alt="Context media"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{
              width: "100%",
              borderRadius: 10,
              objectFit: "cover",
              maxHeight: 180,
              border: "1px solid var(--border)",
              marginBottom: 14,
            }}
          />
        )}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.05)",
              color: "var(--text-muted)",
            }}
          >
            {entry.tokenCount} tokens
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>·</span>
          <span
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 20,
              background: cfg.color + "14",
              color: cfg.color,
            }}
          >
            {cfg.label}
          </span>
        </div>
      </div>
    </div>
  );
}
