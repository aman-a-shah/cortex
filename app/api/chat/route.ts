import { NextRequest } from "next/server";
import { chatWithContext, extractContextFromMessage } from "@/lib/backboard";
import {
  getCrossDepContext,
  addContextEntry,
} from "@/lib/context-store";
import {
  addChatMessage,
  createConversation,
} from "@/lib/chat-store";
import { notifyDepartments, notifyContextChange } from "@/lib/pingram";
import { fetchLiveToolContext } from "@/lib/composio";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";
import type { Department, ContextEntry } from "@/types";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, threadId } = await req.json();
  const dept = session.department as Department;
  const crossDept = await getCrossDepContext(dept);

  const lastUserMessage = [...messages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === "user");

  // Auto-enrich context with live tool data if the message references a connected tool.
  // Runs in parallel with other setup; 2.5s timeout so it never blocks the response.
  const lastUserContent = lastUserMessage?.content ?? "";
  let composioTool: string | null = null;
  const liveCtx = await fetchLiveToolContext(lastUserContent, session.userId);
  if (liveCtx) {
    composioTool = liveCtx.toolId;
    const composioEntry: ContextEntry = {
      id: "composio-live",
      department: dept,
      text: liveCtx.text,
      summary: liveCtx.summary,
      source: `composio-${liveCtx.toolId}`,
      createdAt: new Date().toISOString(),
      tokenCount: Math.ceil(liveCtx.text.length / 4),
    };
    crossDept.unshift(composioEntry);
  }

  const { stream } = await chatWithContext(messages, dept, crossDept);

  const currentThreadId =
    threadId ??
    (await createConversation(
      session.userId,
      dept,
      lastUserMessage?.content?.slice(0, 52) ?? "Conversation"
    ));

  if (lastUserMessage) {
    await addChatMessage(currentThreadId, dept, "user", lastUserMessage.content);
  }

  if (lastUserMessage) {
    extractContextFromMessage(lastUserMessage.content, dept)
      .then(async (extracted) => {
        if (extracted?.shouldStore && extracted.summary && extracted.text) {
          const entry = await addContextEntry({
            department: dept,
            text: extracted.text,
            summary: extracted.summary,
            source: "chat-extract",
            tokenCount: Math.ceil(extracted.text.length / 4),
          }, session.userId);
          await notifyDepartments({
            sourceDept: dept,
            summary: extracted.summary,
          });
          if (session.email) {
            notifyContextChange({
              userId: session.userId,
              email: session.email,
              name: session.name,
              department: dept,
              summary: extracted.summary,
              source: "chat-extract",
            }).catch(console.error);
          }
          console.log("[cortex] stored context:", entry.id);
        }
      })
      .catch(console.error);
  }

  const trackedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          controller.enqueue(value);
        }

        if (accumulated) {
          const contextRefs = crossDept
            .filter((e) =>
              accumulated.toLowerCase().includes(e.department.toLowerCase())
            )
            .slice(0, 3)
            .map((e) => e.department);

          await addChatMessage(
            currentThreadId,
            dept,
            "assistant",
            accumulated,
            [...new Set(contextRefs)]
          );
        }
      } catch (error) {
        controller.error(error);
        return;
      }

      controller.close();
    },
  });

  return new Response(trackedStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      ...(currentThreadId ? { "X-Cortex-Thread-Id": currentThreadId } : {}),
      ...(composioTool ? { "X-Cortex-Composio-Tool": composioTool } : {}),
    },
  });
}
