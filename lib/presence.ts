// In-memory presence store — tracks which users are currently active on the site.
// A user is considered active if they sent a heartbeat within the last 90 seconds.

interface PresenceRecord {
  userId: string;
  email: string;
  name: string;
  lastSeen: number; // ms timestamp
}

const store = new Map<string, PresenceRecord>();
const TTL_MS = 90_000;

export function recordHeartbeat(userId: string, email: string, name: string): void {
  store.set(userId, { userId, email, name, lastSeen: Date.now() });
}

export function isUserActive(userId: string): boolean {
  const record = store.get(userId);
  if (!record) return false;
  return Date.now() - record.lastSeen < TTL_MS;
}

export function removeUser(userId: string): void {
  store.delete(userId);
}
