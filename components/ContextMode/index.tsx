"use client";

import { useState } from "react";
import BubbleUniverse from "./BubbleUniverse";
import LiveFeed from "./LiveFeed";
import ContextDetail from "./ContextDetail";
import { useContextStore } from "@/hooks/useContextStore";
import type { ContextEntry } from "@/types";

export default function ContextMode() {
  const { entries, latest } = useContextStore(2000);
  const [selected, setSelected] = useState<ContextEntry | null>(null);

  return (
    <div className="flex h-full relative">
      {/* Bubble canvas area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Header */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 z-10"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg)" }}
        >
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="10" stroke="var(--accent)" strokeWidth="1.5" />
              <circle cx="11" cy="11" r="4" fill="var(--accent)" opacity="0.8" />
              <line x1="11" y1="1" x2="11" y2="7" stroke="var(--accent)" strokeWidth="1.5" />
              <line x1="11" y1="15" x2="11" y2="21" stroke="var(--accent)" strokeWidth="1.5" />
              <line x1="1" y1="11" x2="7" y2="11" stroke="var(--accent)" strokeWidth="1.5" />
              <line x1="15" y1="11" x2="21" y2="11" stroke="var(--accent)" strokeWidth="1.5" />
            </svg>
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)", letterSpacing: "0.06em" }}
            >
              GLOBAL CONTEXT
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              · {entries.length} entries across {new Set(entries.map((e) => e.department)).size} departments
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              live
            </span>
          </div>
        </div>

        {/* Bubble visualization */}
        <div className="absolute inset-0 pt-[49px]">
          <BubbleUniverse entries={entries} onBubbleClick={setSelected} />
        </div>

        {/* Ambient background gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(232,130,106,0.03) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Live feed panel */}
      <LiveFeed
        entries={entries}
        latest={latest}
        onEntryClick={setSelected}
      />

      {/* Context detail modal */}
      {selected && (
        <ContextDetail entry={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
