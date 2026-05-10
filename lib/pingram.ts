// Pingram (NotificationAPI) integration for department notifications
import type { ContextEntry, Department } from "@/types";
import type { SessionPayload } from "@/lib/auth";
import { getDeptRecipients } from "@/lib/user-registry";

const PINGRAM_CLIENT_ID = process.env.PINGRAM_CLIENT_ID ?? "";
const PINGRAM_CLIENT_SECRET = process.env.PINGRAM_CLIENT_SECRET ?? "";
const PINGRAM_BASE_URL = "https://api.notificationapi.com";

function authHeader(): string {
  return "Basic " + Buffer.from(`${PINGRAM_CLIENT_ID}:${PINGRAM_CLIENT_SECRET}`).toString("base64");
}

function sendNotification(
  notificationId: string,
  userId: string,
  mergeTags: Record<string, string>,
  email?: string,
): Promise<Response> {
  return fetch(
    `${PINGRAM_BASE_URL}/${PINGRAM_CLIENT_ID}/sender/${notificationId}/${encodeURIComponent(userId)}`,
    {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({
        mergeTags,
        ...(email ? { user: { id: userId, email } } : {}),
      }),
    }
  );
}

export async function notifyDepartments(params: {
  sourceDept: string;
  summary: string;
  targetEmails?: string[];
}): Promise<void> {
  if (!PINGRAM_CLIENT_ID || !PINGRAM_CLIENT_SECRET) return;

  const recipients =
    params.targetEmails && params.targetEmails.length > 0
      ? params.targetEmails
      : ["demo@cortex.ai"];

  await Promise.allSettled(
    recipients.map((email) =>
      sendNotification("cortex-context-alert", email, {
        sourceDept: params.sourceDept,
        summary: params.summary,
        timestamp: new Date().toLocaleString(),
      }, email)
    )
  );
}

// Sends a real-time context-change email to the active user via Pingram.
// Only fires if the user is currently active on the site (heartbeat within 90s).
export async function notifyContextChange(params: {
  userId: string;
  email: string;
  name: string;
  department: string;
  summary: string;
  source: string;
}): Promise<void> {
  if (!PINGRAM_CLIENT_ID || !PINGRAM_CLIENT_SECRET) return;

  const { isUserActive } = await import("@/lib/presence");
  if (!isUserActive(params.userId)) return;

  const timestamp = new Date().toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  await sendNotification("cortex-context-change", params.email, {
    name: params.name,
    department: params.department.charAt(0).toUpperCase() + params.department.slice(1),
    summary: params.summary,
    source: params.source,
    timestamp,
  }, params.email);
}

// Top-level fan-out for new context entries.
// 1. Sends a dept-targeted email blast to recipients in OTHER departments.
// 2. Per active user (excluding the actor), fires the per-user real-time
//    context-change notification.
export async function notifyContextEntryCreated(params: {
  entry: ContextEntry;
  actorSession: SessionPayload | null;
}): Promise<void> {
  const { entry, actorSession } = params;
  const sourceDept = entry.department;

  // Collect recipient emails from every dept except the source dept.
  const otherDepts: Department[] = [
    "engineering",
    "marketing",
    "finance",
    "legal",
    "product",
    "management",
  ].filter((d) => d !== sourceDept) as Department[];

  const targetEmails = otherDepts.flatMap((d) =>
    getDeptRecipients(d).map((r) => r.email)
  );

  await notifyDepartments({
    sourceDept,
    summary: entry.summary,
    targetEmails,
  });

  // Real-time per-user fan-out (skips users who aren't active or who authored).
  const { getActiveUsers } = await import("@/lib/presence");
  const actors = actorSession?.userId;
  const activeUsers = getActiveUsers().filter(
    (u) => u.userId !== actors && u.email
  );

  await Promise.allSettled(
    activeUsers.map((u) =>
      notifyContextChange({
        userId: u.userId,
        email: u.email,
        name: u.name,
        department: u.department ?? sourceDept,
        summary: entry.summary,
        source: entry.source ?? "context",
      })
    )
  );
}
