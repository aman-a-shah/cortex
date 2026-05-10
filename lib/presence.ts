import { PRESENCE_TTL_MS } from "@/lib/constants";

interface PresenceRecord {
  userId: string;
  email: string;
  name: string;
  lastSeen: number;
}

const store = new Map<string, PresenceRecord>();

export function recordHeartbeat(userId: string, email: string, name: string): void {
  store.set(userId, { userId, email, name, lastSeen: Date.now() });
}

export function isUserActive(userId: string): boolean {
  const record = store.get(userId);
  if (!record) return false;
  return Date.now() - record.lastSeen < PRESENCE_TTL_MS;
}

export function removeUser(userId: string): void {
  store.delete(userId);
}
