"use client";

import { useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import MessageList from "./MessageList";
import InputBar from "./InputBar";
import ContextAwarenessBar from "./ContextAwarenessBar";
import { useContextStore } from "@/hooks/useContextStore";
import type { ChatMessage, Department } from "@/types";
import { DEPT_CONFIG } from "@/lib/dept-config";

interface Props {
  initialDept?: Department;
  onLogout?: () => void;
}

export default function ChatMode({ initialDept = "engineering", onLogout }: Props) {
  const [activeDept, setActiveDept] = useState<Department>(initialDept);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const { entries } = useContextStore();

  const handleDeptChange = useCallback((dept: Department) => {
    setActiveDept(dept);
    setMessages([]);
    setStreaming(false);
    setStreamContent("");
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        department: activeDept,
        timestamp: new Date().toISOString(),
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setStreaming(true);
      setStreamContent("");

      try {
        const apiMessages = nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, department: activeDept }),
        });

        if (!res.body) throw new Error("No stream body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamContent(accumulated);
        }

        // Detect cross-dept context refs from the response
        const contextRefs = entries
          .filter((e) => e.department !== activeDept)
          .filter((e) =>
            accumulated.toLowerCase().includes(e.department.toLowerCase())
          )
          .slice(0, 3)
          .map((e) => e.department);

        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: accumulated,
          department: activeDept,
          contextRefs: [...new Set(contextRefs)],
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error(err);
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-err`,
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
            department: activeDept,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setStreaming(false);
        setStreamContent("");
      }
    },
    [activeDept, messages, entries]
  );

  const cfg = DEPT_CONFIG[activeDept];

  return (
    <div className="flex h-full">
      <Sidebar activeDept={activeDept} onDeptChange={handleDeptChange} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <span style={{ color: cfg.color, fontSize: 20 }}>{cfg.emoji}</span>
            <div>
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {cfg.label}
              </span>
              <span
                className="text-xs ml-2"
                style={{ color: "var(--text-muted)" }}
              >
                · vibe coding session
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {entries.filter((e) => e.department !== activeDept).length} cross-dept contexts active
              </span>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#ef444444";
                  (e.currentTarget as HTMLElement).style.color = "#ef4444";
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
        </div>

        <ContextAwarenessBar entries={entries} activeDept={activeDept} />

        <MessageList
          messages={messages}
          streaming={streaming}
          streamContent={streamContent}
        />

        <InputBar
          onSend={handleSend}
          onToolResult={(formatted) => {
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now()}-tool`,
                role: "assistant",
                content: formatted,
                department: activeDept,
                timestamp: new Date().toISOString(),
              },
            ]);
          }}
          disabled={streaming}
          activeDept={activeDept}
        />
      </div>
    </div>
  );
}
