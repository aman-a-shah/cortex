import { PRESENCE_TTL_MS } from "@/lib/constants";
import type { Department } from "@/types";

interface PresenceRecord {
  userId: string;
  email: string;
  name: string;
  department?: Department;
  lastSeen: number;
}

const store = new Map<string, PresenceRecord>();

export function recordHeartbeat(
  userId: string,
  email: string,
  name: string,
  department?: Department
): void {
  store.set(userId, { userId, email, name, department, lastSeen: Date.now() });
}

export function isUserActive(userId: string): boolean {
  const record = store.get(userId);
  if (!record) return false;
  return Date.now() - record.lastSeen < PRESENCE_TTL_MS;
}

export function removeUser(userId: string): void {
  store.delete(userId);
}

export function getActiveUsers(): PresenceRecord[] {
  const now = Date.now();
  return [...store.values()].filter((r) => now - r.lastSeen < PRESENCE_TTL_MS);
}
