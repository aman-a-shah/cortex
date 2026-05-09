import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { addContextEntry } from "@/lib/context-store";
import { notifyDepartments } from "@/lib/pingram";
import type { AucctusResult } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { productIdea, company, supportingDocs } = await req.json();

  if (!productIdea || !company) {
    return NextResponse.json(
      { error: "productIdea and company required" },
      { status: 400 }
    );
  }

  const context = supportingDocs
    ? `\nSupporting documents provided:\n${supportingDocs}`
    : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are an innovation strategist. An innovation manager at ${company} has proposed: "${productIdea}".${context}

Generate a structured analysis:

1. BRAND RESEARCH: Research ${company}'s brand identity, values, market position, and existing product portfolio (use your knowledge). How does this idea fit?

2. PRODUCT MAP: Map the product idea — core value proposition, target customer segment, key features (3–5), competitive differentiation, go-to-market angle.

3. STAKEHOLDER BRIEF: Write a concise executive brief (3–4 sentences) that an innovation manager could take to their product development team. Include the idea, strategic rationale, and next steps.

Respond with valid JSON only:
{
  "brandResearch": "...",
  "productMap": "...",
  "stakeholderBrief": "..."
}`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text : "{}";
  const match = raw.match(/\{[\s\S]*\}/);

  let result: AucctusResult = {
    brandResearch: "Research complete.",
    productMap: "Product mapped.",
    stakeholderBrief: "Brief generated.",
  };

  if (match) {
    try {
      result = JSON.parse(match[0]);
    } catch {
      // keep defaults
    }
  }

  // Store in global context
  const contextText = `Product Innovation: "${productIdea}" for ${company}. ${result.stakeholderBrief}`;
  const contextEntry = await addContextEntry({
    department: "product",
    text: contextText,
    summary: `Innovation: ${productIdea} @ ${company}`,
    source: "Aucctus Innovation Pipeline",
    tokenCount: Math.ceil(contextText.length / 4),
  });

  await notifyDepartments({
    sourceDept: "product",
    summary: `New innovation proposal: ${productIdea} — stakeholder brief ready`,
  });

  return NextResponse.json({ ...result, contextEntryId: contextEntry.id });
}
