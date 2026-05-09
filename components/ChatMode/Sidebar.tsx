"use client";

import { useState } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import PolarityBadge from "@/components/PolarityBadge";
import type { Department } from "@/types";

interface Conversation {
  id: string;
  title: string;
  timestamp: string;
}

interface Props {
  department: Department;
  userName: string;
  conversations: Conversation[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onLogout?: () => void;
  onDeleteConversation?: (id: string, withContext: boolean) => void;
}

export default function Sidebar({
  department,
  userName,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onLogout,
  onDeleteConversation,
}: Props) {
  const cfg = DEPT_CONFIG[department];
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Top: logo + new chat */}
      <div style={{ padding: "16px 12px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
            <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="17" stroke="var(--text-muted)" strokeWidth="1.2" />
              <circle cx="18" cy="18" r="5" fill="var(--accent)" opacity="0.9" />
              <line x1="18" y1="1" x2="18" y2="11" stroke="var(--text-muted)" strokeWidth="1.2" />
              <line x1="18" y1="25" x2="18" y2="35" stroke="var(--text-muted)" strokeWidth="1.2" />
              <line x1="1" y1="18" x2="11" y2="18" stroke="var(--text-muted)" strokeWidth="1.2" />
              <line x1="25" y1="18" x2="35" y2="18" stroke="var(--text-muted)" strokeWidth="1.2" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.1em", color: "var(--text-muted)" }}>
              CORTEX
            </span>
          </div>
        </div>

        {/* New chat button */}
        <button
          onClick={onNewChat}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          New conversation
        </button>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
        {conversations.length === 0 ? (
          <div style={{ padding: "24px 8px", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Your conversations will appear here
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em", padding: "8px 8px 4px", margin: 0 }}>
              RECENT
            </p>
            {conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  className="conv-row"
                  style={{ position: "relative", marginBottom: 1 }}
                  onMouseEnter={(e) => {
                    const trash = e.currentTarget.querySelector<HTMLElement>(".conv-trash");
                    if (trash) trash.style.opacity = "1";
                    const btn = e.currentTarget.querySelector<HTMLElement>(".conv-btn");
                    if (btn && !isActive) btn.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    const trash = e.currentTarget.querySelector<HTMLElement>(".conv-trash");
                    if (trash) trash.style.opacity = "0";
                    const btn = e.currentTarget.querySelector<HTMLElement>(".conv-btn");
                    if (btn && !isActive) btn.style.background = "transparent";
                  }}
                >
                  <button
                    className="conv-btn"
                    onClick={() => onSelectConversation(conv.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      padding: "8px 32px 8px 10px",
                      borderRadius: 8,
                      background: isActive ? "var(--surface-2)" : "transparent",
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "background 0.12s ease",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                        fontWeight: isActive ? 500 : 400,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                    >
                      {conv.title}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {formatRelativeTime(conv.timestamp)}
                    </span>
                  </button>
                  {onDeleteConversation && (
                    <button
                      className="conv-trash"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: conv.id, title: conv.title });
                      }}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        opacity: 0,
                        transition: "opacity 0.15s ease",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        borderRadius: 4,
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--red, #f46a6a)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                      }}
                      title="Delete conversation"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M1 3h10M4 3V2h4v1M2 3l.7 7.3A.7.7 0 003.4 11h5.2a.7.7 0 00.7-.7L10 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Bottom: user identity */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Dept badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: cfg.color + "14",
            border: `1px solid ${cfg.color}30`,
          }}
        >
          <span style={{ fontSize: 15 }}>{cfg.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: cfg.color }}>
              {cfg.label}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userName}
            </div>
          </div>
        </div>

        <div style={{ opacity: 0.7 }}>
          <PolarityBadge inline />
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "7px",
              borderRadius: 7,
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(244,106,106,0.4)";
              (e.currentTarget as HTMLElement).style.color = "var(--red)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </aside>

    {/* Delete confirmation popup */}
    {deleteTarget && onDeleteConversation && (
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
        onClick={() => setDeleteTarget(null)}
      >
        <div
          style={{
            width: 340,
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
              Delete conversation?
            </p>
            <p style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {deleteTarget.title.slice(0, 60)}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => {
                onDeleteConversation(deleteTarget.id, false);
                setDeleteTarget(null);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 7,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Delete conversation
            </button>
            <button
              onClick={() => {
                onDeleteConversation(deleteTarget.id, true);
                setDeleteTarget(null);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 7,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: cfg.color,
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              Delete + {cfg.label} context
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
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
    </>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
