import type { ContextEntry, Department } from "@/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { syncContextToBackboard } from "@/lib/backboard";
import { logger } from "@/lib/logger";
import { CROSS_DEPT_SLICE } from "@/lib/constants";
import { getUserName } from "@/lib/user-registry";

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
  backboard_synced_at: string | null;
  backboard_sync_error: string | null;
  created_by: string | null;
}

function mapContextRow(row: ContextRow): ContextEntry {
  const createdByUserId = row.created_by ?? undefined;
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
    backboardSyncedAt: row.backboard_synced_at ?? undefined,
    backboardSyncError: row.backboard_sync_error ?? undefined,
    createdByUserId,
    createdByName: createdByUserId ? (getUserName(createdByUserId) ?? undefined) : undefined,
  };
}

export async function getContextEntries(): Promise<ContextEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabaseAdmin()
        .from("context_entries")
        .select(
          "id,department_id,text,summary,media_url,media_public_id,source,created_at,token_count,backboard_synced_at,backboard_sync_error,created_by"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return ((data ?? []) as ContextRow[]).map(mapContextRow);
    } catch (error) {
      logger.error("context-store", "context read failed", error);
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
    .slice(0, CROSS_DEPT_SLICE);
}

export async function deleteContextEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (!isSupabaseConfigured()) {
    for (const id of ids) {
      const idx = store.findIndex(e => e.id === id);
      if (idx !== -1) store.splice(idx, 1);
    }
    return;
  }
  try {
    await getSupabaseAdmin().from("context_entries").delete().in("id", ids);
  } catch (error) {
    logger.error("context-store", "context delete failed", error);
  }
}

export async function deleteUserDeptContext(userId: string, department: Department): Promise<void> {
  if (!isSupabaseConfigured()) {
    const before = store.length;
    store.splice(0, store.length, ...store.filter(e => e.department !== department));
    logger.info("context-store", `removed ${before - store.length} in-memory entries`);
    return;
  }
  try {
    await getSupabaseAdmin()
      .from("context_entries")
      .delete()
      .eq("created_by", userId)
      .eq("department_id", department);
  } catch (error) {
    logger.error("context-store", "user dept context delete failed", error);
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
          "id,department_id,text,summary,media_url,media_public_id,source,created_at,token_count,backboard_synced_at,backboard_sync_error"
        )
        .single();

      if (error) throw error;
      const created = mapContextRow(data as ContextRow);
      try {
        await syncContextToBackboard(created);
      } catch (syncError) {
        logger.error("context-store", "backboard sync failed", syncError);
      }
      return created;
    } catch (error) {
      logger.error("context-store", "context write failed", error);
    }
  }

  const newEntry: ContextEntry = {
    ...entry,
    id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    createdByUserId: createdBy,
    createdByName: createdBy ? (getUserName(createdBy) ?? undefined) : undefined,
  };
  store.unshift(newEntry);
  return newEntry;
}
