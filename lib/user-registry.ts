// Server-side registry of userId -> name, populated from session tokens as users interact.
// Used to hydrate createdByName on context entries without requiring a DB users table.

import type { Department } from "@/types";
import { getActiveUsers } from "@/lib/presence";

const registry = new Map<string, string>();

export function registerUser(userId: string, name: string): void {
  registry.set(userId, name);
}

export function getUserName(userId: string): string | null {
  return registry.get(userId) ?? null;
}

export interface DeptRecipient {
  userId: string;
  email: string;
  name: string;
  department: Department;
}

// Returns currently-active users in a given department. Pulled from presence
// rather than a users table so the demo works without Supabase configured.
export function getDeptRecipients(dept: Department): DeptRecipient[] {
  return getActiveUsers()
    .filter((u) => u.department === dept && u.email)
    .map((u) => ({
      userId: u.userId,
      email: u.email,
      name: u.name,
      department: dept,
    }));
}
