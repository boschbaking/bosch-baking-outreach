import { createHmac, timingSafeEqual } from "crypto";

// Lets us build/verify unsubscribe links without a database round trip and
// without requiring the recipient to be logged in (they aren't — they're a
// prospect clicking a link in an email). Not high-security: worst case of a
// forged token is someone gets un-subscribed who didn't ask to be, which is
// harmless. Set UNSUBSCRIBE_SECRET in production for a real signature;
// falls back to a fixed string so a missing env var never breaks sending.
const SECRET = process.env.UNSUBSCRIBE_SECRET || "bosch-baking-unsubscribe-fallback";

function sign(prospectId: string): string {
  return createHmac("sha256", SECRET).update(prospectId).digest("hex").slice(0, 24);
}

export function buildUnsubscribeToken(prospectId: string): string {
  return `${prospectId}.${sign(prospectId)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const prospectId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = sign(prospectId);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return prospectId;
}
