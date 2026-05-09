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

interface AttachedImage {
  url: string;
  publicId: string;
  preview: string;
}

interface Props {
  onSend: (text: string) => void;
  onToolResult?: (formatted: string) => void;
  disabled?: boolean;
  activeDept: Department;
}

export default function InputBar({ onSend, onToolResult, disabled, activeDept }: Props) {
  const [text, setText] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeChip, setActiveChip] = useState<ToolId | null>(null);
  const [chipQuery, setChipQuery] = useState("");
  const [chipLoading, setChipLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chipInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      setToolsOpen(false);
      setActiveChip(null);
    }
  }

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    const payload = attachedImage
      ? `${trimmed}\n[Attached image: ${attachedImage.url}]`
      : trimmed;
    onSend(payload);
    setText("");
    setAttachedImage(null);
    setToolsOpen(false);
    setActiveChip(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    const preview = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, department: activeDept, contextId: Date.now().toString(), type: "context" }),
        });
        const data = await res.json();
        if (data.url) setAttachedImage({ url: data.url, publicId: data.publicId, preview });
      } catch { /* ignore */ }
      finally {
        setImageUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
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
      if (data.formatted && onToolResult) onToolResult(data.formatted);
    } catch {
      if (onToolResult) onToolResult(`Failed to run ${toolId} tool.`);
    } finally {
      setChipLoading(false);
      setActiveChip(null);
      setChipQuery("");
      setToolsOpen(false);
    }
  }

  const activeTool = TOOL_CHIPS.find((c) => c.id === activeChip);
  const canSend = !!text.trim() && !disabled;

  return (
    <div
      style={{
        padding: "12px 24px 20px",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* Centered container */}
      <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Tool popover */}
        {toolsOpen && !activeChip && (
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "10px",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {TOOL_CHIPS.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setActiveChip(chip.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }}
              >
                <span>{chip.emoji}</span>
                <span>{chip.label}</span>
              </button>
            ))}
            <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", marginLeft: "auto", padding: "0 4px" }}>
              via Composio
            </span>
          </div>
        )}

        {/* Tool query input */}
        {activeChip && activeTool && (
          <div
            style={{
              background: "var(--surface-2)",
              border: `1px solid ${cfg.color}33`,
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 15 }}>{activeTool.emoji}</span>
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
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13,
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={() => runTool(activeChip)}
              disabled={chipLoading}
              style={{
                padding: "5px 12px",
                borderRadius: 7,
                background: cfg.color,
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 500,
                cursor: chipLoading ? "default" : "pointer",
                opacity: chipLoading ? 0.6 : 1,
              }}
            >
              {chipLoading ? "…" : "Fetch"}
            </button>
            <button
              onClick={() => { setActiveChip(null); setChipQuery(""); }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: 14,
                padding: 2,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Image preview */}
        {(attachedImage || imageUploading) && (
          <div
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {imageUploading ? (
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Uploading…</span>
            ) : attachedImage && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachedImage.preview} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>Image attached via Cloudinary</span>
                <button
                  onClick={() => setAttachedImage(null)}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 }}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        )}

        {/* Main input box */}
        <div
          className="input-ring"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-hover)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={`Message ${cfg.label}…`}
            style={{
              flex: 1,
              resize: "none",
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "14px 16px 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--text-primary)",
              minHeight: 24,
              maxHeight: 160,
              scrollbarWidth: "none",
            }}
          />

          {/* Bottom toolbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 10px 10px",
              gap: 4,
            }}
          >
            {/* Tools */}
            <button
              onClick={() => { setToolsOpen((v) => !v); setActiveChip(null); }}
              title="Composio tools"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: toolsOpen ? "var(--surface-3)" : "transparent",
                border: "1px solid " + (toolsOpen ? "var(--border-hover)" : "transparent"),
                color: toolsOpen ? "var(--text-secondary)" : "var(--text-muted)",
                cursor: "pointer",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.12s ease",
              }}
              onMouseEnter={(e) => {
                if (!toolsOpen) {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-3)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!toolsOpen) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4.5C2 3.12 3.12 2 4.5 2h5C10.88 2 12 3.12 12 4.5v.5H2v-.5Z" fill="currentColor" opacity="0.6" />
                <rect x="2" y="5" width="10" height="7" rx="1.5" fill="currentColor" opacity="0.6" />
              </svg>
            </button>

            {/* Attach */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              title="Attach image (Cloudinary)"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: attachedImage ? cfg.color + "18" : "transparent",
                border: "1px solid " + (attachedImage ? cfg.color + "40" : "transparent"),
                color: attachedImage ? cfg.color : "var(--text-muted)",
                cursor: imageUploading ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.12s ease",
              }}
              onMouseEnter={(e) => {
                if (!attachedImage) {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-3)";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!attachedImage) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 10.5l3-3 2.5 2.5 2-2 2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="4.5" cy="4.5" r="1.5" fill="currentColor" opacity="0.7" />
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>

            <div style={{ flex: 1 }} />

            {/* Send */}
            <button
              onClick={submit}
              disabled={!canSend}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: canSend ? cfg.color : "var(--surface-3)",
                border: "none",
                color: canSend ? "#fff" : "var(--text-muted)",
                cursor: canSend ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V3M3.5 6.5L7 3l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
          Cortex · cross-department context active
        </p>
      </div>
    </div>
  );
}
