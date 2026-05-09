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
import { notifyDepartments } from "@/lib/pingram";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";
import type { Department } from "@/types";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, threadId } = await req.json();
  const dept = session.department as Department;
  const crossDept = await getCrossDepContext(dept);
  const { stream } = await chatWithContext(messages, dept, crossDept);

  const lastUserMessage = [...messages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === "user");

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
            tokenCount: Math.ceil(extracted.text.length / 4),
          }, session.userId);
          await notifyDepartments({
            sourceDept: dept,
            summary: extracted.summary,
          });
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
    },
  });
}
