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
    : "";

  return (
    <span></span>
  );
}
