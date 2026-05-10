// Thin HTTP client for the Cortex Next app, used by the MCP server.
// Auth: bearer token (CORTEX_MCP_TOKEN). The Next app accepts that token on
// /api/context routes and mints a synthetic "mcp" session.

const BASE_URL = process.env.CORTEX_BASE_URL ?? "http://localhost:3000";
const MCP_TOKEN = process.env.CORTEX_MCP_TOKEN ?? "";

export type Department =
  | "engineering"
  | "marketing"
  | "finance"
  | "legal"
  | "product"
  | "management";

export const DEPARTMENTS: Department[] = [
  "engineering",
  "marketing",
  "finance",
  "legal",
  "product",
  "management",
];

interface ContextEntry {
  id: string;
  department: Department;
  text: string;
  summary: string;
  source?: string;
  createdAt: string;
  tokenCount: number;
}

function authHeaders(department?: Department): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (MCP_TOKEN) h.Authorization = `Bearer ${MCP_TOKEN}`;
  if (department) h["X-Cortex-Department"] = department;
  return h;
}

export async function pushContext(params: {
  department: Department;
  content: string;
  source?: string;
  summary?: string;
}): Promise<ContextEntry> {
  const summary = params.summary ?? params.content.slice(0, 140);
  const res = await fetch(`${BASE_URL}/api/context`, {
    method: "POST",
    headers: authHeaders(params.department),
    body: JSON.stringify({
      department: params.department,
      text: params.content,
      summary,
      source: params.source ?? "mcp",
    }),
  });
  if (!res.ok) {
    throw new Error(`pushContext failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as ContextEntry;
}

export async function getContext(params: {
  department?: Department;
  query?: string;
  limit?: number;
}): Promise<ContextEntry[]> {
  const res = await fetch(`${BASE_URL}/api/context`, {
    headers: authHeaders(params.department),
  });
  if (!res.ok) {
    throw new Error(`getContext failed: ${res.status} ${await res.text()}`);
  }
  let entries = (await res.json()) as ContextEntry[];
  if (params.department) {
    entries = entries.filter((e) => e.department === params.department);
  }
  if (params.query) {
    const q = params.query.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.summary.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)
    );
  }
  return entries.slice(0, params.limit ?? 10);
}
