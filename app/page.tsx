"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import LoadingScreen from "@/components/LoadingScreen";
import LoginScreen from "@/components/LoginScreen";
import ModeToggle from "@/components/ModeToggle";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/constants";
import type { Department } from "@/types";

const ChatMode = dynamic(() => import("@/components/ChatMode"), { ssr: false });
const ContextMode = dynamic(() => import("@/components/ContextMode"), { ssr: false });

type Mode = "chat" | "context";
type AppState = "loading" | "login" | "ready" | "transitioning";

interface UserSession {
  department: Department;
  name: string;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [session, setSession] = useState<UserSession | null>(null);
  const [mode, setMode] = useState<Mode>("chat");
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Check for existing session on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.session) {
          setSession(data.session);
          // Small delay so loading animation can play
          setTimeout(() => setAppState("ready"), 100);
        }
        // Loading animation handles transitioning to "login" via onComplete
      })
      .catch(() => {
        // If /me fails, loading animation will show login
      });
  }, []);

  const handleLoadingComplete = useCallback(() => {
    // After loading animation: show login if no session, else go straight to app
    setAppState((prev) => (prev === "loading" ? (session ? "ready" : "login") : prev));
  }, [session]);

  const handleLogin = useCallback((newSession: UserSession) => {
    setSession(newSession);
    setAppState("ready");
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setMode("chat");
    setAppState("login");
  }, []);

  // Presence heartbeat — lets the server know the user is active so Pingram
  // notifications only fire while they're on the site.
  useEffect(() => {
    if (!session) return;
    const beat = () => {
      if (!document.hidden) fetch("/api/activity/heartbeat", { method: "POST" }).catch(() => {});
    };
    beat(); // immediate on login
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session]);

  const handleToggle = useCallback(() => {
    if (appState !== "ready") return;
    const next: Mode = mode === "chat" ? "context" : "chat";
    setPendingMode(next);
    setAppState("transitioning");
  }, [mode, appState]);

  // Fade transition
  useEffect(() => {
    if (appState !== "transitioning" || pendingMode === null) return;
    const topLayer = chatRef.current;
    if (!topLayer) return;

    topLayer.style.transition = "opacity 0.32s ease";
    topLayer.style.opacity = pendingMode === "context" ? "0" : "1";

    const timer = setTimeout(() => {
      setMode(pendingMode);
      setPendingMode(null);
      setAppState("ready");
      topLayer.style.transition = "none";
      topLayer.style.opacity = pendingMode === "chat" ? "1" : "0";
    }, 360);

    return () => clearTimeout(timer);
  }, [appState, pendingMode]);

  return (
    <div className="h-full relative overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Loading animation — always renders first */}
      {appState === "loading" && (
        <LoadingScreen onComplete={handleLoadingComplete} />
      )}

      {/* Login screen */}
      {appState === "login" && <LoginScreen onLogin={handleLogin} />}

      {/* App — only mounted after login */}
      {(appState === "ready" || appState === "transitioning") && session && (
        <>
          {/* Context mode behind chat */}
          <div
            ref={contextRef}
            className="absolute inset-0"
            style={{
              visibility: mode === "context" || appState === "transitioning" ? "visible" : "hidden",
              zIndex: 1,
            }}
          >
            <ContextMode />
          </div>

          {/* Chat mode on top */}
          <div
            ref={chatRef}
            className="absolute inset-0"
            style={{
              visibility: mode === "chat" || appState === "transitioning" ? "visible" : "hidden",
              zIndex: 2,
              pointerEvents: mode === "chat" && appState !== "transitioning" ? "auto" : "none",
            }}
          >
            <ChatMode initialDept={session.department} userName={session.name} onLogout={handleLogout} />
          </div>
        </>
      )}

      {/* Mode toggle */}
      {(appState === "ready" || appState === "transitioning") && session && (
        <ModeToggle mode={mode} onToggle={handleToggle} />
      )}

    </div>
  );
}
