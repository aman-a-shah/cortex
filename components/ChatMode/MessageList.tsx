"use client";

import { useEffect, useRef } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ChatMessage, Department } from "@/types";

// ─── Markdown renderer ────────────────────────────────────────────────────────

type Segment = { type: "code"; lang: string; code: string } | { type: "text"; content: string };

function splitCodeBlocks(raw: string): Segment[] {
  const segments: Segment[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, match;
  while ((match = re.exec(raw)) !== null) {
    if (match.index > last) segments.push({ type: "text", content: raw.slice(last, match.index) });
    segments.push({ type: "code", lang: match[1] || "", code: match[2] });
    last = match.index + match[0].length;
  }
  if (last < raw.length) segments.push({ type: "text", content: raw.slice(last) });
  return segments;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0, idx = 0, match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const raw = match[0];
    if (raw.startsWith("**"))
      parts.push(<strong key={idx++} style={{ fontWeight: 600, color: "var(--text-primary)" }}>{raw.slice(2, -2)}</strong>);
    else if (raw.startsWith("*"))
      parts.push(<em key={idx++} style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>{raw.slice(1, -1)}</em>);
    else
      parts.push(<code key={idx++} style={{ padding: "1px 6px", borderRadius: 5, background: "rgba(255,255,255,0.08)", fontFamily: "ui-monospace, monospace", fontSize: "0.88em", color: "var(--accent-bright)" }}>{raw.slice(1, -1)}</code>);
    last = match.index + raw.length; idx++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div style={{ margin: "10px 0", borderRadius: 10, background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
      {lang && (
        <div style={{ padding: "5px 14px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em", background: "rgba(255,255,255,0.02)" }}>
          {lang.toUpperCase()}
        </div>
      )}
      <pre style={{ margin: 0, padding: "12px 16px", fontSize: 12.5, fontFamily: "ui-monospace, 'SF Mono', monospace", color: "rgba(255,255,255,0.82)", lineHeight: 1.65, overflowX: "auto", whiteSpace: "pre" }}>
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

function TextSegment({ content, accentColor }: { content: string; accentColor: string }) {
  const allLines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < allLines.length) {
    const line    = allLines[i];
    const trimmed = line.trim();

    // Leading blank lines — skip
    if (!trimmed && nodes.length === 0) { i++; continue; }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      nodes.push(<div key={`hr-${i}`} style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }} />);
      i++; continue;
    }

    // Headings
    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      nodes.push(
        <div key={`h-${i}`} style={{
          fontSize: level === 1 ? 17 : level === 2 ? 14.5 : 13,
          fontWeight: 600,
          color: level === 1 ? accentColor : "var(--text-primary)",
          marginTop: level === 1 ? 18 : 14,
          marginBottom: 5,
          lineHeight: 1.35,
          borderBottom: level === 1 ? `1px solid ${accentColor}25` : "none",
          paddingBottom: level === 1 ? 6 : 0,
        }}>
          {renderInline(hMatch[2])}
        </div>
      );
      i++; continue;
    }

    // Bullet list — collect consecutive bullets
    if (/^\s*[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < allLines.length && /^\s*[-*+]\s/.test(allLines[i])) {
        items.push(allLines[i].replace(/^\s*[-*+]\s/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} style={{ margin: "6px 0 6px 4px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.6, paddingLeft: 2 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < allLines.length && /^\s*\d+\.\s/.test(allLines[i])) {
        items.push(allLines[i].replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} style={{ margin: "6px 0 6px 4px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 3 }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.6 }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const bqLines: string[] = [];
      while (i < allLines.length && /^\s*>\s?/.test(allLines[i])) {
        bqLines.push(allLines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      nodes.push(
        <div key={`bq-${i}`} style={{ borderLeft: `2px solid ${accentColor}50`, paddingLeft: 12, margin: "8px 0" }}>
          {bqLines.map((l, j) => (
            <p key={j} style={{ margin: "2px 0", fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.6 }}>
              {renderInline(l)}
            </p>
          ))}
        </div>
      );
      continue;
    }

    // Empty line — small spacer between paragraphs
    if (!trimmed) {
      if (nodes.length > 0) nodes.push(<div key={`sp-${i}`} style={{ height: 6 }} />);
      i++; continue;
    }

    // Normal text line
    nodes.push(
      <p key={`p-${i}`} style={{ margin: "1px 0", fontSize: 13.5, lineHeight: 1.7, color: "var(--text-primary)" }}>
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <>{nodes}</>;
}

function MarkdownContent({ text, accentColor }: { text: string; accentColor: string }) {
  const segments = splitCodeBlocks(text);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {segments.map((seg, i) =>
        seg.type === "code"
          ? <CodeBlock key={i} lang={seg.lang} code={seg.code} />
          : <TextSegment key={i} content={seg.content} accentColor={accentColor} />
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  messages: ChatMessage[];
  streaming?: boolean;
  streamContent?: string;
  department: Department;
  userName: string;
}

export default function MessageList({ messages, streaming, streamContent, department, userName }: Props) {
  const cfg       = DEPT_CONFIG[department];
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  if (messages.length === 0 && !streaming) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", userSelect: "none" }}>
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <div style={{ fontSize: 32, marginBottom: 16, animation: "accent-pulse 3s ease-in-out infinite", color: "var(--accent)" }}>✦</div>
          <h2 style={{ fontSize: 24, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 8px", lineHeight: 1.3 }}>
            Hey there, <span style={{ color: cfg.color }}>{userName}</span>
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
            Ask me anything — I have full context across every department.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 8px", display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 6 }}>

        {messages.map((msg, idx) => {
          const isUser   = msg.role === "user";
          const prevMsg  = idx > 0 ? messages[idx - 1] : null;
          const showAvatar = !isUser && prevMsg?.role !== "assistant";

          return (
            <div
              key={msg.id}
              className="animate-msg-in"
              style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 10, alignItems: "flex-end", marginBottom: 2 }}
            >
              {/* Assistant avatar */}
              {!isUser && (
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "var(--accent)", opacity: showAvatar ? 1 : 0 }}>
                  ✦
                </div>
              )}

              <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 4, alignItems: isUser ? "flex-end" : "flex-start" }}>
                <div style={{
                  padding: isUser ? "9px 15px" : "12px 16px",
                  borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                  fontSize: 14, lineHeight: 1.65,
                  color: "var(--text-primary)",
                  background: isUser ? cfg.color + "1e" : "var(--surface-2)",
                  border: isUser ? `1px solid ${cfg.color}33` : "1px solid var(--border)",
                }}>
                  {isUser
                    ? <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65 }}>{msg.content}</p>
                    : <MarkdownContent text={msg.content} accentColor={cfg.color} />
                  }
                </div>

                {/* Context dept refs */}
                {msg.contextRefs && msg.contextRefs.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {msg.contextRefs.map(ref => {
                      const refCfg = DEPT_CONFIG[ref as Department];
                      return (
                        <span key={ref} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(200,125,86,0.2)" }}>
                          {refCfg?.emoji} {ref}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming */}
        {streaming && (
          <div className="animate-msg-in" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, color: "var(--accent)" }}>
              ✦
            </div>
            <div style={{ maxWidth: "78%", padding: "12px 16px", borderRadius: "4px 18px 18px 18px", fontSize: 14, lineHeight: 1.65, color: "var(--text-primary)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {streamContent ? (
                <>
                  <MarkdownContent text={streamContent} accentColor={cfg.color} />
                  <span style={{ display: "inline-block", width: 2, height: 14, borderRadius: 1, background: "var(--accent)", marginLeft: 2, verticalAlign: "middle", animation: "cursor-blink 1s ease-in-out infinite" }} />
                </>
              ) : (
                <span style={{ display: "flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-muted)", animation: `typing-dots 1.2s ease-in-out ${i * 0.2}s infinite`, display: "inline-block" }} />
                  ))}
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 8 }} />
      </div>
    </div>
  );
}
