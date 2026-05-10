import { NextRequest, NextResponse } from "next/server";
import { notifyDepartments } from "@/lib/pingram";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceDept, summary, targetEmails } = await req.json();

  if (!sourceDept || !summary) {
    return NextResponse.json(
      { error: "sourceDept and summary required" },
      { status: 400 }
    );
  }

  await notifyDepartments({ sourceDept, summary, targetEmails });
  return NextResponse.json({ ok: true });
}
