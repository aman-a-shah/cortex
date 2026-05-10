import { Composio } from "@composio/core";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Tool slugs mapped to our UI chips.
export const TOOL_MAP = {
  github: {
    label: "GitHub",
    marker: "GH",
    defaultAction: "GITHUB_LIST_REPOS",
    searchAction: "GITHUB_SEARCH_CODE",
    description: "Fetch GitHub repos, PRs, issues, commits, or code references",
  },
  slack: {
    label: "Slack",
    marker: "SL",
    defaultAction: "SLACK_LIST_ALL_CHANNELS",
    searchAction: "SLACK_ASSISTANT_SEARCH_CONTEXT",
    description: "Read Slack channels or search messages",
  },
  notion: {
    label: "Notion",
    marker: "NT",
    defaultAction: "NOTION_LIST_PAGES",
    searchAction: "NOTION_SEARCH_PAGES",
    description: "Search Notion pages and databases",
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

export function getAuthConfigEnvName(toolId: ToolId): string {
  return `COMPOSIO_${toolId.toUpperCase()}_AUTH_CONFIG_ID`;
}

function getAuthConfigId(toolId: ToolId): string {
  const authConfigId = process.env[getAuthConfigEnvName(toolId)];
  if (!authConfigId) {
    throw new Error(`Missing ${getAuthConfigEnvName(toolId)} in .env.local`);
  }
  return authConfigId;
}

export async function hasActiveConnection(toolId: ToolId, entityId: string): Promise<boolean> {
  const composio = getComposio();
  const authConfigId = getAuthConfigId(toolId);
  const accounts = await composio.connectedAccounts.list({
    userIds: [entityId],
    authConfigIds: [authConfigId],
  });

  return accounts.items.some((account) => account.status === "ACTIVE");
}

export async function createConnectLink(
  toolId: ToolId,
  entityId: string,
  callbackUrl: string
): Promise<string> {
  const authConfigId = getAuthConfigId(toolId);
  const composio = getComposio();
  const connectionRequest = await composio.connectedAccounts.link(entityId, authConfigId, {
    callbackUrl,
  });

  if (!connectionRequest.redirectUrl) {
    throw new Error(`Composio did not return a redirect URL for ${TOOL_MAP[toolId].label}`);
  }

  return connectionRequest.redirectUrl;
}

export async function executeTool(
  toolId: ToolId,
  query: string,
  entityId = "default"
): Promise<ComposioResult> {
  const composio = getComposio();
  const toolCfg = TOOL_MAP[toolId];
  const action = query.trim() ? toolCfg.searchAction : toolCfg.defaultAction;

  try {
    if (toolId === "slack" && query.trim()) {
      const result = await searchSlackRecentMessages(composio, entityId, query);
      return { toolId, action, data: result };
    }

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

async function searchSlackRecentMessages(
  composio: Composio,
  entityId: string,
  query: string
): Promise<Record<string, unknown>> {
  const channelsResult = await composio.tools.execute("SLACK_LIST_ALL_CHANNELS", {
    userId: entityId,
    arguments: { limit: 20, types: "public_channel,private_channel", exclude_archived: true },
    dangerouslySkipVersionCheck: true,
  });

  const channels = readArray(channelsResult, ["data", "channels"])
    .filter((channel) => typeof channel.id === "string" && typeof channel.name === "string")
    .filter((channel) => channel.is_member !== false)
    .slice(0, 10);

  const histories = await Promise.all(
    channels.map(async (channel) => {
      try {
        const history = await composio.tools.execute("SLACK_FETCH_CONVERSATION_HISTORY", {
          userId: entityId,
          arguments: { channel: channel.id, limit: 25 },
          dangerouslySkipVersionCheck: true,
        });
        return { channel, messages: readArray(history, ["data", "messages"]) };
      } catch {
        return { channel, messages: [] };
      }
    })
  );

  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9#-]+/)
    .filter((term) => term.length > 2)
    .filter((term) => !["slack", "what", "was", "were", "from", "the", "for", "and", "with", "hey"].includes(term));

  const messageRows = histories
    .flatMap(({ channel, messages }) =>
      messages.map((message, index) => {
        const text = typeof message.text === "string" ? message.text : "";
        const lower = text.toLowerCase();
        const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
        return {
          channel: channel.name,
          channelId: channel.id,
          user: message.user,
          text,
          timestamp: message.ts,
          index,
          score,
        };
      })
    )
    .filter((message) => message.text);

  const matchedChannels = new Set(
    messageRows.filter((message) => message.score > 0).map((message) => message.channelId)
  );

  const relevantMatches = matchedChannels.size > 0
    ? messageRows
        .filter((message) => matchedChannels.has(message.channelId))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, 8)
    : messageRows.slice(0, 5);

  return {
    query,
    matches: relevantMatches,
    channelsSearched: channels.map((channel) => channel.name),
  };
}

function readArray(obj: unknown, path: string[]): Record<string, unknown>[] {
  let cursor: unknown = obj;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") return [];
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return Array.isArray(cursor)
    ? cursor.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

function buildParams(toolId: ToolId, action: string, query: string): Record<string, unknown> {
  switch (toolId) {
    case "github":
      return action.includes("SEARCH") ? { query, per_page: 5 } : { per_page: 10 };
    case "slack":
      return action.includes("SEARCH")
        ? { query, limit: 5, content_types: "messages", channel_types: "public_channel,private_channel" }
        : { limit: 10, types: "public_channel,private_channel", exclude_archived: true };
    case "notion":
      return action.includes("SEARCH") ? { query, page_size: 5 } : { page_size: 10 };
    default:
      return query ? { query } : {};
  }
}

export function formatToolResult(result: ComposioResult): string {
  const cfg = TOOL_MAP[result.toolId];
  if (result.error) {
    return `[${cfg.marker}] **${cfg.label}** - ${result.error}`;
  }

  const data = result.data as Record<string, unknown> | null;
  if (!data) return `[${cfg.marker}] **${cfg.label}** - No results`;

  const summary = JSON.stringify(data, null, 2).slice(0, 800);
  return `[${cfg.marker}] **${cfg.label}** via Composio:\n\`\`\`\n${summary}\n\`\`\``;
}

// Keyword signals that strongly suggest a specific tool is relevant.
const TOOL_SIGNALS: Record<ToolId, string[]> = {
  github: ["github", "repository", "pull request", "pr #", "commit ", "branch ", "issue #", "ci/cd", "deploy pipeline", "open pr", "merge"],
  slack: ["slack", "slack channel", "#general", "#engineering", "#marketing", "#product", "slack message", "posted in slack"],
  notion: ["notion", "notion page", "notion doc", "wiki", "runbook", "confluence"],
};

export function detectToolFromMessage(message: string): ToolId | null {
  const lower = message.toLowerCase();
  for (const [toolId, signals] of Object.entries(TOOL_SIGNALS) as [ToolId, string[]][]) {
    if (signals.some((signal) => lower.includes(signal))) return toolId;
  }
  return null;
}

async function decideSlackSearch(
  message: string
): Promise<{ shouldSearch: boolean; query: string }> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 160,
    messages: [
      {
        role: "user",
        content: `Decide whether Cortex should search the user's connected Slack to answer this message.

Search Slack when the answer likely depends on recent team conversation, decisions, updates, async discussion, channel history, or what happened while the user was away.
Do not search Slack for general knowledge, standalone writing, coding, math, or questions already answerable without team communication.

If searching, write a concise Slack search query using the user's intent and likely synonyms, but do not invent facts.

User message:
${JSON.stringify(message)}

Respond with JSON only:
{
  "shouldSearch": true/false,
  "query": "short search query, or empty string"
}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { shouldSearch: false, query: "" };

  try {
    const parsed = JSON.parse(match[0]) as { shouldSearch?: unknown; query?: unknown };
    return {
      shouldSearch: parsed.shouldSearch === true,
      query: typeof parsed.query === "string" ? parsed.query.slice(0, 200) : "",
    };
  } catch {
    return { shouldSearch: false, query: "" };
  }
}

// Recursively extract readable strings from arbitrary Composio response JSON.
function extractStrings(obj: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (typeof obj === "string" && obj.trim()) return [obj.trim().slice(0, 140)];
  if (typeof obj === "number" || typeof obj === "boolean") return [String(obj)];
  if (Array.isArray(obj)) return obj.slice(0, 6).flatMap((value) => extractStrings(value, depth + 1));
  if (obj && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>)
      .slice(0, 10)
      .flatMap(([key, value]) => extractStrings(value, depth + 1).map((text) => `${key}: ${text}`));
  }
  return [];
}

// Convert a raw tool result into context entry text + summary, or null if nothing useful.
export function toolResultToContextText(
  result: ComposioResult
): { summary: string; text: string } | null {
  if (result.error || !result.data) return null;
  const cfg = TOOL_MAP[result.toolId];
  const lines = extractStrings(result.data).slice(0, 15);
  if (lines.length === 0) return null;
  const text = `Live ${cfg.label} data (Composio action: ${result.action}):\n${lines.join("\n")}`;
  const firstLine = lines[0]?.replace(/^[^:]+:\s*/, "").slice(0, 80) ?? "data fetched";
  const summary = `[${cfg.marker}] ${cfg.label} live - ${firstLine}`;
  return { summary, text };
}

// Attempt to fetch live tool context for a message, with a hard timeout.
// Returns the tool result or null if not relevant, too slow, or not connected.
export async function fetchLiveToolContext(
  message: string,
  entityId: string
): Promise<{ toolId: ToolId; text: string; summary: string } | null> {
  let toolId = detectToolFromMessage(message);
  let query = message.slice(0, 200);

  if (!toolId) {
    const hasSlackConnection = await hasActiveConnection("slack", entityId).catch(() => false);
    if (!hasSlackConnection) return null;

    const decision = await decideSlackSearch(message).catch(() => ({
      shouldSearch: false,
      query: "",
    }));
    if (!decision.shouldSearch) return null;

    toolId = "slack";
    query = decision.query || query;
  }

  const hasConnection = await hasActiveConnection(toolId, entityId).catch(() => false);
  if (!hasConnection) return null;

  const toolPromise = executeTool(toolId, query, entityId).then((result) => {
    const ctx = toolResultToContextText(result);
    if (!ctx) return null;
    return { toolId, ...ctx };
  });

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
  return Promise.race([toolPromise, timeout]);
}
