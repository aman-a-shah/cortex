"use client";

interface Props {
  mode: "chat" | "context";
  onToggle: () => void;
}

export default function ModeToggle({ mode, onToggle }: Props) {
  const isChat = mode === "chat";

  return (
    <button
      onClick={onToggle}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 16px",
        borderRadius: 24,
        background: "rgba(22,22,20,0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--border-hover)",
        color: "var(--text-secondary)",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-hover)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
      }}
    >
      {isChat ? (
        <>
          {/* Bubble dots icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="4" cy="7" r="2.5" fill="var(--accent)" opacity="0.8" />
            <circle cx="10" cy="4.5" r="1.8" fill="#3b82f6" opacity="0.8" />
            <circle cx="10.5" cy="10" r="2" fill="#3ecf8e" opacity="0.8" />
          </svg>
          Context view
        </>
      ) : (
        <>
          {/* Chat icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1Z"
              fill="var(--accent)"
              opacity="0.8"
            />
          </svg>
          Chat mode
        </>
      )}
    </button>
  );
}
