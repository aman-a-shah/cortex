import { Composio } from "@composio/core";

// Tool slugs mapped to our UI chips
export const TOOL_MAP = {
  github: {
    label: "GitHub",
    emoji: "⚡",
    // List recent activity: open PRs, issues, commits
    defaultAction: "GITHUB_LIST_REPOS",
    searchAction: "GITHUB_SEARCH_CODE",
    description: "Fetch GitHub repos, PRs, or issues",
  },
  slack: {
    label: "Slack",
    emoji: "💬",
    defaultAction: "SLACK_LIST_CHANNELS",
    searchAction: "SLACK_SEARCH_MESSAGES",
    description: "Read Slack channels or search messages",
  },
  notion: {
    label: "Notion",
    emoji: "📓",
    defaultAction: "NOTION_LIST_PAGES",
    searchAction: "NOTION_SEARCH_PAGES",
    description: "Search Notion pages and databases",
  },
  drive: {
    label: "Drive",
    emoji: "📁",
    defaultAction: "GOOGLEDRIVE_LIST_FILES",
    searchAction: "GOOGLEDRIVE_FIND_FILE",
    description: "List or search Google Drive files",
  },
} as const;

export type ToolId = keyof typeof TOOL_MAP;

let _composio: Composio | null = null;

function getComposio(): Composio {
  if (!_composio) {
    _composio = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY ?? "",
    });
  }
  return _composio;
}

export interface ComposioResult {
  toolId: ToolId;
  action: string;
  data: unknown;
  error?: string;
}

export async function executeTool(
  toolId: ToolId,
  query: string,
  entityId = "default"
): Promise<ComposioResult> {
  const composio = getComposio();
  const toolCfg = TOOL_MAP[toolId];

  // Pick search vs default action based on whether user supplied a query
  const action = query.trim() ? toolCfg.searchAction : toolCfg.defaultAction;

  try {
    // Build params depending on the tool
    const params = buildParams(toolId, action, query);

    const result = await composio.tools.execute(action, {
      userId: entityId,
      arguments: params,
      dangerouslySkipVersionCheck: true,
    });

    return { toolId, action, data: result };
  } catch (err) {
    return {
      toolId,
      action,
      data: null,
      error: err instanceof Error ? err.message : "Tool execution failed",
    };
  }
}

function buildParams(toolId: ToolId, action: string, query: string): Record<string, unknown> {
  switch (toolId) {
    case "github":
      return action.includes("SEARCH") ? { query, per_page: 5 } : { per_page: 10 };
    case "slack":
      return action.includes("SEARCH") ? { query, count: 5 } : { limit: 10 };
    case "notion":
      return action.includes("SEARCH") ? { query, page_size: 5 } : { page_size: 10 };
    case "drive":
      return action.includes("FIND") ? { query } : { pageSize: 10 };
    default:
      return query ? { query } : {};
  }
}

export function formatToolResult(result: ComposioResult): string {
  const cfg = TOOL_MAP[result.toolId];
  if (result.error) {
    return `${cfg.emoji} **${cfg.label}** — ${result.error}`;
  }

  const data = result.data as Record<string, unknown> | null;
  if (!data) return `${cfg.emoji} **${cfg.label}** — No results`;

  const summary = JSON.stringify(data, null, 2).slice(0, 800);
  return `${cfg.emoji} **${cfg.label}** via Composio:\n\`\`\`\n${summary}\n\`\`\``;
}

// ─── Context bridge ───────────────────────────────────────────────────────────

// Keyword signals that strongly suggest a specific tool is relevant
const TOOL_SIGNALS: Record<ToolId, string[]> = {
  github:  ["github", "repository", "pull request", "pr #", "commit ", "branch ", "issue #", "ci/cd", "deploy pipeline", "open pr", "merge"],
  slack:   ["slack", "slack channel", "#general", "#engineering", "#marketing", "#product", "slack message", "posted in slack"],
  notion:  ["notion", "notion page", "notion doc", "wiki", "runbook", "confluence"],
  drive:   ["google drive", "gdrive", "google doc", "google sheet", "shared doc", "shared file"],
};

export function detectToolFromMessage(message: string): ToolId | null {
  const lower = message.toLowerCase();
  for (const [toolId, signals] of Object.entries(TOOL_SIGNALS) as [ToolId, string[]][]) {
    if (signals.some(s => lower.includes(s))) return toolId;
  }
  return null;
}

// Recursively extract readable strings from arbitrary Composio response JSON
function extractStrings(obj: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (typeof obj === "string" && obj.trim()) return [obj.trim().slice(0, 140)];
  if (typeof obj === "number" || typeof obj === "boolean") return [String(obj)];
  if (Array.isArray(obj)) return obj.slice(0, 6).flatMap(v => extractStrings(v, depth + 1));
  if (obj && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>)
      .slice(0, 10)
      .flatMap(([k, v]) => extractStrings(v, depth + 1).map(s => `${k}: ${s}`));
  }
  return [];
}

// Convert a raw tool result into context entry text + summary, or null if nothing useful
export function toolResultToContextText(
  result: ComposioResult
): { summary: string; text: string } | null {
  if (result.error || !result.data) return null;
  const cfg = TOOL_MAP[result.toolId];
  const lines = extractStrings(result.data).slice(0, 15);
  if (lines.length === 0) return null;
  const text = `Live ${cfg.label} data (Composio action: ${result.action}):\n${lines.join("\n")}`;
  const firstLine = lines[0]?.replace(/^[^:]+:\s*/, "").slice(0, 80) ?? "data fetched";
  const summary = `${cfg.emoji} ${cfg.label} live — ${firstLine}`;
  return { summary, text };
}

// ─── Email notifications ──────────────────────────────────────────────────────

export async function sendContextChangeEmail(opts: {
  to: string;
  senderName: string;
  department: string;
  summary: string;
  source: string;
}): Promise<void> {
  const composio = getComposio();
  const entityId = process.env.COMPOSIO_ENTITY_ID ?? "default";
  const { to, senderName, department, summary, source } = opts;

  const date = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const body = `Dear ${senderName},

This is an automated notification from Cortex, your cross-department intelligence platform.

A new context update has been recorded in your workspace. The details are as follows:

  Department:  ${department.charAt(0).toUpperCase() + department.slice(1)}
  Source:      ${source}
  Recorded:    ${date}

Summary of change:
${summary}

This notification was sent because you opted in to live context alerts during sign-in. No action is required on your part.

---
Cortex · Cross-Department Intelligence
This is an automated message. Please do not reply directly to this email.`;

  try {
    await composio.tools.execute("GMAIL_SEND_EMAIL", {
      userId: entityId,
      arguments: {
        recipient_email: to,
        subject: `Cortex: New context update — ${department}`,
        body,
      },
      dangerouslySkipVersionCheck: true,
    });
  } catch (err) {
    console.error("[composio] email notification failed", err instanceof Error ? err.message : err);
  }
}

// Attempt to fetch live tool context for a message, with a hard timeout.
// Returns the tool result or null if not relevant / too slow / not connected.
export async function fetchLiveToolContext(
  message: string
): Promise<{ toolId: ToolId; text: string; summary: string } | null> {
  const toolId = detectToolFromMessage(message);
  if (!toolId) return null;

  const entityId = process.env.COMPOSIO_ENTITY_ID ?? "default";

  const toolPromise = executeTool(toolId, message.slice(0, 200), entityId).then(result => {
    const ctx = toolResultToContextText(result);
    if (!ctx) return null;
    return { toolId, ...ctx };
  });

  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 2500));
  return Promise.race([toolPromise, timeout]);
}
