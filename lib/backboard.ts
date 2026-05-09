// Backboard.io integration — unified LLM router with persistent memory
// Falls back to direct Anthropic API if BACKBOARD_API_KEY is not set

import Anthropic from "@anthropic-ai/sdk";
import type { Department } from "@/types";
import type { ContextEntry } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const BACKBOARD_API_KEY = process.env.BACKBOARD_API_KEY;
const BACKBOARD_BASE_URL = "https://api.backboard.io/v1";

function buildSystemPrompt(
  department: Department,
  crossDeptContext: ContextEntry[]
): string {
  const contextBlock =
    crossDeptContext.length > 0
      ? `\n\nGLOBAL COMPANY CONTEXT (from other departments):\n${crossDeptContext
          .map(
            (c) =>
              `[${c.department.toUpperCase()}] ${c.summary}\nFull: ${c.text}`
          )
          .join("\n\n")}`
      : "";

  return `You are Cortex, an AI assistant for the ${department} department. You have access to the global company context — insights from every department — to give you the full picture when answering.

When the user's question could benefit from cross-department context, proactively reference it and explain how it's relevant to their work. Always be concise and actionable.

If the user shares new information that seems important for other departments to know, acknowledge it and let them know it will be added to the global context.${contextBlock}`;
}

export async function chatWithContext(
  messages: { role: "user" | "assistant"; content: string }[],
  department: Department,
  crossDeptContext: ContextEntry[]
): Promise<ReadableStream<Uint8Array>> {
  const systemPrompt = buildSystemPrompt(department, crossDeptContext);

  // Use Backboard if configured, else direct Anthropic
  if (BACKBOARD_API_KEY) {
    return backboardChat(messages, systemPrompt);
  }
  return anthropicStream(messages, systemPrompt);
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

async function backboardChat(
  messages: { role: "user" | "assistant"; content: string }[],
  system: string
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${BACKBOARD_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BACKBOARD_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      stream: true,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!response.ok || !response.body) {
    // Fallback to direct Anthropic
    return anthropicStream(messages, system);
  }

  return response.body;
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
        content: `Analyze this message from the ${department} department. If it contains substantial company-relevant information (decisions, plans, budgets, strategies, policies, goals), extract it.

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
