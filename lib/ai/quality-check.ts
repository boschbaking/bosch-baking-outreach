import type { QualityCheckResult } from "@/lib/types";
import type { VoiceSettings } from "./draft-email";

// Fast, deterministic, no extra AI call — runs automatically on every generated
// draft so the approval queue always shows a score. A full AI-assisted rewrite
// pass (Phase 2) can layer on top of this using the same QualityCheckResult shape.
export function runQualityCheck(
  subject: string,
  body: string,
  voice: VoiceSettings
): QualityCheckResult {
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  const lower = body.toLowerCase();

  const bannedFound = (voice.banned_phrases ?? []).filter((p) =>
    lower.includes(p.toLowerCase())
  );

  const genericPhrases = [
    "i hope this finds you well",
    "i hope you're doing well",
    "hope all is well",
    "i wanted to reach out",
    "reaching out",
    "just wanted to",
    "in today's competitive",
    "state of the art",
    "world class",
    "cutting edge",
  ];
  const aiRiskFlags = genericPhrases.filter((p) => lower.includes(p));

  const lengthOk = wordCount >= 40 && wordCount <= 150;
  const hasQuestionOrCta =
    /\?/.test(body) ||
    /(sample|drop off|swing by|send over|try|give.*(a )?try)/i.test(body);
  const exclamationCount = (body.match(/!/g) || []).length;

  const soundsHuman = aiRiskFlags.length === 0 && exclamationCount <= 1;
  const relevance = /\b(bread|bun|roll|sourdough|brioche|ciabatta|rye|bagel|croissant|muffin|loaf|bakery|bosch)\b/i.test(
    body
  );
  const noFakePersonalization = !/(wonderful|amazing|impressive|outstanding) (restaurant|establishment|place)/i.test(
    lower
  );

  let score = 100;
  score -= bannedFound.length * 20;
  score -= aiRiskFlags.length * 10;
  if (!lengthOk) score -= 15;
  if (!hasQuestionOrCta) score -= 15;
  if (!relevance) score -= 15;
  if (!noFakePersonalization) score -= 10;
  if (exclamationCount > 1) score -= 5;
  score = Math.max(0, Math.min(100, score));

  const passed = score >= 75 && bannedFound.length === 0;

  const whyItPassed = passed
    ? `Reads like a short, direct note from a real person. ${
        hasQuestionOrCta ? "Has a clear, low-pressure call to action." : ""
      } ${relevance ? "Ties back to actual bread products." : ""}`.trim()
    : `Needs a pass before approving: ${[
        bannedFound.length ? "contains banned phrase(s)" : "",
        !lengthOk ? `length is ${wordCount} words (target 60-120)` : "",
        !hasQuestionOrCta ? "no clear call to action" : "",
        !relevance ? "doesn't reference a specific bread product" : "",
      ]
        .filter(Boolean)
        .join("; ")}`;

  return {
    score,
    passed,
    sounds_human: soundsHuman,
    relevance,
    no_fake_personalization: noFakePersonalization,
    length_ok: lengthOk,
    clear_cta: hasQuestionOrCta,
    banned_phrases_found: bannedFound,
    unsupported_claims: [],
    ai_risk_flags: aiRiskFlags,
    why_it_passed: whyItPassed,
    facts_used: [],
  };
}
