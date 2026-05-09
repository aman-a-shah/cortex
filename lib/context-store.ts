import type { ContextEntry, Department } from "@/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

const store: ContextEntry[] = [];

interface ContextRow {
  id: string;
  department_id: Department;
  text: string;
  summary: string;
  media_url: string | null;
  media_public_id: string | null;
  source: string | null;
  created_at: string;
  token_count: number | null;
}

function mapContextRow(row: ContextRow): ContextEntry {
  return {
    id: row.id,
    department: row.department_id,
    text: row.text,
    summary: row.summary,
    mediaUrl: row.media_url ?? undefined,
    mediaPublicId: row.media_public_id ?? undefined,
    source: row.source ?? undefined,
    createdAt: row.created_at,
    tokenCount: row.token_count ?? Math.ceil(row.text.length / 4),
  };
}

export async function getContextEntries(): Promise<ContextEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabaseAdmin()
        .from("context_entries")
        .select(
          "id,department_id,text,summary,media_url,media_public_id,source,created_at,token_count"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return ((data ?? []) as ContextRow[]).map(mapContextRow);
    } catch (error) {
      console.error("[supabase] context read failed", error);
    }
  }

  return [...store].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getContextByDepartment(
  dept: Department
): Promise<ContextEntry[]> {
  const entries = await getContextEntries();
  return entries.filter((e) => e.department === dept);
}

export async function getCrossDepContext(
  activeDept: Department
): Promise<ContextEntry[]> {
  const entries = await getContextEntries();
  return entries
    .filter((e) => e.department !== activeDept)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 8);
}

export async function deleteContextEntries(ids: string[]): Promise<void> {
  if (!isSupabaseConfigured() || ids.length === 0) {
    // also delete from in-memory store
    for (const id of ids) {
      const idx = store.findIndex(e => e.id === id);
      if (idx !== -1) store.splice(idx, 1);
    }
    return;
  }
  try {
    await getSupabaseAdmin().from("context_entries").delete().in("id", ids);
  } catch (error) {
    console.error("[supabase] context delete failed", error);
  }
}

export async function deleteUserDeptContext(userId: string, department: Department): Promise<void> {
  if (!isSupabaseConfigured()) {
    // remove from in-memory store by dept
    const before = store.length;
    store.splice(0, store.length, ...store.filter(e => e.department !== department));
    console.log(`[store] removed ${before - store.length} in-memory entries`);
    return;
  }
  try {
    await getSupabaseAdmin()
      .from("context_entries")
      .delete()
      .eq("created_by", userId)
      .eq("department_id", department);
  } catch (error) {
    console.error("[supabase] user dept context delete failed", error);
  }
}

export async function addContextEntry(
  entry: Omit<ContextEntry, "id" | "createdAt">,
  createdBy?: string
): Promise<ContextEntry> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabaseAdmin()
        .from("context_entries")
        .insert({
          department_id: entry.department,
          created_by: createdBy,
          text: entry.text,
          summary: entry.summary,
          media_url: entry.mediaUrl,
          media_public_id: entry.mediaPublicId,
          source: entry.source,
          token_count: entry.tokenCount,
        })
        .select(
          "id,department_id,text,summary,media_url,media_public_id,source,created_at,token_count"
        )
        .single();

      if (error) throw error;
      return mapContextRow(data as ContextRow);
    } catch (error) {
      console.error("[supabase] context write failed", error);
    }
  }

  const newEntry: ContextEntry = {
    ...entry,
    id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  store.unshift(newEntry);
  return newEntry;
}
