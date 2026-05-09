"use client";

interface Props {
  mode: "chat" | "context";
  onToggle: () => void;
}

export default function ModeToggle({ mode, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full px-4 py-2.5 transition-all"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-hover)",
        color: "var(--text-primary)",
        cursor: "pointer",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 4px 24px rgba(232,130,106,0.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.4)";
      }}
    >
      {mode === "chat" ? (
        <>
          {/* Bubble icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="4" cy="7" r="3" fill="var(--accent)" opacity="0.7" />
            <circle cx="10" cy="4" r="2" fill="#3b82f6" opacity="0.7" />
            <circle cx="10.5" cy="10.5" r="2.5" fill="#22c55e" opacity="0.7" />
          </svg>
          <span className="text-xs font-medium">Context View</span>
        </>
      ) : (
        <>
          {/* Chat icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1Z"
              fill="var(--accent)"
              opacity="0.7"
            />
          </svg>
          <span className="text-xs font-medium">Chat Mode</span>
        </>
      )}
    </button>
  );
}
