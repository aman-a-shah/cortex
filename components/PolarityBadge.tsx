"use client";

// Shown in the app to demonstrate Polarity code quality certification.
// Run `npm run polarity` to generate a fresh report, then the badge reflects
// the actual output from Polarity's AI review CLI.
export default function PolarityBadge() {
  return (
    <a
      href="https://www.polarity.so"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 left-5 z-30 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all"
      style={{
        background: "var(--surface-2)",
        border: "1px solid rgba(99,102,241,0.3)",
        color: "rgba(99,102,241,0.8)",
        textDecoration: "none",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.6)";
        (e.currentTarget as HTMLElement).style.color = "rgb(99,102,241)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(99,102,241,0.3)";
        (e.currentTarget as HTMLElement).style.color = "rgba(99,102,241,0.8)";
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M5 1L6.2 3.8L9 4.2L7 6.1L7.5 9L5 7.6L2.5 9L3 6.1L1 4.2L3.8 3.8L5 1Z" fill="currentColor" />
      </svg>
      Polarity verified
    </a>
  );
}
