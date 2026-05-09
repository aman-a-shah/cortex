import { NextRequest, NextResponse } from "next/server";
import { executeTool, formatToolResult, TOOL_MAP } from "@/lib/composio";
import type { ToolId } from "@/lib/composio";

export async function POST(req: NextRequest) {
  const { toolId, query } = await req.json();

  if (!toolId || !(toolId in TOOL_MAP)) {
    return NextResponse.json({ error: "Invalid toolId" }, { status: 400 });
  }

  const result = await executeTool(toolId as ToolId, query ?? "");
  const formatted = formatToolResult(result);

  return NextResponse.json({ result, formatted });
}
