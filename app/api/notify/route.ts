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

// GET /api/notify/test?email=you@example.com — sends a live test notification.
// Use this to verify Pingram keys + templates are wired before the demo.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "?email= required" }, { status: 400 });

  const PINGRAM_CLIENT_ID = process.env.PINGRAM_CLIENT_ID ?? "";
  const PINGRAM_CLIENT_SECRET = process.env.PINGRAM_CLIENT_SECRET ?? "";

  if (!PINGRAM_CLIENT_ID || !PINGRAM_CLIENT_SECRET) {
    return NextResponse.json({
      ok: false,
      error: "PINGRAM_CLIENT_ID or PINGRAM_CLIENT_SECRET not set in .env.local",
    });
  }

  const authHeader = "Basic " + Buffer.from(`${PINGRAM_CLIENT_ID}:${PINGRAM_CLIENT_SECRET}`).toString("base64");

  // Send to both notification IDs so you can verify both templates exist
  const results = await Promise.all([
    fetch(`https://api.notificationapi.com/${PINGRAM_CLIENT_ID}/sender/cortex-context-alert/${encodeURIComponent(email)}`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        mergeTags: { sourceDept: "engineering", summary: "Test alert from Cortex", timestamp: new Date().toLocaleString() },
        user: { id: email, email },
      }),
    }).then(async r => ({ id: "cortex-context-alert", status: r.status, body: await r.text() })),

    fetch(`https://api.notificationapi.com/${PINGRAM_CLIENT_ID}/sender/cortex-context-change/${encodeURIComponent(email)}`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        mergeTags: { name: "Test User", department: "Engineering", summary: "Test change from Cortex", source: "manual", timestamp: new Date().toLocaleString() },
        user: { id: email, email },
      }),
    }).then(async r => ({ id: "cortex-context-change", status: r.status, body: await r.text() })),
  ]);

  return NextResponse.json({ ok: true, results });
}
