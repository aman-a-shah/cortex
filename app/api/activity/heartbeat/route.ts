import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";
import { recordHeartbeat } from "@/lib/presence";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  if (session.email) {
    recordHeartbeat(session.userId, session.email, session.name);
  }

  return NextResponse.json({ ok: true });
}
