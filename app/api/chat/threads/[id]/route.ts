import { NextRequest, NextResponse } from "next/server";
import { deleteConversation } from "@/lib/chat-store";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteConversation(id);
  return NextResponse.json({ ok: true });
}
