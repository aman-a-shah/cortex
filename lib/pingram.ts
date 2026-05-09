// Pingram (NotificationAPI) integration for department notifications

const PINGRAM_CLIENT_ID = process.env.PINGRAM_CLIENT_ID ?? "";
const PINGRAM_CLIENT_SECRET = process.env.PINGRAM_CLIENT_SECRET ?? "";
const PINGRAM_BASE_URL = "https://api.notificationapi.com";

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
      fetch(
        `${PINGRAM_BASE_URL}/${PINGRAM_CLIENT_ID}/sender/cortex-context-alert/${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                `${PINGRAM_CLIENT_ID}:${PINGRAM_CLIENT_SECRET}`
              ).toString("base64"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mergeTags: {
              sourceDept: params.sourceDept,
              summary: params.summary,
              timestamp: new Date().toLocaleString(),
            },
          }),
        }
      )
    )
  );
}
