"use client";

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
}

export default function Sidebar({
  department,
  userName,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onLogout,
}: Props) {
  const cfg = DEPT_CONFIG[department];

  return (
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
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: isActive ? "var(--surface-2)" : "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                    marginBottom: 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
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
