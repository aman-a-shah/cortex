import { NextRequest, NextResponse } from "next/server";
import { executeTool, formatToolResult, toolResultToContextText, TOOL_MAP } from "@/lib/composio";
import { addContextEntry } from "@/lib/context-store";
import { notifyContextChange } from "@/lib/pingram";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";
import type { ToolId } from "@/lib/composio";
import type { Department } from "@/types";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  const { toolId, query } = await req.json();
  if (!toolId || !(toolId in TOOL_MAP)) {
    return NextResponse.json({ error: "Invalid toolId" }, { status: 400 });
  }

  const entityId = process.env.COMPOSIO_ENTITY_ID ?? "default";
  const result = await executeTool(toolId as ToolId, query ?? "", entityId);
  const formatted = formatToolResult(result);

  // Auto-create a context entry so tool data surfaces in the bubble universe
  let contextEntryId: string | null = null;
  if (!result.error && session) {
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
        if (session.email) {
          notifyContextChange({
            userId: session.userId,
            email: session.email,
            name: session.name,
            department: session.department,
            summary: ctx.summary,
            source: `composio-${toolId}`,
          }).catch(console.error);
        }
      } catch (err) {
        console.error("[composio] context entry creation failed", err);
      }
    }
  }

  return NextResponse.json({ result, formatted, contextEntryId });
}
