import type { ChatMessage, Department } from "@/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export interface StoredConversation {
  id: string;
  title: string;
  department: Department;
  messages: ChatMessage[];
  timestamp: string;
  backboardThreadId?: string;
}

interface ChatThreadRow {
  id: string;
  title: string | null;
  department_id: Department;
  updated_at: string;
  backboard_thread_id: string | null;
  chat_messages?: ChatMessageRow[];
}

interface ChatMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata: { contextRefs?: string[] } | null;
  created_at: string;
}

function mapMessage(row: ChatMessageRow, department: Department): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    department,
    contextRefs: row.metadata?.contextRefs,
    timestamp: row.created_at,
  };
}

export async function listConversations(
  userId: string,
  department: Department
): Promise<StoredConversation[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("chat_threads")
      .select(
        "id,title,department_id,updated_at,backboard_thread_id,chat_messages(id,role,content,metadata,created_at)"
      )
      .eq("user_id", userId)
      .eq("department_id", department)
      .order("updated_at", { ascending: false })
      .order("created_at", {
        referencedTable: "chat_messages",
        ascending: true,
      })
      .limit(12);

    if (error) throw error;

    return ((data ?? []) as ChatThreadRow[]).map((thread) => ({
      id: thread.id,
      title: thread.title ?? "Conversation",
      department: thread.department_id,
      messages: (thread.chat_messages ?? []).map((message) =>
        mapMessage(message, thread.department_id)
      ),
      timestamp: thread.updated_at,
      backboardThreadId: thread.backboard_thread_id ?? undefined,
    }));
  } catch (error) {
    console.error("[supabase] chat history read failed", error);
    return [];
  }
}

export async function createConversation(
  userId: string,
  department: Department,
  title: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("chat_threads")
      .insert({
        user_id: userId,
        department_id: department,
        title: title || "Conversation",
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error("[supabase] chat thread create failed", error);
    return null;
  }
}

export async function addChatMessage(
  threadId: string | null,
  department: Department,
  role: "user" | "assistant",
  content: string,
  contextRefs?: string[]
): Promise<void> {
  if (!threadId || !isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      role,
      content,
      metadata: contextRefs?.length ? { contextRefs } : {},
    });
    if (error) throw error;

    await supabase
      .from("chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("department_id", department);
  } catch (error) {
    console.error("[supabase] chat message write failed", error);
  }
}
