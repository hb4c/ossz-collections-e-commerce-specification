import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";
import { getCurrentUser, getGuestId } from "@/lib/auth";
import {
  TOOL_DEFINITIONS,
  buildSystemPrompt,
  fallbackReply,
  runTool,
} from "@/lib/concierge-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

const buckets = new Map<string, { count: number; reset: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > 20;
}

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

async function callClaude(system: string, history: ChatMessage[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const messages: Array<{ role: "user" | "assistant"; content: string | AnthropicBlock[] }> =
    history.map((m) => ({ role: m.role, content: m.content }));

  let escalated = false;

  for (let round = 0; round < 4; round += 1) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 900,
        system,
        tools: TOOL_DEFINITIONS,
        messages,
      }),
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as {
      content?: AnthropicBlock[];
      stop_reason?: string;
    };
    const blocks = payload.content ?? [];
    const toolUses = blocks.filter((b): b is Extract<AnthropicBlock, { type: "tool_use" }> => b.type === "tool_use");

    if (toolUses.length === 0) {
      const text = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: text || "How may I assist you today?", escalated };
    }

    messages.push({ role: "assistant", content: blocks });
    const results: AnthropicBlock[] = [];
    for (const use of toolUses) {
      if (use.name === "escalate_to_whatsapp") escalated = true;
      const result = await runTool(use.name, use.input ?? {});
      results.push({ type: "tool_result", tool_use_id: use.id, content: result.text });
    }
    messages.push({ role: "user", content: results });
  }

  return { reply: "Thank you for your patience. How else may I help you today?", escalated };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    messages?: ChatMessage[];
  };
  const history = (body.messages ?? []).slice(-14).filter((m) => typeof m.content === "string");
  const last = history[history.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) {
    return NextResponse.json({ reply: "How may I assist you today?", escalated: false });
  }
  if (last.content.length > 1200) {
    return NextResponse.json({
      reply: "Would you kindly summarise that in a sentence or two? I want to be sure I help you well.",
      escalated: false,
    });
  }

  const [user, sessionId] = await Promise.all([getCurrentUser(), getGuestId()]);
  if (rateLimited(sessionId)) {
    return NextResponse.json({
      reply:
        "Thank you for your enthusiasm. Might we continue in a moment? Our team is always available on WhatsApp in the meantime.",
      escalated: false,
    });
  }

  const system = await buildSystemPrompt();
  let outcome = await callClaude(system, history);
  if (!outcome) {
    outcome = await fallbackReply(last.content);
  }

  const transcript = [...history, { role: "assistant" as const, content: outcome.reply }];
  try {
    const existing = (
      await db.select().from(aiConversations).where(eq(aiConversations.sessionId, sessionId)).limit(1)
    )[0];
    if (existing) {
      await db
        .update(aiConversations)
        .set({
          transcript,
          escalatedToWhatsapp: existing.escalatedToWhatsapp || outcome.escalated,
          updatedAt: new Date(),
          userId: user?.id ?? existing.userId,
        })
        .where(eq(aiConversations.id, existing.id));
    } else {
      await db.insert(aiConversations).values({
        sessionId,
        userId: user?.id ?? null,
        transcript,
        escalatedToWhatsapp: outcome.escalated,
      });
    }
  } catch {
    // logging must never break the conversation
  }

  return NextResponse.json({ reply: outcome.reply, escalated: outcome.escalated });
}
