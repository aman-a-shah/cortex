import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

const PROTECTED_API_PREFIXES = ["/api/chat", "/api/context", "/api/aucctus", "/api/media", "/api/notify", "/api/composio"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifyToken(token);
  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const res = NextResponse.next();
  res.headers.set("x-cortex-department", session.department);
  res.headers.set("x-cortex-name", session.name);
  return res;
}

export const config = {
  matcher: ["/api/chat/:path*", "/api/context/:path*", "/api/aucctus/:path*", "/api/media/:path*", "/api/notify/:path*", "/api/composio/:path*"],
};
