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

  // Best-effort pretty summary
  const summary = JSON.stringify(data, null, 2).slice(0, 800);
  return `${cfg.emoji} **${cfg.label}** via Composio:\n\`\`\`\n${summary}\n\`\`\``;
}
