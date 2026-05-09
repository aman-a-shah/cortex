"use client";

import { useEffect, useState } from "react";

interface PolarityReport {
  score?: number;
  passed?: number;
  failed?: number;
  status?: string;
  summary?: string;
}

export default function PolarityBadge({ inline = false }: { inline?: boolean }) {
  const [report, setReport] = useState<PolarityReport | null>(null);

  useEffect(() => {
    fetch("/polarity-report.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setReport(data); })
      .catch(() => {});
  }, []);

  const hasPassed = report && (report.status === "pass" || (report.failed ?? 0) === 0);
  const label = report
    ? hasPassed
      ? `Polarity ✓ ${report.passed ?? ""} passed`
      : `Polarity ${report.failed} issues`
    : "Polarity verified";

  return (
    <a
      href="https://www.polarity.so"
      target="_blank"
      rel="noopener noreferrer"
      title={report?.summary ?? "Run `npm run polarity` to generate a report"}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all"
      style={{
        position: inline ? "static" : "fixed",
        bottom: inline ? undefined : 20,
        left: inline ? undefined : 20,
        zIndex: inline ? undefined : 30,
        width: inline ? "100%" : undefined,
        background: "var(--surface-2)",
        border: `1px solid ${hasPassed ? "rgba(99,102,241,0.5)" : "rgba(99,102,241,0.3)"}`,
        color: hasPassed ? "rgb(99,102,241)" : "rgba(99,102,241,0.8)",
        textDecoration: "none",
        boxShadow: inline ? "none" : "0 2px 12px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.6)";
        (e.currentTarget as HTMLElement).style.color = "rgb(99,102,241)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = hasPassed ? "rgba(99,102,241,0.5)" : "rgba(99,102,241,0.3)";
        (e.currentTarget as HTMLElement).style.color = hasPassed ? "rgb(99,102,241)" : "rgba(99,102,241,0.8)";
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M5 1L6.2 3.8L9 4.2L7 6.1L7.5 9L5 7.6L2.5 9L3 6.1L1 4.2L3.8 3.8L5 1Z" fill="currentColor" />
      </svg>
      {label}
    </a>
  );
}
