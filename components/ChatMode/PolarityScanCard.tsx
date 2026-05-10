"use client";

import { useState } from "react";
import type { Department, PolarityScanResult } from "@/types";

interface Props {
  result: PolarityScanResult;
  department: Department;
  messageId: string;
}

const STATUS_COLORS: Record<PolarityScanResult["status"], string> = {
  pass: "#3ecf8e",
  warning: "#f2b84b",
  fail: "#ff6b6b",
  error: "#9ca3af",
};

function issuesSummary(result: PolarityScanResult): string {
  if (result.issues.length === 0) return "No Keystone issues reported.";
  return result.issues
    .slice(0, 3)
    .map((issue) => `${issue.severity}: ${issue.title}`)
    .join("; ");
}

export default function PolarityScanCard({ result, department, messageId }: Props) {
  const [rawOpen, setRawOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const color = STATUS_COLORS[result.status];

  async function saveToContext() {
    setSaving(true);
    setSaveError("");

    const summary = `Polarity Keystone scan ${result.status}${result.score !== null ? ` (${result.score})` : ""}`;
    const text = [
      summary,
      `Maintainability: ${result.maintainability}`,
      `Security issues: ${result.securityIssues ?? "unknown"}`,
      `Issues: ${issuesSummary(result)}`,
    ].join("\n");

    try {
      const res = await fetch("/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department,
          text,
          summary,
          source: "ai-generated-code",
          metadata: {
            department,
            type: "polarity-scan",
            source: "ai-generated-code",
            messageId,
            status: result.status,
            score: result.score,
            issuesSummary: issuesSummary(result),
          },
        }),
      });

      if (!res.ok) throw new Error("Could not save scan");
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save scan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 12,
        borderRadius: 10,
        background: "var(--surface-2)",
        border: `1px solid ${color}55`,
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 999,
            background: `${color}1f`,
            color,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {result.status}
        </span>
        {result.score !== null && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Score {result.score}
          </span>
        )}
        {result.securityIssues !== null && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Security {result.securityIssues}
          </span>
        )}
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Maintainability {result.maintainability}
        </span>
      </div>

      {result.issues.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {result.issues.slice(0, 5).map((issue, idx) => (
            <div key={`${issue.title}-${idx}`} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--text-primary)" }}>{issue.severity}</strong>: {issue.title}
              {issue.description ? ` - ${issue.description}` : ""}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setRawOpen((value) => !value)}
          style={{
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            borderRadius: 7,
            padding: "5px 9px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {rawOpen ? "Hide raw output" : "Raw CLI output"}
        </button>
        <button
          onClick={saveToContext}
          disabled={saving || saved}
          style={{
            border: "none",
            background: saved ? "var(--green-dim)" : color,
            color: saved ? "var(--green)" : "#fff",
            borderRadius: 7,
            padding: "5px 10px",
            fontSize: 11,
            cursor: saving || saved ? "default" : "pointer",
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saved ? "Saved to Global Context" : saving ? "Saving..." : "Save Scan to Global Context"}
        </button>
      </div>

      {saveError && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#ff6b6b" }}>{saveError}</div>
      )}

      {rawOpen && (
        <pre
          style={{
            margin: "10px 0 0",
            padding: 10,
            borderRadius: 8,
            background: "rgba(0,0,0,0.35)",
            color: "var(--text-secondary)",
            fontSize: 11,
            lineHeight: 1.5,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {[result.rawOutput, result.stderr].filter(Boolean).join("\n\n")}
        </pre>
      )}
    </div>
  );
}
