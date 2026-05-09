import { NextRequest, NextResponse } from "next/server";
import { getContextEntries, addContextEntry } from "@/lib/context-store";
import { notifyDepartments } from "@/lib/pingram";
import type { Department } from "@/types";

export async function GET() {
  const entries = getContextEntries();
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { department, text, summary, mediaUrl, mediaPublicId, source } = body;

  if (!department || !text || !summary) {
    return NextResponse.json(
      { error: "department, text, and summary are required" },
      { status: 400 }
    );
  }

  const entry = addContextEntry({
    department: department as Department,
    text,
    summary,
    mediaUrl,
    mediaPublicId,
    source,
    tokenCount: Math.ceil(text.length / 4),
  });

  await notifyDepartments({ sourceDept: department, summary });

  return NextResponse.json(entry, { status: 201 });
}
