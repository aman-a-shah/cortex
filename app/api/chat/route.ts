import { NextRequest } from "next/server";
import { chatWithContext, extractContextFromMessage, findSimilarEntries } from "@/lib/backboard";
import {
  getCrossDepContext,
  getContextEntries,
  addContextEntry,
} from "@/lib/context-store";
import {
  addChatMessage,
  createConversation,
} from "@/lib/chat-store";
import {
  safeCloudinaryError,
  transformCloudinaryImage,
  generateAndUploadImage,
  type CloudinaryTransformation,
} from "@/lib/cloudinary";
import { detectMediaTransformIntent, detectGenerateIntent } from "@/lib/media-transform-intent";
import { notifyDepartments, notifyContextChange } from "@/lib/pingram";
import { fetchLiveToolContext } from "@/lib/composio";
import { verifyToken, TOKEN_COOKIE } from "@/lib/auth";
import { registerUser } from "@/lib/user-registry";
import { logger } from "@/lib/logger";
import type { Department, ContextEntry } from "@/types";

function transformLabel(t: CloudinaryTransformation, opts?: Record<string, unknown>): string {
  switch (t) {
    case "background_replace":
      return opts?.prompt ? `Placed on "${opts.prompt}"` : "Background replaced";
    case "remove_background": return "Background removed";
    case "generative_replace":
      return opts?.from && opts?.to ? `Changed "${opts.from}" → "${opts.to}"` : "Object replaced";
    case "enhance": return "Enhanced & restored";
    case "blur": return "Blur applied";
    case "grayscale": return "Converted to grayscale";
    case "sharpen": return "Sharpened";
    case "resize": return "Resized";
  }
}

function textStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, threadId } = await req.json();
  const dept = session.department as Department;

  // Register this user so context entries they create can be attributed by name
  registerUser(session.userId, session.name);

  const [crossDept, allEntries] = await Promise.all([
    getCrossDepContext(dept),
    getContextEntries(),
  ]);

  const lastUserMessage = [...messages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === "user");

  // Auto-enrich context with live tool data if the message references a connected tool.
  // Runs in parallel with other setup; 2.5s timeout so it never blocks the response.
  const lastUserContent = lastUserMessage?.content ?? "";

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

  // If the current message has no Cloudinary URL, inject the most recent one from
  // conversation history so "put this car on a racetrack" works as a follow-up.
  const CLOUDINARY_URL_RE = /https:\/\/res\.cloudinary\.com\/[^\s)\]]+\/image\/upload\/[^\s)\]]+/i;
  function findLastCloudinaryUrl(msgs: { role: string; content: string }[]): string | null {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i].content.match(CLOUDINARY_URL_RE);
      if (m) return m[0].replace(/[)\].,;:]+$/, "");
    }
    return null;
  }
  const contentForDetection = CLOUDINARY_URL_RE.test(lastUserContent)
    ? lastUserContent
    : (() => {
        const historyUrl = findLastCloudinaryUrl(messages);
        return historyUrl
          ? `${lastUserContent}\n[Attached image: ${historyUrl}]`
          : lastUserContent;
      })();

  const mediaTransformIntent = detectMediaTransformIntent(contentForDetection);
  if (mediaTransformIntent) {
    let assistantContent: string;
    try {
      const result = await transformCloudinaryImage(
        mediaTransformIntent.imageUrl,
        mediaTransformIntent.transformation,
        mediaTransformIntent.options
      );
      logger.info("chat", `transform: ${mediaTransformIntent.transformation} → ${result.url}`);
      const label = transformLabel(mediaTransformIntent.transformation, mediaTransformIntent.options);
      assistantContent = `![${label}](${result.url})\n✨ ${label} via Cloudinary AI.`;
    } catch (err) {
      assistantContent = `Cloudinary transformation failed: ${safeCloudinaryError(err)}`;
    }
    await addChatMessage(currentThreadId, dept, "assistant", assistantContent);
    return new Response(textStream(assistantContent), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Cortex-Thread-Id": currentThreadId,
        "X-Cortex-Media-Transform": mediaTransformIntent.transformation,
      },
    });
  }

  const generateIntent = detectGenerateIntent(lastUserContent);
  if (generateIntent) {
    let assistantContent: string;
    try {
      const url = await generateAndUploadImage(generateIntent.prompt);
      logger.info("chat", `generate image: "${generateIntent.prompt}"`);
      assistantContent = `![Generated: ${generateIntent.prompt}](${url})\n🎨 Generated an image of **${generateIntent.prompt}** via Cloudinary AI.`;
    } catch (err) {
      assistantContent = `Image generation failed: ${safeCloudinaryError(err)}`;
    }
    await addChatMessage(currentThreadId, dept, "assistant", assistantContent);
    return new Response(textStream(assistantContent), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Cortex-Thread-Id": currentThreadId,
        "X-Cortex-Media-Generate": "1",
      },
    });
  }

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

  // Find similar past experiences from other users to surface in the LLM response
  const peerExperiences = findSimilarEntries(lastUserContent, session.userId, allEntries);

  const { stream } = await chatWithContext(messages, dept, crossDept, peerExperiences);

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
            }).catch(err => logger.error("chat", "context notify failed", err));
          }
          logger.info("chat", `stored context: ${entry.id}`);
        }
      })
      .catch(err => logger.error("chat", "context extraction failed", err));
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
