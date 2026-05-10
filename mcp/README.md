# Cortex MCP Server

Exposes Cortex's shared global context to any MCP-capable client
(Claude Code, Cursor, Windsurf, etc.) so vibe-coding sessions can push and
pull cross-department context.

## Tools

- `cortex_push_context({ dept, content, source? })` — append a new entry.
- `cortex_get_context({ dept?, query?, limit? })` — read recent entries.
- `cortex_list_departments()` — list known departments.

## Setup

1. Add `CORTEX_MCP_TOKEN=<long-random-string>` to your Cortex `.env.local` and
   restart the Next dev server.
2. Confirm the server is up (`http://localhost:3000`).

## Claude Code

Add to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "cortex": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/cortex/mcp/server.ts"],
      "env": {
        "CORTEX_BASE_URL": "http://localhost:3000",
        "CORTEX_MCP_TOKEN": "<same-token-as-above>"
      }
    }
  }
}
```

Restart Claude Code and run `/mcp` — `cortex` should appear with three tools.

## Cursor

Cursor uses the same MCP config format under
`~/.cursor/mcp.json`. Same snippet works.

## Local sanity check

```sh
CORTEX_BASE_URL=http://localhost:3000 \
CORTEX_MCP_TOKEN=<token> \
npx tsx mcp/server.ts
```

The server logs `[cortex-mcp] connected via stdio` when ready.
