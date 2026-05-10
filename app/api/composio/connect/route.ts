import { NextRequest, NextResponse } from "next/server";
import { createConnectLink, TOOL_MAP } from "@/lib/composio";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";
import type { ToolId } from "@/lib/composio";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { toolId } = await req.json();
  if (!toolId || !(toolId in TOOL_MAP)) {
    return NextResponse.json({ error: "Invalid toolId" }, { status: 400 });
  }

  const entityId = session.userId;
  const callbackUrl = new URL("/", req.nextUrl.origin).toString();

  try {
    const redirectUrl = await createConnectLink(toolId as ToolId, entityId, callbackUrl);
    return NextResponse.json({ redirectUrl, entityId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create Composio connect link" },
      { status: 500 }
    );
  }
}
