import type { Department } from "@/types";

export const DEPT_CONFIG: Record<
  Department,
  { label: string; color: string; icon: string; emoji: string }
> = {
  engineering: {
    label: "Engineering",
    color: "#3b82f6",
    icon: "code",
    emoji: "⚙️",
  },
  marketing: {
    label: "Marketing",
    color: "#f97316",
    icon: "megaphone",
    emoji: "📣",
  },
  finance: {
    label: "Finance",
    color: "#22c55e",
    icon: "dollar",
    emoji: "💰",
  },
  legal: {
    label: "Legal",
    color: "#a855f7",
    icon: "shield",
    emoji: "⚖️",
  },
  product: {
    label: "Product",
    color: "#eab308",
    icon: "lightbulb",
    emoji: "💡",
  },
  management: {
    label: "Management",
    color: "#ec4899",
    icon: "users",
    emoji: "🏢",
  },
};
