import { NextRequest } from "next/server";
import { chatWithContext, extractContextFromMessage } from "@/lib/backboard";
import {
  getCrossDepContext,
  addContextEntry,
} from "@/lib/context-store";
import { notifyDepartments } from "@/lib/pingram";
import type { Department } from "@/types";

export async function POST(req: NextRequest) {
  const { messages, department } = await req.json();
  const dept = department as Department;

  const crossDept = getCrossDepContext(dept);
  const stream = await chatWithContext(messages, dept, crossDept);

  // Fire-and-forget: extract context from the last user message
  const lastUserMessage = [...messages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === "user");

  if (lastUserMessage) {
    extractContextFromMessage(lastUserMessage.content, dept)
      .then(async (extracted) => {
        if (extracted?.shouldStore && extracted.summary && extracted.text) {
          const entry = addContextEntry({
            department: dept,
            text: extracted.text,
            summary: extracted.summary,
            tokenCount: Math.ceil(extracted.text.length / 4),
          });
          await notifyDepartments({
            sourceDept: dept,
            summary: extracted.summary,
          });
          console.log("[cortex] stored context:", entry.id);
        }
      })
      .catch(console.error);
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
