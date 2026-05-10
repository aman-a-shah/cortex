// Backboard integration: one shared company context memory plus chat routing.
// Falls back to direct Anthropic if Backboard is not configured or unavailable.

import Anthropic from "@anthropic-ai/sdk";
import type { ContextEntry, Department } from "@/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const BACKBOARD_API_KEY = process.env.BACKBOARD_API_KEY;
const BACKBOARD_BASE_URL = "https://app.backboard.io/api";

export type BackboardStatus = "used" | "fallback" | "not_configured";

export interface ChatStreamResult {
  stream: ReadableStream<Uint8Array>;
  backboardStatus: BackboardStatus;
  backboardDetail: string;
}

interface BackboardAgentRow {
  backboard_thread_id: string;
}

interface BackboardMessagePayload {
  content: string;
  stream?: boolean;
  thread_id?: string;
  memory?: "Auto" | "Readonly" | "off";
  memory_response_citation?: boolean;
}

function isBackboardConfigured(): boolean {
  return Boolean(BACKBOARD_API_KEY);
}

function buildSystemPrompt(
  department: Department,
  crossDeptContext: ContextEntry[],
  peerExperiences: ContextEntry[] = []
): string {
  const contextBlock =
    crossDeptContext.length > 0
      ? `\n\nRECENT COMPANY CONTEXT SNAPSHOT:\n${crossDeptContext
          .map(
            (c) =>
              `[${c.department.toUpperCase()}] ${c.summary}\nFull: ${c.text}`
          )
          .join("\n\n")}`
      : "";

  const peerBlock =
    peerExperiences.length > 0
      ? `\n\nPEER EXPERIENCES — colleagues who encountered similar situations:\n${peerExperiences
          .map((e) => {
            const who = e.createdByName ?? "A colleague";
            const dept = e.department.charAt(0).toUpperCase() + e.department.slice(1);
            return `• ${who} (${dept}): ${e.summary}\n  Detail: ${e.text.slice(0, 300)}${e.text.length > 300 ? "…" : ""}`;
          })
          .join("\n\n")}\n\nIf the user's question relates to one of these peer experiences, naturally mention it — e.g. "Interestingly, [Name] from [Dept] ran into something similar and found that…". Only reference them when genuinely relevant; do not force it.`
      : "";

  return `You are Cortex, the AI agent for the ${department} department.

You are connected to a shared company memory. Use the latest cross-department context when it affects your answer. If design, finance, legal, marketing, product, management, or engineering has established a constraint, preference, decision, plan, budget, policy, or goal, follow it without requiring the user to restate it.

Be concise and actionable. When useful, mention which department context influenced your answer.${contextBlock}${peerBlock}`;
}

const STOP_WORDS = new Set([
  "the","and","for","are","but","not","you","all","can","had","her","was","one","our","out","day","get","has","him","his","how","man","new","now","old","see","two","way","who","boy","did","its","let","put","say","she","too","use","that","this","with","have","from","they","will","been","each","which","there","their","what","when","were","what","your","also","into","than","then","them","these","some","like","more","just","over","such","even","most","make","also","after","about","would","could","should","other","been","said","want","here","know","does","very","only","well","back","come","give","good","look","most","move","need","next","only","open","over","same","seem","show","take","than","then","time","turn","used","want","well","work",
]);

// Keyword-overlap similarity: returns entries (from other users) whose summary/text
// share at least MIN_OVERLAP meaningful words with the given message.
const MIN_OVERLAP = 2;

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  );
}

export function findSimilarEntries(
  message: string,
  currentUserId: string,
  allEntries: ContextEntry[],
  maxResults = 3
): ContextEntry[] {
  const msgKeywords = extractKeywords(message);
  if (msgKeywords.size === 0) return [];

  const scored = allEntries
    .filter((e) => e.createdByUserId && e.createdByUserId !== currentUserId && e.createdByName)
    .map((e) => {
      const entryKeywords = extractKeywords(`${e.summary} ${e.text}`);
      let overlap = 0;
      for (const kw of msgKeywords) {
        if (entryKeywords.has(kw)) overlap++;
      }
      return { entry: e, overlap };
    })
    .filter(({ overlap }) => overlap >= MIN_OVERLAP)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, maxResults)
    .map(({ entry }) => entry);

  return scored;
}

function contextSyncMessage(entry: ContextEntry): string {
  return `New Cortex company context.

Department: ${entry.department}
Summary: ${entry.summary}
Source: ${entry.source ?? "Cortex"}
Created at: ${entry.createdAt}

Full context:
${entry.text}

Use this in future answers whenever it is relevant.`;
}

async function createBackboardThread(system: string): Promise<string | null> {
  if (!isBackboardConfigured()) return null;

  try {
    const res = await sendBackboardMessage(null, system, false, "Auto");
    if (!res) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data.id ?? data.thread_id ?? null;
  } catch (error) {
    console.error("[backboard] create thread failed", error);
    return null;
  }
}

async function sendBackboardMessage(
  threadId: string | null,
  content: string,
  stream: boolean,
  memory: "Auto" | "Readonly" | "off" = "off"
): Promise<Response | null> {
  if (!isBackboardConfigured()) return null;

  const payload: BackboardMessagePayload = {
    content,
    stream,
    memory,
    memory_response_citation: true,
  };
  if (threadId) payload.thread_id = threadId;

  return fetch(`${BACKBOARD_BASE_URL}/threads/messages`, {
    method: "POST",
    headers: {
      "X-API-Key": BACKBOARD_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function getBackboardAgent(): Promise<string | null> {
  if (!isBackboardConfigured() || !isSupabaseConfigured()) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("backboard_agents")
    .select("backboard_thread_id")
    .eq("scope", "company")
    .is("department_id", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[supabase] backboard agent read failed", error);
    return null;
  }

  return (data as BackboardAgentRow | null)?.backboard_thread_id ?? null;
}

async function saveBackboardAgent(
  backboardThreadId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await getSupabaseAdmin().from("backboard_agents").upsert(
    {
      scope: "company",
      department_id: null,
      backboard_thread_id: backboardThreadId,
    },
    { onConflict: "scope,department_key" }
  );

  if (error) console.error("[supabase] backboard agent save failed", error);
}

async function getOrCreateBackboardAgent(): Promise<string | null> {
  const existing = await getBackboardAgent();
  if (existing) return existing;

  const label = "Cortex global company context memory";
  const system =
    "You are Cortex's global company memory. Store durable cross-department context updates. Future department agents will ask you questions and expect you to apply the latest company constraints, decisions, preferences, policies, budgets, timelines, design standards, and product requirements.";

  const threadId = await createBackboardThread(`${label}\n\n${system}`);
  if (!threadId) return null;

  await saveBackboardAgent(threadId);
  return threadId;
}


async function markContextBackboardStatus(
  entryId: string,
  status: "synced" | "failed",
  errorMessage?: string
): Promise<void> {
  if (!isSupabaseConfigured() || entryId.startsWith("ctx-")) return;

  const update =
    status === "synced"
      ? {
          backboard_synced_at: new Date().toISOString(),
          backboard_sync_error: null,
        }
      : {
          backboard_sync_error: errorMessage?.slice(0, 500) ?? "Sync failed",
        };

  const { error } = await getSupabaseAdmin()
    .from("context_entries")
    .update(update)
    .eq("id", entryId);

  if (error) console.error("[supabase] backboard status update failed", error);
}

export async function syncContextToBackboard(
  entry: ContextEntry
): Promise<void> {
  if (!isBackboardConfigured()) return;

  const message = contextSyncMessage(entry);
  const threadId = await getOrCreateBackboardAgent();

  if (!threadId) {
    await markContextBackboardStatus(entry.id, "failed", "No Backboard thread");
    return;
  }

  const response = await sendBackboardMessage(threadId, message, false, "Auto");

  await markContextBackboardStatus(
    entry.id,
    response?.ok ? "synced" : "failed",
    response?.ok
      ? undefined
      : `Backboard context sync failed${response ? `: ${response.status}` : ""}`
  );
}

export async function chatWithContext(
  messages: { role: "user" | "assistant"; content: string }[],
  department: Department,
  crossDeptContext: ContextEntry[],
  peerExperiences: ContextEntry[] = []
): Promise<ChatStreamResult> {
  const systemPrompt = buildSystemPrompt(department, crossDeptContext, peerExperiences);

  if (isBackboardConfigured()) {
    const stream = await backboardGlobalChat(
      messages,
      systemPrompt,
      department
    );
    if (stream) {
      return {
        stream,
        backboardStatus: "used",
        backboardDetail: "Using global Backboard memory",
      };
    }

    return {
      stream: await anthropicStream(messages, systemPrompt),
      backboardStatus: "fallback",
      backboardDetail: "Backboard unavailable; used Anthropic fallback",
    };
  }

  return {
    stream: await anthropicStream(messages, systemPrompt),
    backboardStatus: "not_configured",
    backboardDetail: "Backboard key not configured; used Anthropic",
  };
}

async function anthropicStream(
  messages: { role: "user" | "assistant"; content: string }[],
  system: string
): Promise<ReadableStream<Uint8Array>> {
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    messages,
  });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });
}

async function backboardGlobalChat(
  messages: { role: "user" | "assistant"; content: string }[],
  system: string,
  department: Department
): Promise<ReadableStream<Uint8Array> | null> {
  const threadId = await getOrCreateBackboardAgent();
  if (!threadId) return null;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return null;

  const response = await sendBackboardMessage(
    threadId,
    `${system}\n\nCurrent user department: ${department}\n\nUser message:\n${lastUser.content}`,
    true,
    "Readonly"
  );

  if (!response || !response.ok || !response.body) {
    console.error(
      "[backboard] chat failed",
      response?.status,
      response ? await response.text() : "no response"
    );
    return null;
  }

  return backboardSseToTextStream(response.body);
}

function backboardSseToTextStream(
  body: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const dataLine = event
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const payload = JSON.parse(dataLine.slice(6));
            if (
              payload.type === "content_streaming" &&
              typeof payload.content === "string"
            ) {
              controller.enqueue(encoder.encode(payload.content));
            }
          } catch {
            continue;
          }
        }
      }

      controller.close();
    },
  });
}

export async function extractContextFromMessage(
  message: string,
  department: Department
): Promise<{ shouldStore: boolean; summary: string; text: string } | null> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Analyze this message from the ${department} department. If it contains substantial company-relevant information (decisions, plans, budgets, strategies, policies, goals, design standards, product requirements, technical constraints, budgets, deadlines, policies), extract it.

Message: "${message}"

Respond with JSON only:
{
  "shouldStore": true/false,
  "summary": "one line summary under 100 chars, or empty string",
  "text": "cleaned up full context text to store, or empty string"
}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
