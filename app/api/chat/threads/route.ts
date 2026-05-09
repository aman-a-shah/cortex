import { NextRequest, NextResponse } from "next/server";
import { listConversations } from "@/lib/chat-store";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listConversations(
    session.userId,
    session.department
  );

  return NextResponse.json(conversations);
}
