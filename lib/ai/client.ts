import Anthropic from "@anthropic-ai/sdk";

// Thin wrapper so the AI provider can be swapped later (e.g. OpenAI) without
// touching any call sites — everything else in the app imports getAIClient()
// and generateEmailDraft() from lib/ai, never the SDK directly.
let client: Anthropic | null = null;

export function getAIClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment variables to enable AI drafting."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
