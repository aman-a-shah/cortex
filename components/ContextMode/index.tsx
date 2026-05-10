"use client";

import { useCallback, useState } from "react";
import BubbleUniverse from "./BubbleUniverse";
import LiveFeed from "./LiveFeed";
import ContextDetail from "./ContextDetail";
import { useContextStore } from "@/hooks/useContextStore";
import type { ContextEntry, Department } from "@/types";
import { DEPT_CONFIG } from "@/lib/dept-config";

interface ContextModeProps {
  session?: { department: Department; name: string } | null;
}

export default function ContextMode({ session }: ContextModeProps = {}) {
  const { entries, latest, refresh } = useContextStore(2000);
  const [selected, setSelected] = useState<ContextEntry | null>(null);
  const [deleteQuery, setDeleteQuery] = useState("");
  const [deleteMatches, setDeleteMatches] = useState<ContextEntry[] | null>(null);
  const [searching, setSearching] = useState(false);

  const isManager = session?.department === "management";

  const handleMergeBubble = useCallback(async (childId: string, parentId: string) => {
    await fetch("/api/merge-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, childId, action: "approve" }),
    });
    await refresh();
  }, [refresh]);

  async function findMatches(query: string): Promise<ContextEntry[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const exact = entries.filter(e =>
      e.summary.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)
    );
    if (exact.length > 0) return exact;

    // Fall back to AI inference
    const res = await fetch("/api/context/infer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, entries: entries.map(e => ({ id: e.id, summary: e.summary })) }),
    });
    const { matchedIds } = await res.json() as { matchedIds: string[] };
    return entries.filter(e => matchedIds.includes(e.id));
  }

  async function handleSearch() {
    if (!deleteQuery.trim()) return;
    setSearching(true);
    try {
      const matches = await findMatches(deleteQuery);
      setDeleteMatches(matches);
    } finally {
      setSearching(false);
    }
  }

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
            <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
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

        <BubbleUniverse
          entries={entries}
          onBubbleClick={setSelected}
          isManager={isManager}
          onMergeBubble={isManager ? handleMergeBubble : undefined}
        />

        {/* Delete context input bar */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(420px, calc(100% - 48px))",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(17,17,16,0.75)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "5px 5px 5px 14px",
            backdropFilter: "blur(8px)",
            zIndex: 15,
          }}
        >
          <input
            value={deleteQuery}
            onChange={(e) => setDeleteQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="Remove context... e.g. 'auth bug'"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 12,
              color: "var(--text-secondary)",
              minWidth: 0,
            }}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: searching ? "var(--text-muted)" : "var(--text-secondary)",
              fontSize: 11,
              cursor: searching ? "default" : "pointer",
              flexShrink: 0,
              opacity: searching ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
      </div>

      {/* Detail modal */}
      {selected && <ContextDetail entry={selected} onClose={() => setSelected(null)} />}

      {/* Delete context confirmation popup */}
      {deleteMatches !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
          }}
          onClick={() => setDeleteMatches(null)}
        >
          <div
            style={{
              width: 380,
              maxHeight: "70vh",
              overflowY: "auto",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Remove {deleteMatches.length} context {deleteMatches.length === 1 ? "entry" : "entries"}?
              </p>
            </div>

            {deleteMatches.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                No entries matched your query.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {deleteMatches.map((entry) => {
                  const cfg = DEPT_CONFIG[entry.department];
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "var(--surface-2)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: cfg.color,
                          flexShrink: 0,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: cfg.color + "20",
                          border: `1px solid ${cfg.color}40`,
                          marginTop: 1,
                        }}
                      >
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                        {entry.summary.slice(0, 80)}{entry.summary.length > 80 ? "…" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {deleteMatches.length > 0 && (
                <button
                  onClick={async () => {
                    await fetch("/api/context", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ids: deleteMatches.map(e => e.id) }),
                    });
                    await refresh();
                    setDeleteMatches(null);
                    setDeleteQuery("");
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 7,
                    background: "rgba(220,60,60,0.12)",
                    border: "1px solid rgba(220,60,60,0.35)",
                    color: "#e05c5c",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 500,
                  }}
                >
                  Remove {deleteMatches.length} {deleteMatches.length === 1 ? "entry" : "entries"}
                </button>
              )}
              <button
                onClick={() => setDeleteMatches(null)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 7,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
