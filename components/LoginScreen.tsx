"use client";

import { useState } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { Department, SessionPayload } from "@/types";

// Re-export SessionPayload from types for use here
interface Props {
  onLogin: (session: { department: Department; name: string }) => void;
}

const DEPTS: Department[] = [
  "engineering",
  "marketing",
  "finance",
  "legal",
  "product",
  "management",
];

export default function LoginScreen({ onLogin }: Props) {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDept) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: selectedDept, password, name }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Invalid credentials");
        return;
      }

      onLogin({ department: selectedDept, name: name.trim() || selectedDept });
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const cfg = selectedDept ? DEPT_CONFIG[selectedDept] : null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-20"
      style={{ background: "var(--bg)" }}
    >
      {/* No ambient glow for Apple aesthetic */}

      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 8px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <svg width="32" height="32" viewBox="0 0 22 22" fill="none" className="mb-4">
            <circle cx="11" cy="11" r="10" stroke="var(--text-primary)" strokeWidth="1.5" />
            <circle cx="11" cy="11" r="4" fill="var(--text-primary)" opacity="0.85" />
            <line x1="11" y1="1" x2="11" y2="7" stroke="var(--text-primary)" strokeWidth="1.5" />
            <line x1="11" y1="15" x2="11" y2="21" stroke="var(--text-primary)" strokeWidth="1.5" />
            <line x1="1" y1="11" x2="7" y2="11" stroke="var(--text-primary)" strokeWidth="1.5" />
            <line x1="15" y1="11" x2="21" y2="11" stroke="var(--text-primary)" strokeWidth="1.5" />
          </svg>
          <h1
            className="text-2xl font-semibold tracking-widest"
            style={{ color: "var(--text-primary)", letterSpacing: "0.15em" }}
          >
            CORTEX
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            GLOBAL CONTEXT · SECURED BY CYSTACK
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Department selection */}
          <div>
            <label
              className="text-xs mb-2 block"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
            >
              YOUR DEPARTMENT
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DEPTS.map((dept) => {
                const d = DEPT_CONFIG[dept];
                const isSelected = selectedDept === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all text-xs"
                    style={{
                      background: isSelected ? d.color + "20" : "var(--surface-2)",
                      border: `1px solid ${isSelected ? d.color + "55" : "var(--border)"}`,
                      color: isSelected ? d.color : "var(--text-muted)",
                      cursor: "pointer",
                      transform: isSelected ? "scale(1.02)" : "scale(1)",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{d.emoji}</span>
                    <span style={{ fontWeight: isSelected ? 500 : 400 }}>{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name input */}
          <div>
            <label
              className="text-xs mb-2 block"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
            >
              YOUR NAME <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = cfg ? cfg.color + "55" : "var(--border-hover)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            />
          </div>

          {/* Password input */}
          <div>
            <label
              className="text-xs mb-2 block"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
            >
              DEPARTMENT ACCESS CODE
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = cfg ? cfg.color + "55" : "var(--border-hover)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            />
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: "#ef4444" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!selectedDept || !password || loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all mt-1"
            style={{
              background:
                selectedDept && password && !loading
                  ? cfg?.color ?? "var(--accent)"
                  : "var(--surface-2)",
              color:
                selectedDept && password && !loading
                  ? "#fff"
                  : "var(--text-muted)",
              border: "none",
              cursor: selectedDept && password && !loading ? "pointer" : "default",
            }}
          >
            {loading ? "Verifying…" : "Access Cortex"}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          Credentials secured via{" "}
          <span style={{ color: "var(--accent)" }}>Cystack Locker</span>
        </p>
      </div>
    </div>
  );
}
