import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ session: null });

  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ session: null });

  return NextResponse.json({ session });
}
