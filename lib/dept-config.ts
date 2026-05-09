import type { Department } from "@/types";

export const DEPT_CONFIG: Record<
  Department,
  { label: string; color: string; icon: string; emoji: string }
> = {
  engineering: {
    label: "Engineering",
    color: "#0A84FF",
    icon: "code",
    emoji: "⌘",
  },
  marketing: {
    label: "Marketing",
    color: "#FF9F0A",
    icon: "megaphone",
    emoji: "✧",
  },
  finance: {
    label: "Finance",
    color: "#32D74B",
    icon: "dollar",
    emoji: "◎",
  },
  legal: {
    label: "Legal",
    color: "#BF5AF2",
    icon: "shield",
    emoji: "§",
  },
  product: {
    label: "Product",
    color: "#FFD60A",
    icon: "lightbulb",
    emoji: "❖",
  },
  management: {
    label: "Management",
    color: "#FF375F",
    icon: "users",
    emoji: "⬡",
  },
};
