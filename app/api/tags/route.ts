import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Department } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { summary, text, department } = (await req.json()) as {
    summary: string;
    text: string;
    department: Department;
  };

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Extract key concepts from this ${department} context entry as orbit labels for a data visualization.

Summary: ${summary}
Content: ${text.slice(0, 400)}

Rules:
- Return 4-10 labels (fewer if there aren't enough meaningful ones — never pad)
- 1-4 words each — must make sense as a standalone label
- Prefer specific terms: named things, metrics, artifacts, decisions
- Skip generic words like "update", "planning", "strategy" unless they're specific
- Include specific file names, PR refs, metric values, named systems if present

Return ONLY a JSON array of strings, no explanation.`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
  const match = raw.match(/\[[\s\S]*\]/);
  try {
    const tags: string[] = match ? JSON.parse(match[0]) : [];
    return NextResponse.json(tags.slice(0, 12));
  } catch {
    return NextResponse.json([]);
  }
}
