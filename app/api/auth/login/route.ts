import { NextRequest, NextResponse } from "next/server";
import { signToken, validatePassword, TOKEN_COOKIE } from "@/lib/auth";
import type { Department } from "@/types";

export async function POST(req: NextRequest) {
  const { department, password, name } = await req.json();

  if (!department || !password) {
    return NextResponse.json(
      { error: "department and password required" },
      { status: 400 }
    );
  }

  if (!validatePassword(department as Department, password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signToken(
    department as Department,
    name?.trim() || department
  );

  const res = NextResponse.json({ ok: true, department });
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });

  return res;
}
