import { getAIClient, AI_MODEL } from "./client";
import type { CampaignType, Prospect } from "@/lib/types";

export interface VoiceSettings {
  banned_phrases: string[];
  preferred_phrases: string[];
  preferred_cta_style: string | null;
  preferred_email_length: string | null;
  formality_level: string | null;
}

export interface VoiceExample {
  subject: string | null;
  body: string;
  rating: "good" | "very_good" | "do_not_use";
  campaign_type: CampaignType | null;
}

export interface DraftResult {
  subject: string;
  body: string;
  why_emailing: string;
  facts_used: string[];
}

const CAMPAIGN_INSTRUCTIONS: Record<CampaignType, string> = {
  new_prospect: `This is a NEW PROSPECT who has never bought from Bosch Baking.
Write a short introduction. Name Bosch Baking naturally. Reference the one or two bread
categories most likely relevant to this specific business (based on the research notes —
never guess beyond what's given). Ask what they're currently using for that category.
Offer to drop samples. Keep it low-pressure — this is a first touch, not a pitch.`,

  lost_customer: `This is a FORMER Bosch Baking customer who stopped ordering under
previous ownership. Acknowledge the prior relationship naturally, without over-apologizing
or sounding defensive. Mention Bosch Baking is under new ownership. If the research notes
support it, you can mention improvements like more consistent product, more reliable
delivery, or better pricing — only mention what's actually in the notes, never invent
specifics. Do not blame or criticize the previous owners. Do not sound desperate. Offer to
drop samples so they can see the difference for themselves.`,

  dormant_customer: `This is a DORMANT customer who has ordered before but has gone quiet.
Reference the prior relationship naturally and specifically if the notes support it. Ask
whether anything has changed on their end — new menu, new supplier, whatever fits. Offer to
reconnect or drop fresh samples. Keep it easy and low-key, like checking in with someone you
actually know.`,

  existing_upsell: `This is a CURRENT, active customer. Do NOT write this like a cold
email — they already buy from Bosch Baking. Recommend one additional product based on what
they already order (from the research notes). Keep it practical and specific, like a
supplier who noticed something useful, not a sales pitch.`,
};

function buildSystemPrompt(voice: VoiceSettings, examples: VoiceExample[]) {
  const banned = voice.banned_phrases?.length
    ? voice.banned_phrases.join(", ")
    : "none configured";
  const preferred = voice.preferred_phrases?.length
    ? voice.preferred_phrases.join(", ")
    : "none configured yet";

  const goodExamples = examples.filter((e) => e.rating !== "do_not_use").slice(0, 5);
  const badExamples = examples.filter((e) => e.rating === "do_not_use").slice(0, 3);

  let exampleBlock = "";
  if (goodExamples.length) {
    exampleBlock += "\n\nEXAMPLES OF BRANDON'S PREFERRED VOICE (match this tone and structure closely):\n";
    goodExamples.forEach((e, i) => {
      exampleBlock += `\n--- Example ${i + 1} (${e.rating}) ---\nSubject: ${e.subject ?? "(none)"}\n${e.body}\n`;
    });
  }
  if (badExamples.length) {
    exampleBlock += "\n\nEXAMPLES TO AVOID (do not write like this):\n";
    badExamples.forEach((e, i) => {
      exampleBlock += `\n--- Avoid ${i + 1} ---\n${e.body}\n`;
    });
  }

  return `You are writing cold outreach emails for Brandon, a wholesale bread salesperson at
Bosch Baking, a wholesale bakery. You are writing AS Brandon, in his voice, to real
foodservice buyers (restaurants, cafes, hotels, country clubs, hospitals, senior living,
colleges, casinos, breweries with kitchens, caterers, banquet venues, and similar).

These emails must sound like a real local salesperson wrote them by hand. They must NOT
sound AI-generated, corporate, or like a mass email blast.

HARD RULES:
- Conversational American English. Short and direct. Natural sentence structure.
- Usually 60-120 words total.
- No fake compliments. No exaggerated personalization. Never invent facts about the
  business that aren't in the research notes provided — if something is unknown, don't
  mention it.
- One simple call to action. Samples should usually be the CTA.
- Mention Bosch Baking naturally, not like a signature drop.
- Vary sentence structure and wording — this email must not read like a template with
  fields swapped in.
- NEVER use these banned phrases or anything functionally identical to them: ${banned}.
- Preferred phrases/style to lean toward when natural (don't force them): ${preferred}.
- Preferred CTA style: ${voice.preferred_cta_style ?? "offer samples directly"}.
- Preferred length: ${voice.preferred_email_length ?? "60-120 words"}.
- Formality level: ${voice.formality_level ?? "conversational, not stiff"}.
- Do not use exclamation points more than once, if at all.
- Sign off simply, like a real person would (first name is enough).
${exampleBlock}

Respond with ONLY a JSON object, no other text, in this exact shape:
{"subject": "...", "body": "...", "why_emailing": "...", "facts_used": ["...", "..."]}

"why_emailing" is INTERNAL ONLY (never shown to the prospect) — one sentence explaining
why this business is a good fit, e.g. "Independent burger restaurant with a large burger
and sandwich menu. Likely buyer of hamburger buns and sandwich bread."

"facts_used" is a short list of the specific research facts you actually used in the email,
so Brandon can verify nothing was invented.`;
}

function buildUserPrompt(prospect: Prospect, campaignType: CampaignType) {
  const facts = [
    `Business name: ${prospect.business_name}`,
    `Business type: ${prospect.business_type ?? "unknown"}`,
    `City: ${prospect.city ?? "unknown"}`,
    `Contact name: ${prospect.contact_name ?? "unknown — address generically"}`,
    `Likely bread needs: ${
      prospect.likely_bread_needs?.length ? prospect.likely_bread_needs.join(", ") : "unknown"
    }`,
    `Research notes: ${prospect.research_notes ?? "none yet — keep the email general"}`,
    `Customer relationship: ${prospect.customer_relationship}`,
    `Sales notes: ${prospect.sales_notes ?? "none"}`,
  ].join("\n");

  return `CAMPAIGN TYPE: ${campaignType}
${CAMPAIGN_INSTRUCTIONS[campaignType]}

RESEARCH FACTS (do not use anything beyond this — if it's not here, it's unknown):
${facts}

Write the email now.`;
}

export async function generateEmailDraft(
  prospect: Prospect,
  campaignType: CampaignType,
  voice: VoiceSettings,
  examples: VoiceExample[]
): Promise<DraftResult> {
  const anthropic = getAIClient();

  const message = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(voice, examples),
    messages: [{ role: "user", content: buildUserPrompt(prospect, campaignType) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AI response did not contain text content");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    subject: parsed.subject ?? "",
    body: parsed.body ?? "",
    why_emailing: parsed.why_emailing ?? "",
    facts_used: Array.isArray(parsed.facts_used) ? parsed.facts_used : [],
  };
}
