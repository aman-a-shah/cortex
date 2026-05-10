import { NextRequest, NextResponse } from "next/server";
import { getContextEntries, addContextEntry, deleteContextEntries, deleteUserDeptContext } from "@/lib/context-store";
import { notifyContextEntryCreated } from "@/lib/pingram";
import { scanForSecrets } from "@/lib/cystack";
import { verifyToken, TOKEN_COOKIE, type SessionPayload } from "@/lib/auth";
import type { Department } from "@/types";

const MCP_TOKEN = process.env.CORTEX_MCP_TOKEN;

// Resolve a session from either the cookie JWT or an MCP bearer token.
// Bearer-token requests get a synthetic "mcp" session with department taken
// from the X-Cortex-Department header (POST) or the request body's department.
async function resolveSession(req: NextRequest, fallbackDept?: Department): Promise<SessionPayload | null> {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (token) {
    const session = await verifyToken(token);
    if (session) return session;
  }
  if (MCP_TOKEN) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth === `Bearer ${MCP_TOKEN}`) {
      const dept = (req.headers.get("x-cortex-department") as Department | null) ?? fallbackDept ?? "engineering";
      return {
        userId: "mcp",
        department: dept,
        name: "MCP",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await resolveSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await getContextEntries();
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const session = await resolveSession(req, body?.department as Department | undefined);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { department, text, summary, mediaUrl, mediaPublicId, source, metadata } = body;

  if (!department || !text || !summary) {
    return NextResponse.json(
      { error: "department, text, and summary are required" },
      { status: 400 }
    );
  }

  const scan = await scanForSecrets(text);
  const summaryScan = await scanForSecrets(summary);
  const enrichedMetadata = {
    ...(metadata ?? {}),
    securityScanned: true,
    redactionsCount: scan.redactionsCount + summaryScan.redactionsCount,
    redactionTypes: Array.from(
      new Set([...scan.redactionTypes, ...summaryScan.redactionTypes])
    ),
  };

  const entry = await addContextEntry({
    department: department as Department,
    text: scan.cleaned,
    summary: summaryScan.cleaned,
    mediaUrl,
    mediaPublicId,
    source,
    metadata: enrichedMetadata,
    tokenCount: Math.ceil(scan.cleaned.length / 4),
  }, session.userId);

  notifyContextEntryCreated({ entry, actorSession: session }).catch((err) =>
    console.warn("[context] notify fan-out failed", err)
  );

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await deleteContextEntries(body.ids);
  } else if (body.department) {
    await deleteUserDeptContext(session.userId, body.department as Department);
  }

  return NextResponse.json({ ok: true });
}
