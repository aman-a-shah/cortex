"use client";

import { useState } from "react";
import { DEPT_CONFIG } from "@/lib/dept-config";
import type { Department } from "@/types";

const DEPTS: Department[] = [
  "engineering", "marketing", "finance", "legal", "product", "management",
];

interface Props {
  onLogin: (session: { department: Department; name: string }) => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cfg = selectedDept ? DEPT_CONFIG[selectedDept] : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDept) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: selectedDept, password, name, email: email.trim() || undefined }),
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

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          margin: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
          animation: "logo-reveal 0.5s ease forwards",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <svg width="40" height="40" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="17" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.5" />
            <circle cx="18" cy="18" r="5" fill="var(--accent)" opacity="0.9" />
            <line x1="18" y1="1" x2="18" y2="11" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.4" />
            <line x1="18" y1="25" x2="18" y2="35" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.4" />
            <line x1="1" y1="18" x2="11" y2="18" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.4" />
            <line x1="25" y1="18" x2="35" y2="18" stroke="var(--text-primary)" strokeWidth="1.2" opacity="0.4" />
          </svg>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-muted)", marginBottom: 6 }}>
              CORTEX
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.3, margin: 0 }}>
              Sign in to your workspace
            </h1>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Department */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.06em" }}>
              Department
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {DEPTS.map((dept) => {
                const d = DEPT_CONFIG[dept];
                const isSelected = selectedDept === dept;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setSelectedDept(dept)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: isSelected ? d.color + "18" : "var(--surface-2)",
                      border: `1px solid ${isSelected ? d.color + "50" : "var(--border)"}`,
                      color: isSelected ? d.color : "var(--text-secondary)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                      fontSize: 13,
                      fontWeight: isSelected ? 500 : 400,
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{d.emoji}</span>
                    <span>{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.06em" }}>
              Your name <span style={{ opacity: 0.6 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = cfg ? cfg.color + "55" : "var(--border-hover)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.06em" }}>
              Email <span style={{ opacity: 0.6 }}>(optional — for context change alerts)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = cfg ? cfg.color + "55" : "var(--border-hover)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.06em" }}>
              Access code
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = cfg ? cfg.color + "55" : "var(--border-hover)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "var(--red)", textAlign: "center", margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!selectedDept || !password || loading}
            style={{
              width: "100%",
              padding: "11px 0",
              borderRadius: 10,
              background: selectedDept && password && !loading ? (cfg?.color ?? "var(--accent)") : "var(--surface-2)",
              color: selectedDept && password && !loading ? "#fff" : "var(--text-muted)",
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              cursor: selectedDept && password && !loading ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
          Secured by{" "}
          <span style={{ color: "var(--accent)" }}>Cystack Locker</span>
        </p>
      </div>
    </div>
  );
}
