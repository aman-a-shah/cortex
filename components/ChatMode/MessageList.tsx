"use client";

import { useEffect, useRef } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { ChatMessage } from "@/types";

interface Props {
  messages: ChatMessage[];
  streaming?: boolean;
  streamContent?: string;
}

function formatContent(text: string) {
  // Minimal markdown: bold, code blocks, inline code
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code
                key={j}
                className="px-1 py-0.5 rounded text-xs"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  fontFamily: "monospace",
                  color: "#e8826a",
                }}
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} style={{ color: "#e8e8e8", fontWeight: 600 }}>
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

export default function MessageList({
  messages,
  streaming,
  streamContent,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

  if (messages.length === 0 && !streaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center select-none">
        <div
          className="text-5xl mb-5"
          style={{ animation: "cortex-pulse 3s ease-in-out infinite" }}
        >
          ✦
        </div>
        <p
          className="text-2xl font-light tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Hey there, Cortex
        </p>
        <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
          What&apos;s on your team&apos;s mind?
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
      {messages.map((msg) => {
        const cfg = DEPT_CONFIG[msg.department];
        const isUser = msg.role === "user";
        return (
          <div
            key={msg.id}
            className={`flex gap-3 animate-msg-in ${isUser ? "flex-row-reverse" : "flex-row"}`}
          >
            {!isUser && (
              <div
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs mt-0.5"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                ✦
              </div>
            )}
            <div
              className={`flex flex-col gap-1 max-w-[72%] ${isUser ? "items-end" : "items-start"}`}
            >
              {isUser && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {cfg.emoji} {cfg.label}
                </span>
              )}
              <div
                className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={{
                  background: isUser ? cfg.color + "22" : "var(--surface-2)",
                  border: `1px solid ${isUser ? cfg.color + "33" : "var(--border)"}`,
                  color: "var(--text-primary)",
                  borderRadius: isUser
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                }}
              >
                {formatContent(msg.content)}
              </div>
              {msg.contextRefs && msg.contextRefs.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-0.5">
                  {msg.contextRefs.map((ref) => (
                    <span
                      key={ref}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(232,130,106,0.1)",
                        color: "var(--accent)",
                        border: "1px solid rgba(232,130,106,0.2)",
                      }}
                    >
                      context: {ref}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {streaming && streamContent !== undefined && (
        <div className="flex gap-3 animate-msg-in">
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs mt-0.5"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            ✦
          </div>
          <div
            className="px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[72%]"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              borderRadius: "18px 18px 18px 4px",
            }}
          >
            {streamContent || (
              <span
                className="inline-block w-1.5 h-4 rounded-sm"
                style={{ background: "var(--accent)", animation: "cortex-pulse 1s infinite" }}
              />
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
