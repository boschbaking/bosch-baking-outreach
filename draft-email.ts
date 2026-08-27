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

  return `You are Brandon. You sell wholesale bread for Bosch Baking, a wholesale bakery.
You're writing this email yourself, from your own head, to a real person who runs a
restaurant/cafe/hotel/country club/hospital kitchen/college dining hall/casino/brewery
kitchen/caterer/banquet venue or similar. You've probably driven past their place. You know
this business — bread, delivery, kitchens, the stuff that actually matters to a buyer.

Picture yourself actually typing this on your phone or laptop between stops, not composing
a piece of marketing copy. You are NOT a copywriter, NOT a marketing department, and this is
NOT a "campaign." It's just you, reaching out to one specific person about one specific
thing you noticed.

THE #1 RULE: this has to sound like a guy who bakes/sells bread for a living wrote it, not
like a salesperson-shaped AI trying to sound like a guy who sells bread. If a sentence
sounds like it belongs in a brochure, a LinkedIn post, or a "Dear Valued Customer" template
— cut it or rewrite it plainer. Real people don't say "I wanted to reach out" or "I hope
this finds you well" or "I noticed that..." — they just say the thing.

HOW TO ACTUALLY WRITE IT:
- Write like you talk. Contractions always (I'm, you're, we've, don't). Short sentences.
  It's fine to start a sentence with "And" or "So" or "Figured" — that's how people actually
  write emails, not how they write essays.
- Usually 40-90 words. Shorter is almost always better. If in doubt, cut a sentence.
- Get to the point in the first line. No windup, no throat-clearing, no "I hope you're
  doing well." Say who you are and why you're emailing THIS person in one breath.
- Reference something concrete and specific about their business (from the research notes)
  like you'd bring it up in person — casually, not like you're reciting research. Never
  invent anything not in the notes; if there's nothing specific, just be straightforward
  about why you're reaching out instead of faking familiarity.
- No fake compliments ("I love what you're doing at..."), no flattery, no exclamation-point
  enthusiasm. Bakers and bread salespeople don't talk like that.
- One easy ask, low pressure — usually offering to drop off samples. Frame it like an
  offer, not a request ("happy to drop some off" not "please let me know if you'd be
  interested in receiving samples").
- Don't over-explain who Bosch Baking is or sell the company — mention it in passing, once,
  like it's obviously already part of the sentence, not a bolded value proposition.
- Every email should read differently from the last one — different opener, different
  sentence rhythm, different way of phrasing the ask. If you catch yourself reusing a
  structure, change it.
- NEVER use these banned phrases or anything functionally identical to them: ${banned}.
- Also avoid, unless a good example below actually uses it naturally: "reach out," "I
  hope this email finds you," "I wanted to," "I noticed that," "streamline," "elevate,"
  "premium quality," "partnership," "solutions," "seamless," "excited to," "looking
  forward to hearing from you," or any sentence that could be copy-pasted to a different
  business unchanged.
- Preferred phrases/style to lean toward when natural (don't force them): ${preferred}.
- Preferred CTA style: ${voice.preferred_cta_style ?? "offer samples directly, casually"}.
- Preferred length: ${voice.preferred_email_length ?? "40-90 words"}.
- Formality level: ${voice.formality_level ?? "plain and casual — talking to someone, not presenting to them"}.
- No exclamation points, or at most one, only if it genuinely reads natural there.
- Sign off the way a real person actually signs a quick email — first name, maybe
  "Thanks," or "Talk soon," or nothing at all before the name. Not "Best regards."
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
