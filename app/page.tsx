"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import LoadingScreen from "@/components/LoadingScreen";
import LoginScreen from "@/components/LoginScreen";
import ModeToggle from "@/components/ModeToggle";
import PolarityBadge from "@/components/PolarityBadge";
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

  const handleToggle = useCallback(() => {
    if (appState !== "ready") return;
    const next: Mode = mode === "chat" ? "context" : "chat";
    setPendingMode(next);
    setAppState("transitioning");
  }, [mode, appState]);

  // Curtain transition effect
  useEffect(() => {
    if (appState !== "transitioning" || pendingMode === null) return;

    const outgoingEl = mode === "chat" ? chatRef.current : contextRef.current;

    if (!outgoingEl) {
      setMode(pendingMode);
      setPendingMode(null);
      setAppState("ready");
      return;
    }

    // Animate outgoing layer: split from center outward then collapse to nothing
    outgoingEl.style.transition = "none";
    outgoingEl.style.clipPath = "inset(0 0% 0 0%)";
    outgoingEl.style.opacity = "1";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        outgoingEl.style.transition =
          "clip-path 0.48s cubic-bezier(0.76, 0, 0.24, 1), opacity 0.48s ease";
        outgoingEl.style.clipPath = "inset(0 50% 0 50%)";
        outgoingEl.style.opacity = "0";
      });
    });

    const timer = setTimeout(() => {
      setMode(pendingMode);
      setPendingMode(null);
      setAppState("ready");

      // Animate incoming layer: expand from center
      const incomingEl =
        pendingMode === "chat" ? chatRef.current : contextRef.current;
      if (incomingEl) {
        incomingEl.style.transition = "none";
        incomingEl.style.clipPath = "inset(0 50% 0 50%)";
        incomingEl.style.opacity = "0";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            incomingEl.style.transition =
              "clip-path 0.48s cubic-bezier(0.76, 0, 0.24, 1), opacity 0.48s ease";
            incomingEl.style.clipPath = "inset(0 0% 0 0%)";
            incomingEl.style.opacity = "1";
          });
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [appState, pendingMode, mode]);

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
              zIndex: mode === "context" ? 2 : 1,
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
              zIndex: mode === "chat" ? 2 : 1,
            }}
          >
            <ChatMode initialDept={session.department} onLogout={handleLogout} />
          </div>
        </>
      )}

      {/* Mode toggle */}
      {(appState === "ready" || appState === "transitioning") && session && (
        <ModeToggle mode={mode} onToggle={handleToggle} />
      )}

      {/* Polarity code quality badge */}
      {appState !== "loading" && <PolarityBadge />}
    </div>
  );
}
