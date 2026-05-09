import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { query, entries } = (await req.json()) as {
    query: string;
    entries: Array<{ id: string; summary: string }>;
  };

  if (!query || !entries?.length) return NextResponse.json({ matchedIds: [] });

  const list = entries.map((e, i) => `[${i}] ${e.summary}`).join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `You are matching a user's removal query against context entries in a company knowledge graph.

User query: "${query}"

Context entries:
${list}

Return the indices (0-based) of entries that the user is likely referring to. Be liberal — if the intent is plausibly related (even loosely), include it. Return ONLY a JSON array of integers, e.g. [0, 3, 5]. Empty array if nothing matches.`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
  const match = raw.match(/\[[\s\S]*?\]/);
  try {
    const indices: number[] = match ? JSON.parse(match[0]) : [];
    const matchedIds = indices
      .filter(i => i >= 0 && i < entries.length)
      .map(i => entries[i].id);
    return NextResponse.json({ matchedIds });
  } catch {
    return NextResponse.json({ matchedIds: [] });
  }
}
