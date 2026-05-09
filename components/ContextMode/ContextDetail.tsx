"use client";

import { useEffect } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ContextEntry } from "@/types";

interface Props {
  entry: ContextEntry;
  onClose: () => void;
}

export default function ContextDetail({ entry, onClose }: Props) {
  const cfg = DEPT_CONFIG[entry.department];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center pb-8"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl p-6 mx-4"
        style={{
          background: "var(--surface)",
          border: `1px solid ${cfg.color}33`,
          boxShadow: `0 0 40px ${cfg.color}22`,
          animation: "bubble-arrive 0.35s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: cfg.color + "22", border: `1px solid ${cfg.color}44` }}
          >
            {cfg.emoji}
          </div>
          <div>
            <div className="text-sm font-medium" style={{ color: cfg.color }}>
              {cfg.label}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {new Date(entry.createdAt).toLocaleString()}
              {entry.source ? ` · ${entry.source}` : ""}
            </div>
          </div>
          <button
            className="ml-auto text-sm"
            style={{ color: "var(--text-muted)", cursor: "pointer" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <p
          className="text-xs mb-3 font-medium"
          style={{ color: "var(--accent)" }}
        >
          {entry.summary}
        </p>

        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {entry.text}
        </p>

        {entry.mediaUrl && (
          <img
            src={entry.mediaUrl}
            alt="Context media"
            className="mt-4 rounded-lg w-full object-cover"
            style={{ maxHeight: 200, border: "1px solid var(--border)" }}
          />
        )}

        <div className="flex items-center gap-2 mt-4">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "var(--text-muted)",
            }}
          >
            ~{entry.tokenCount} tokens
          </span>
        </div>
      </div>
    </div>
  );
}
