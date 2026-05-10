import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";
import { getContextEntries, updateContextEntryMetadata } from "@/lib/context-store";
import { findMergeCandidates } from "@/lib/merge";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await getContextEntries();
  const candidates = findMergeCandidates(entries);
  return NextResponse.json(candidates);
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.department !== "management") {
    return NextResponse.json({ error: "Manager role required" }, { status: 403 });
  }

  const body = await req.json();
  const { parentId, childId, action } = body as {
    parentId?: string;
    childId?: string;
    action?: "approve" | "reject";
  };
  if (!parentId || !childId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "parentId, childId, action required" }, { status: 400 });
  }

  const partial =
    action === "approve"
      ? { mergeStatus: "approved", parentId, mergeApprovedAt: new Date().toISOString() }
      : { mergeStatus: "rejected", mergeDismissedAt: new Date().toISOString() };

  const updated = await updateContextEntryMetadata(childId, partial);
  return NextResponse.json({ ok: true, entry: updated });
}
