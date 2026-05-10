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
  backboardSyncedAt?: string;
  backboardSyncError?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  department: Department;
  contextRefs?: string[];
  composioTool?: string;
  timestamp: string;
}

export interface PolarityScanIssue {
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
}

export interface PolarityScanResult {
  score: number | null;
  status: "pass" | "warning" | "fail" | "error";
  securityIssues: number | null;
  maintainability: "high" | "medium" | "low" | "unknown";
  issues: PolarityScanIssue[];
  rawOutput: string;
  stderr: string;
}

export interface ComposioTool {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface SessionPayload {
  userId: string;
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
