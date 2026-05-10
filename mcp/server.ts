#!/usr/bin/env tsx
// Cortex MCP server. Exposes Cortex's shared global context to any
// MCP-capable client (Claude Code, Cursor, etc.) over stdio.
//
// Run: CORTEX_BASE_URL=http://localhost:3000 CORTEX_MCP_TOKEN=... npx tsx mcp/server.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  DEPARTMENTS,
  getContext,
  pushContext,
  type Department,
} from "./cortex-client.js";

const server = new Server(
  { name: "cortex", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "cortex_push_context",
      description:
        "Push a new context entry into Cortex's shared global context. Tag with the department it belongs to so other teams' AI sessions can pull it.",
      inputSchema: {
        type: "object",
        properties: {
          dept: { type: "string", enum: DEPARTMENTS, description: "Owning department" },
          content: { type: "string", description: "Full content of the context entry" },
          source: { type: "string", description: "Where this came from (e.g. 'claude-code', 'cursor')" },
        },
        required: ["dept", "content"],
      },
    },
    {
      name: "cortex_get_context",
      description:
        "Pull recent shared context from Cortex. Optionally filter by department or substring query.",
      inputSchema: {
        type: "object",
        properties: {
          dept: { type: "string", enum: DEPARTMENTS },
          query: { type: "string" },
          limit: { type: "number", default: 10 },
        },
      },
    },
    {
      name: "cortex_list_departments",
      description: "List the departments Cortex tracks.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    if (name === "cortex_push_context") {
      const entry = await pushContext({
        department: args.dept as Department,
        content: String(args.content ?? ""),
        source: args.source ? String(args.source) : "mcp",
      });
      return {
        content: [
          {
            type: "text",
            text: `Pushed context entry ${entry.id} (${entry.department}). Summary: ${entry.summary}`,
          },
        ],
      };
    }

    if (name === "cortex_get_context") {
      const entries = await getContext({
        department: args.dept as Department | undefined,
        query: args.query ? String(args.query) : undefined,
        limit: typeof args.limit === "number" ? args.limit : 10,
      });
      const formatted = entries
        .map(
          (e) =>
            `- [${e.department}] ${e.summary} (${e.source ?? "manual"}, ${e.createdAt})`
        )
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: entries.length === 0 ? "No context entries found." : formatted,
          },
        ],
      };
    }

    if (name === "cortex_list_departments") {
      return {
        content: [{ type: "text", text: DEPARTMENTS.join(", ") }],
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (err) {
    return {
      content: [
        { type: "text", text: `Tool ${name} failed: ${(err as Error).message}` },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[cortex-mcp] connected via stdio");
