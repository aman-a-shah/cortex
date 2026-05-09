export type Department =
  | "engineering"
  | "marketing"
  | "finance"
  | "legal"
  | "product"
  | "management";

export interface ContextEntry {
  id: string;
  department: Department;
  text: string;
  summary: string;
  mediaUrl?: string;
  mediaPublicId?: string;
  source?: string;
  createdAt: string;
  tokenCount: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  department: Department;
  contextRefs?: string[];
  timestamp: string;
}

export interface ComposioTool {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface SessionPayload {
  department: Department;
  name: string;
  iat: number;
  exp: number;
}

export interface AucctusResult {
  brandResearch: string;
  productMap: string;
  stakeholderBrief: string;
  visualUrl?: string;
  visualPublicId?: string;
}
