"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import MessageList from "./MessageList";
import InputBar from "./InputBar";
import { useContextStore } from "@/hooks/useContextStore";
import type { ChatMessage, Department } from "@/types";
import { DEPT_CONFIG } from "@/lib/dept-config";

interface Conversation {
  id: string;
  title: string;
  department: Department;
  messages: ChatMessage[];
  timestamp: string;
}

interface Props {
  initialDept?: Department;
  userName?: string;
  onLogout?: () => void;
}

export default function ChatMode({
  initialDept = "engineering",
  userName = "",
  onLogout,
}: Props) {
  const department = initialDept; // locked — no switching
  const cfg = DEPT_CONFIG[department];
  const { entries } = useContextStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const convIdCounter = useRef(0);

  // Conversations persisted to localStorage
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(`cortex_convs_${initialDept}`);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`cortex_convs_${initialDept}`, JSON.stringify(conversations.slice(0, 12)));
    } catch { /* ignore */ }
  }, [conversations, initialDept]);

  // Save current conversation when messages change
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  function saveCurrentConversation(msgs: ChatMessage[]) {
    if (msgs.length === 0 || !activeConvId) return;
    const title = msgs.find((m) => m.role === "user")?.content.slice(0, 52) ?? "Conversation";
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === activeConvId);
      const updated: Conversation = {
        id: activeConvId,
        title,
        department,
        messages: msgs,
        timestamp: new Date().toISOString(),
      };
      if (exists) return prev.map((c) => (c.id === activeConvId ? updated : c));
      return [updated, ...prev];
    });
  }

  function handleNewChat() {
    saveCurrentConversation(messagesRef.current);
    setMessages([]);
    setStreamContent("");
    setStreaming(false);
    setActiveConvId(null);
  }

  function handleSelectConversation(id: string) {
    saveCurrentConversation(messagesRef.current);
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setMessages(conv.messages);
    setActiveConvId(id);
    setStreamContent("");
    setStreaming(false);
  }

  const handleSend = useCallback(
    async (text: string) => {
      // Start new conversation if needed
      let convId = activeConvId;
      if (!convId) {
        convId = `conv-${Date.now()}-${++convIdCounter.current}`;
        setActiveConvId(convId);
      }

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        department,
        timestamp: new Date().toISOString(),
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setStreaming(true);
      setStreamContent("");

      try {
        const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, department }),
        });

        if (!res.body) throw new Error("No stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamContent(accumulated);
        }

        const contextRefs = entries
          .filter((e) => e.department !== department)
          .filter((e) => accumulated.toLowerCase().includes(e.department.toLowerCase()))
          .slice(0, 3)
          .map((e) => e.department);

        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          content: accumulated,
          department,
          contextRefs: [...new Set(contextRefs)],
          timestamp: new Date().toISOString(),
        };
        const finalMessages = [...nextMessages, assistantMsg];
        setMessages(finalMessages);

        // Persist conversation
        const title = text.slice(0, 52);
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === convId);
          const updated: Conversation = { id: convId!, title, department, messages: finalMessages, timestamp: new Date().toISOString() };
          if (exists) return prev.map((c) => (c.id === convId ? updated : c));
          return [updated, ...prev];
        });
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `msg-${Date.now()}-err`, role: "assistant", content: "Something went wrong. Please try again.", department, timestamp: new Date().toISOString() },
        ]);
      } finally {
        setStreaming(false);
        setStreamContent("");
      }
    },
    [department, messages, entries, activeConvId]
  );

  const crossDeptCount = entries.filter((e) => e.department !== department).length;

  return (
    <div style={{ display: "flex", height: "100%", background: "var(--bg)" }}>
      <Sidebar
        department={department}
        userName={userName || cfg.label}
        conversations={conversations}
        activeConversationId={activeConvId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onLogout={onLogout}
      />

      {/* Main chat column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "13px 24px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              · {crossDeptCount} cross-dept context{crossDeptCount !== 1 ? "s" : ""} active
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              className="live-dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--green)",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>live</span>
          </div>
        </div>

        {/* Messages */}
        <MessageList
          messages={messages}
          streaming={streaming}
          streamContent={streamContent}
          department={department}
          userName={userName || cfg.label}
        />

        {/* Input */}
        <InputBar
          onSend={handleSend}
          onToolResult={(formatted) => {
            setMessages((prev) => [
              ...prev,
              { id: `msg-${Date.now()}-tool`, role: "assistant", content: formatted, department, timestamp: new Date().toISOString() },
            ]);
          }}
          disabled={streaming}
          activeDept={department}
        />
      </div>
    </div>
  );
}
