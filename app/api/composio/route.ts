import { NextRequest, NextResponse } from "next/server";
import { createConnectLink, executeTool, formatToolResult, hasActiveConnection, toolResultToContextText, TOOL_MAP } from "@/lib/composio";
import { addContextEntry } from "@/lib/context-store";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";
import type { ToolId } from "@/lib/composio";
import type { Department } from "@/types";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { toolId, query } = await req.json();
  if (!toolId || !(toolId in TOOL_MAP)) {
    return NextResponse.json({ error: "Invalid toolId" }, { status: 400 });
  }

  const typedToolId = toolId as ToolId;
  const entityId = session.userId;
  const callbackUrl = new URL("/", req.nextUrl.origin).toString();

  const connected = await hasActiveConnection(typedToolId, entityId).catch(() => false);
  if (!connected) {
    try {
      const redirectUrl = await createConnectLink(typedToolId, entityId, callbackUrl);
      return NextResponse.json(
        { needsConnection: true, redirectUrl, toolId: typedToolId },
        { status: 409 }
      );
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to create Composio connect link" },
        { status: 500 }
      );
    }
  }

  const result = await executeTool(typedToolId, query ?? "", entityId);
  const formatted = formatToolResult(result);

  // Auto-create a context entry so tool data surfaces in the bubble universe
  let contextEntryId: string | null = null;
  if (!result.error) {
    const ctx = toolResultToContextText(result);
    if (ctx) {
      try {
        const entry = await addContextEntry(
          {
            department: session.department as Department,
            text: ctx.text,
            summary: ctx.summary,
            source: `composio-${toolId}`,
            tokenCount: Math.ceil(ctx.text.length / 4),
          },
          session.userId
        );
        contextEntryId = entry.id;
      } catch (err) {
        console.error("[composio] context entry creation failed", err);
      }
    }
  }

  return NextResponse.json({ result, formatted, contextEntryId });
}
