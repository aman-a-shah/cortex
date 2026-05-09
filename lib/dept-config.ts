import type { Department } from "@/types";

export const DEPT_CONFIG: Record<
  Department,
  { label: string; color: string; icon: string; emoji: string }
> = {
  engineering: {
    label: "Engineering",
    color: "#5b8fcc",
    icon: "code",
    emoji: "⌘",
  },
  marketing: {
    label: "Marketing",
    color: "#c48742",
    icon: "megaphone",
    emoji: "✧",
  },
  finance: {
    label: "Finance",
    color: "#4da066",
    icon: "dollar",
    emoji: "◎",
  },
  legal: {
    label: "Legal",
    color: "#9a68c0",
    icon: "shield",
    emoji: "§",
  },
  product: {
    label: "Product",
    color: "#b09940",
    icon: "lightbulb",
    emoji: "❖",
  },
  management: {
    label: "Management",
    color: "#b85870",
    icon: "users",
    emoji: "⬡",
  },
};
