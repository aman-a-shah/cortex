import { NextRequest, NextResponse } from "next/server";
import { notifyDepartments } from "@/lib/pingram";

export async function POST(req: NextRequest) {
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
