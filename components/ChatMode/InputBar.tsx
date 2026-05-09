"use client";

import { useState, useRef, useEffect } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { Department } from "@/types";

const TOOL_CHIPS = [
  { id: "github", label: "GitHub", emoji: "⚡", placeholder: 'e.g. "list my repos"' },
  { id: "slack", label: "Slack", emoji: "💬", placeholder: 'e.g. "search #engineering"' },
  { id: "notion", label: "Notion", emoji: "📓", placeholder: 'e.g. "find product docs"' },
  { id: "drive", label: "Drive", emoji: "📁", placeholder: 'e.g. "Q3 budget files"' },
] as const;

type ToolId = (typeof TOOL_CHIPS)[number]["id"];

interface Props {
  onSend: (text: string) => void;
  onToolResult?: (formatted: string) => void;
  disabled?: boolean;
  activeDept: Department;
}

export default function InputBar({ onSend, onToolResult, disabled, activeDept }: Props) {
  const [text, setText] = useState("");
  const [activeChip, setActiveChip] = useState<ToolId | null>(null);
  const [chipQuery, setChipQuery] = useState("");
  const [chipLoading, setChipLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chipInputRef = useRef<HTMLInputElement>(null);
  const cfg = DEPT_CONFIG[activeDept];

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeDept]);

  useEffect(() => {
    if (activeChip) chipInputRef.current?.focus();
  }, [activeChip]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  async function runTool(toolId: ToolId) {
    setChipLoading(true);
    try {
      const res = await fetch("/api/composio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, query: chipQuery }),
      });
      const data = await res.json();
      if (data.formatted && onToolResult) {
        onToolResult(data.formatted);
      }
    } catch {
      if (onToolResult) onToolResult(`Failed to run ${toolId} tool.`);
    } finally {
      setChipLoading(false);
      setActiveChip(null);
      setChipQuery("");
    }
  }

  const activeTool = TOOL_CHIPS.find((c) => c.id === activeChip);

  return (
    <div
      className="px-4 pb-4 pt-2"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      {/* Tool chips row */}
      <div className="flex gap-2 mb-2 pl-1 flex-wrap">
        {TOOL_CHIPS.map((chip) => {
          const isActive = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all"
              style={{
                background: isActive ? cfg.color + "22" : "var(--surface-2)",
                border: `1px solid ${isActive ? cfg.color + "55" : "var(--border)"}`,
                color: isActive ? cfg.color : "var(--text-secondary)",
                cursor: "pointer",
              }}
              onClick={() => {
                setActiveChip(isActive ? null : chip.id);
                setChipQuery("");
              }}
            >
              <span>{chip.emoji}</span>
              <span>{chip.label}</span>
              {isActive && <span style={{ opacity: 0.6 }}>✕</span>}
            </button>
          );
        })}

        {/* Composio badge */}
        <span
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ml-auto"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          ⚙ Composio
        </span>
      </div>

      {/* Composio tool input popover */}
      {activeChip && activeTool && (
        <div
          className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            background: "var(--surface-2)",
            border: `1px solid ${cfg.color}33`,
          }}
        >
          <span style={{ color: cfg.color }}>{activeTool.emoji}</span>
          <input
            ref={chipInputRef}
            type="text"
            value={chipQuery}
            onChange={(e) => setChipQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runTool(activeChip);
              if (e.key === "Escape") { setActiveChip(null); setChipQuery(""); }
            }}
            placeholder={activeTool.placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            onClick={() => runTool(activeChip)}
            disabled={chipLoading}
            className="text-xs px-2.5 py-1 rounded-lg transition-all"
            style={{
              background: cfg.color,
              color: "#fff",
              border: "none",
              cursor: chipLoading ? "default" : "pointer",
              opacity: chipLoading ? 0.6 : 1,
            }}
          >
            {chipLoading ? "…" : "Fetch"}
          </button>
        </div>
      )}

      {/* Main chat input */}
      <div
        className="flex items-end gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "var(--surface-2)",
          border: `1px solid ${cfg.color}33`,
        }}
      >
        <span style={{ color: cfg.color, fontSize: 16, marginBottom: 2 }}>
          {cfg.emoji}
        </span>
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
          style={{
            color: "var(--text-primary)",
            minHeight: 24,
            maxHeight: 140,
            scrollbarWidth: "none",
          }}
          placeholder={`Ask ${cfg.label} anything… cross-department context is active`}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            background: text.trim() && !disabled ? cfg.color : "var(--surface)",
            color: text.trim() && !disabled ? "#fff" : "var(--text-muted)",
            border: "none",
            cursor: text.trim() && !disabled ? "pointer" : "default",
          }}
        >
          Send
        </button>
      </div>

      <p className="text-center text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        Cortex · shared context active across all departments
      </p>
    </div>
  );
}
