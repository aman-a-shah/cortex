// Server-side registry of userId -> name, populated from session tokens as users interact.
// Used to hydrate createdByName on context entries without requiring a DB users table.

const registry = new Map<string, string>();

export function registerUser(userId: string, name: string): void {
  registry.set(userId, name);
}

export function getUserName(userId: string): string | null {
  return registry.get(userId) ?? null;
}
