"use client";

import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 80);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const t3 = setTimeout(onComplete, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: "var(--bg)",
        opacity: phase === 2 ? 0 : 1,
        transition: phase === 2 ? "opacity 0.6s ease" : "none",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          opacity: phase >= 1 ? 1 : 0,
          animation: phase === 1 ? "logo-reveal 1.1s cubic-bezier(0.16,1,0.3,1) forwards" : "none",
        }}
      >
        {/* Cortex mark */}
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="17" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.6" />
          <circle cx="18" cy="18" r="5" fill="var(--accent)" opacity="0.9" />
          <line x1="18" y1="1" x2="18" y2="11" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.5" />
          <line x1="18" y1="25" x2="18" y2="35" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.5" />
          <line x1="1" y1="18" x2="11" y2="18" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.5" />
          <line x1="25" y1="18" x2="35" y2="18" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.5" />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.22em",
              color: "var(--text-primary)",
              opacity: 0.9,
            }}
          >
            CORTEX
          </span>
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
              animation: phase === 1 ? "tagline-reveal 0.8s ease 0.5s both" : "none",
            }}
          >
            GLOBAL CONTEXT
          </span>
        </div>
      </div>
    </div>
  );
}
