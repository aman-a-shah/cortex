"use client";

import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Sequence:
    // Phase 0: Render hidden
    // Phase 1: Blur and scale in (starts immediately)
    // Phase 2: Fade out overlay
    const t1 = setTimeout(() => setPhase(1), 50);
    const t2 = setTimeout(() => setPhase(2), 2400);
    const t3 = setTimeout(() => onComplete(), 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ease-in-out"
      style={{ opacity: phase === 2 ? 0 : 1 }}
    >
      <div
        className="flex flex-col items-center justify-center transition-all duration-[2000ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          opacity: phase === 0 ? 0 : 1,
          transform: phase === 0 ? "scale(0.92)" : "scale(1)",
          filter: phase === 0 ? "blur(12px)" : "blur(0px)",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 22 22"
          fill="none"
          className="mb-6 opacity-90"
        >
          <circle cx="11" cy="11" r="10" stroke="#f5f5f7" strokeWidth="1.5" />
          <circle cx="11" cy="11" r="4" fill="#f5f5f7" opacity="0.8" />
          <line x1="11" y1="1" x2="11" y2="7" stroke="#f5f5f7" strokeWidth="1.5" />
          <line x1="11" y1="15" x2="11" y2="21" stroke="#f5f5f7" strokeWidth="1.5" />
          <line x1="1" y1="11" x2="7" y2="11" stroke="#f5f5f7" strokeWidth="1.5" />
          <line x1="15" y1="11" x2="21" y2="11" stroke="#f5f5f7" strokeWidth="1.5" />
        </svg>

        <h1
          className="text-4xl font-semibold tracking-widest text-[#f5f5f7]"
          style={{ letterSpacing: "0.15em" }}
        >
          CORTEX
        </h1>
        <p
          className="mt-3 text-sm text-[#86868b] tracking-widest"
          style={{ letterSpacing: "0.1em" }}
        >
          GLOBAL CONTEXT
        </p>
      </div>
    </div>
  );
}
