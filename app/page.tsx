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

  // Crack transition effect
  useEffect(() => {
    if (appState !== "transitioning" || pendingMode === null) return;

    const topLayer = chatRef.current;
    if (!topLayer) return;

    const polyClosed = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 50% 0%, 48% 20%, 52% 40%, 49% 60%, 51% 80%, 50% 100%, 50% 100%, 51% 80%, 49% 60%, 52% 40%, 48% 20%, 50% 0%)";
    const polyOpen = "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, -10% 0%, -12% 20%, -8% 40%, -11% 60%, -9% 80%, -10% 100%, 110% 100%, 111% 80%, 109% 60%, 112% 40%, 108% 20%, 110% 0%)";

    topLayer.style.transition = "none";

    if (pendingMode === "context") {
      // Opening
      topLayer.style.clipPath = polyClosed;
      topLayer.style.opacity = "1";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          topLayer.style.transition = "clip-path 0.7s cubic-bezier(0.8, 0, 0.2, 1), opacity 0.5s ease 0.2s";
          topLayer.style.clipPath = polyOpen;
          topLayer.style.opacity = "0";
        });
      });
    } else {
      // Closing
      topLayer.style.clipPath = polyOpen;
      topLayer.style.opacity = "0";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          topLayer.style.transition = "clip-path 0.7s cubic-bezier(0.8, 0, 0.2, 1), opacity 0.3s ease";
          topLayer.style.clipPath = polyClosed;
          topLayer.style.opacity = "1";
        });
      });
    }

    const timer = setTimeout(() => {
      setMode(pendingMode);
      setPendingMode(null);
      setAppState("ready");
      topLayer.style.transition = "none";
      topLayer.style.clipPath = "none";
      topLayer.style.opacity = pendingMode === "chat" ? "1" : "0";
    }, 750);

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
