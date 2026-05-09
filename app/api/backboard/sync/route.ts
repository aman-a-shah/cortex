import { NextRequest, NextResponse } from "next/server";
import { getContextEntries } from "@/lib/context-store";
import { syncContextToBackboard } from "@/lib/backboard";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await getContextEntries();
  const unsynced = entries.filter((entry) => !entry.backboardSyncedAt);

  const results = await Promise.allSettled(
    unsynced.map((entry) => syncContextToBackboard(entry))
  );

  return NextResponse.json({
    attempted: unsynced.length,
    synced: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  });
}
