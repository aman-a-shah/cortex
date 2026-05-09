import { createHash } from "crypto";
import type { Department } from "@/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function fallbackUserId(department: Department, name: string): string {
  const hash = createHash("sha256")
    .update(`${department}:${name.toLowerCase().trim()}`)
    .digest("hex")
    .slice(0, 32);

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20),
  ].join("-");
}

export async function ensureSupabaseUser(
  department: Department,
  name: string
): Promise<string> {
  if (!isSupabaseConfigured()) {
    return fallbackUserId(department, name);
  }

  const cleanName = name.trim() || department;
  try {
    const supabase = getSupabaseAdmin();
    const email = `${slugify(department)}.${slugify(cleanName) || "user"}@cortex.local`;

    const users = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (users.error) throw users.error;

    const existing = users.data.users.find(
      (user) => user.email?.toLowerCase() === email
    );

    let userId = existing?.id;

    if (!userId) {
      const created = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: cleanName, department },
      });

      if (created.error) throw created.error;
      userId = created.data.user?.id;
    }

    if (!userId) {
      throw new Error("Unable to create Supabase user");
    }

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      name: cleanName,
      department_id: department,
    });

    if (error) throw error;
    return userId;
  } catch (error) {
    console.error("[supabase] auth/profile sync failed", error);
    return fallbackUserId(department, cleanName);
  }
}
