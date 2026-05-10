"use client";

import { useEffect, useRef, useState } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ChatMessage, Department, PolarityScanResult } from "@/types";
import PolarityScanCard from "./PolarityScanCard";

// ─── PDF export ───────────────────────────────────────────────────────────────
function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function exportAsPdf(text: string) {
  // Convert markdown to minimal HTML for the print view
  let body = escHtml(text);
  // Code blocks first (before other replacements corrupt them)
  body = body.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) =>
    `<div class="code-wrap">${lang ? `<div class="lang">${escHtml(lang)}</div>` : ""}<pre>${code.trim()}</pre></div>`
  );
  body = body.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  body = body.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  body = body.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  body = body.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  body = body.replace(/\*(.+?)\*/g, "<em>$1</em>");
  body = body.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  body = body.replace(/^[-*+] (.+)$/gm, "<li>$1</li>");
  body = body.replace(/(<li>[\s\S]*?<\/li>)(\n(?!<li>))/g, "<ul>$1</ul>$2");
  body = body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
  body = `<p>${body}</p>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Cortex Response</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:760px;margin:48px auto;padding:0 24px;color:#1a1a1a;font-size:14px;line-height:1.7}
  h1{font-size:22px;font-weight:600;margin:24px 0 8px;border-bottom:1px solid #e0e0e0;padding-bottom:6px}
  h2{font-size:17px;font-weight:600;margin:20px 0 6px}
  h3{font-size:14px;font-weight:600;margin:16px 0 4px}
  p{margin:6px 0}
  code{background:#f2f2f2;padding:1px 5px;border-radius:3px;font-family:ui-monospace,monospace;font-size:0.88em}
  .code-wrap{background:#f6f6f6;border:1px solid #e0e0e0;border-radius:8px;margin:12px 0;overflow:hidden}
  .lang{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#888;padding:5px 14px 4px;border-bottom:1px solid #e0e0e0;background:#efefef}
  pre{margin:0;padding:12px 16px;font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.6;overflow-x:auto;white-space:pre}
  ul,ol{padding-left:20px;margin:6px 0}
  li{margin:2px 0}
  strong{font-weight:600}
  @media print{body{margin:24px auto}pre{white-space:pre-wrap}}
</style>
</head><body>${body}</body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  // Small delay lets the browser finish rendering before print dialog
  setTimeout(() => { win.focus(); win.print(); }, 350);
}

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

function codeBlocks(raw: string): { lang: string; code: string }[] {
  return splitCodeBlocks(raw)
    .filter((seg): seg is Extract<Segment, { type: "code" }> => seg.type === "code")
    .map((seg) => ({ lang: seg.lang || "text", code: seg.code.trim() }))
    .filter((block) => block.code.length > 0);
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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim()).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ margin: "10px 0", borderRadius: 10, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 14px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
          {(lang || "code").toUpperCase()}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "2px 8px", borderRadius: 4,
            fontSize: 10, letterSpacing: "0.04em",
            color: copied ? "var(--green)" : "var(--text-muted)",
            transition: "color 0.15s ease",
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
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

    if (!trimmed && nodes.length === 0) { i++; continue; }

    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      nodes.push(<div key={`hr-${i}`} style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }} />);
      i++; continue;
    }

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

    if (/^\s*[-*+]\s/.test(line)) {
      const items: string[] = [];
      while (i < allLines.length && /^\s*[-*+]\s/.test(allLines[i])) {
        items.push(allLines[i].replace(/^\s*[-*+]\s/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} style={{ margin: "6px 0 6px 4px", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.6, paddingLeft: 2, wordBreak: "break-word", overflowWrap: "break-word" }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < allLines.length && /^\s*\d+\.\s/.test(allLines[i])) {
        items.push(allLines[i].replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} style={{ margin: "6px 0 6px 4px", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 3 }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.6, wordBreak: "break-word", overflowWrap: "break-word" }}>
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const bqLines: string[] = [];
      while (i < allLines.length && /^\s*>\s?/.test(allLines[i])) {
        bqLines.push(allLines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      nodes.push(
        <div key={`bq-${i}`} style={{ borderLeft: `2px solid ${accentColor}50`, paddingLeft: 12, margin: "8px 0" }}>
          {bqLines.map((l, j) => (
            <p key={j} style={{ margin: "2px 0", fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.6, wordBreak: "break-word", overflowWrap: "break-word" }}>
              {renderInline(l)}
            </p>
          ))}
        </div>
      );
      continue;
    }

    if (!trimmed) {
      if (nodes.length > 0) nodes.push(<div key={`sp-${i}`} style={{ height: 6 }} />);
      i++; continue;
    }

    nodes.push(
      <p key={`p-${i}`} style={{ margin: "1px 0", fontSize: 13.5, lineHeight: 1.7, color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "break-word" }}>
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

// Action bar shown below long assistant messages
function MessageActions({
  text,
  canScan,
  scanning,
  onScan,
}: {
  text: string;
  canScan: boolean;
  scanning: boolean;
  onScan: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
      <button
        onClick={handleCopy}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "none", border: "1px solid var(--border)",
          borderRadius: 6, padding: "3px 10px", cursor: "pointer",
          fontSize: 11, color: copied ? "var(--green)" : "var(--text-muted)",
          transition: "color 0.15s, border-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-hover)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <button
        onClick={() => exportAsPdf(text)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "none", border: "1px solid var(--border)",
          borderRadius: 6, padding: "3px 10px", cursor: "pointer",
          fontSize: 11, color: "var(--text-muted)",
          transition: "color 0.15s, border-color 0.15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-hover)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
        }}
      >
        ↓ Save as PDF
      </button>
      {canScan && (
        <button
          onClick={onScan}
          disabled={scanning}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            background: scanning ? "var(--surface-3)" : "rgba(99,102,241,0.14)",
            border: "1px solid rgba(99,102,241,0.35)",
            borderRadius: 6, padding: "3px 10px", cursor: scanning ? "default" : "pointer",
            fontSize: 11, color: "rgb(129,140,248)",
            transition: "color 0.15s, border-color 0.15s",
            opacity: scanning ? 0.7 : 1,
          }}
        >
          {scanning ? "Scanning..." : "Scan with Polarity"}
        </button>
      )}
    </div>
  );
}

// ─── Composio tool label map ──────────────────────────────────────────────────
const COMPOSIO_TOOL_LABELS: Record<string, { label: string; emoji: string }> = {
  github:  { label: "GitHub",       emoji: "⚡" },
  slack:   { label: "Slack",        emoji: "💬" },
  notion:  { label: "Notion",       emoji: "📓" },
  drive:   { label: "Google Drive", emoji: "📁" },
};

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  messages: ChatMessage[];
  streaming?: boolean;
  streamContent?: string;
  department: Department;
  userName: string;
}

export default function MessageList({ messages, streaming, streamContent, department, userName }: Props) {
<<<<<<< HEAD
  const cfg          = DEPT_CONFIG[department];
  const bottomRef    = useRef<HTMLDivElement>(null);
  const scrollerRef  = useRef<HTMLDivElement>(null);
=======
  const cfg       = DEPT_CONFIG[department];
  const bottomRef = useRef<HTMLDivElement>(null);
  const [scanResults, setScanResults] = useState<Record<string, PolarityScanResult>>({});
  const [scanLoading, setScanLoading] = useState<Record<string, boolean>>({});
>>>>>>> 4bb561209135c2baebc0794bba7497e6a8b70e2f

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  async function scanMessage(message: ChatMessage) {
    const blocks = codeBlocks(message.content);
    if (blocks.length === 0) return;

    setScanLoading((prev) => ({ ...prev, [message.id]: true }));
    try {
      const res = await fetch("/api/polarity/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: blocks.map((block) => block.code).join("\n\n"),
          language: blocks[0].lang,
          department,
          messageId: message.id,
        }),
      });
      const data: PolarityScanResult = await res.json();
      setScanResults((prev) => ({ ...prev, [message.id]: data }));
    } catch (error) {
      setScanResults((prev) => ({
        ...prev,
        [message.id]: {
          score: null,
          status: "error",
          securityIssues: null,
          maintainability: "unknown",
          issues: [{
            severity: "high",
            title: "Polarity scan failed",
            description: error instanceof Error ? error.message : "Unable to scan generated code.",
          }],
          rawOutput: "",
          stderr: error instanceof Error ? error.message : "Unable to scan generated code.",
        },
      }));
    } finally {
      setScanLoading((prev) => ({ ...prev, [message.id]: false }));
    }
  }

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
    <div ref={scrollerRef} style={{ flex: 1, overflowY: "auto", padding: "24px 24px 8px", display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 6 }}>

        {messages.map((msg, idx) => {
          const isUser    = msg.role === "user";
          const prevMsg   = idx > 0 ? messages[idx - 1] : null;
          const showAvatar = !isUser && prevMsg?.role !== "assistant";
          const isLong    = !isUser && msg.content.length > 350;
          const hasCode   = !isUser && codeBlocks(msg.content).length > 0;

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

              {/* Message content — minWidth:0 is critical for flex shrink to respect maxWidth */}
              <div style={{ maxWidth: "70%", minWidth: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: isUser ? "flex-end" : "flex-start" }}>
                {(() => {
                  const tool = !isUser && msg.composioTool ? COMPOSIO_TOOL_LABELS[msg.composioTool] : null;
                  return (
                    <div style={{
                      borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                      fontSize: 14, lineHeight: 1.65,
                      color: "var(--text-primary)",
                      background: isUser ? cfg.color + "1e" : "var(--surface-2)",
                      border: isUser ? `1px solid ${cfg.color}33` : tool ? "1px solid rgba(62,207,142,0.25)" : "1px solid var(--border)",
                      minWidth: 0,
                      overflow: "hidden",
                    }}>
                      {/* Composio enhancement header — only on assistant messages with tool data */}
                      {tool && (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "7px 14px",
                          background: "rgba(62,207,142,0.07)",
                          borderBottom: "1px solid rgba(62,207,142,0.15)",
                          fontSize: 11,
                          color: "var(--green)",
                          letterSpacing: "0.01em",
                        }}>
                          <span style={{ fontSize: 12 }}>{tool.emoji}</span>
                          <span style={{ fontWeight: 500 }}>Enhanced by Composio</span>
                          <span style={{ opacity: 0.55 }}>·</span>
                          <span style={{ opacity: 0.8 }}>{tool.label} live data injected</span>
                          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, opacity: 0.7 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "live-dot 2s ease-in-out infinite" }} />
                            live
                          </span>
                        </div>
                      )}
                      <div style={{ padding: isUser ? "9px 15px" : "12px 16px" }}>
                        {isUser
                          ? <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, wordBreak: "break-word", overflowWrap: "break-word" }}>{msg.content}</p>
                          : <MarkdownContent text={msg.content} accentColor={cfg.color} />
                        }
                      </div>
                    </div>
                  );
                })()}

                {/* Action bar for long assistant messages and generated code */}
                {(isLong || hasCode) && (
                  <MessageActions
                    text={msg.content}
                    canScan={hasCode}
                    scanning={Boolean(scanLoading[msg.id])}
                    onScan={() => scanMessage(msg)}
                  />
                )}

                {scanResults[msg.id] && (
                  <PolarityScanCard
                    result={scanResults[msg.id]}
                    department={department}
                    messageId={msg.id}
                  />
                )}

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
            <div style={{ maxWidth: "70%", minWidth: 0, padding: "12px 16px", borderRadius: "4px 18px 18px 18px", fontSize: 14, lineHeight: 1.65, color: "var(--text-primary)", background: "var(--surface-2)", border: "1px solid var(--border)", overflow: "hidden" }}>
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
