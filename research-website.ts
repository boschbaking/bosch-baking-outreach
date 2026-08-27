import { getAIClient, AI_MODEL } from "./client";

// Looks up a prospect's own website before drafting an email to them —
// pulls the homepage plus anything that looks like a menu page, and asks
// the model what bread products (buns, rolls, loaves, etc.) they likely
// go through based on what they actually serve. Runs once per prospect
// (see the `!prospect.research_notes` gate in the generate route) so a
// bulk run doesn't re-scan the same site on every regenerate.

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_CHARS = 60000;
const MAX_TEXT_CHARS_FOR_MODEL = 12000;

async function fetchWithTimeout(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BoschBakingResearch/1.0; +https://boschbaking.com)",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;
    const text = await res.text();
    return text.slice(0, MAX_HTML_CHARS);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMenuLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const hrefRegex = /href=["']([^"'#][^"']*)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html))) {
    const href = match[1];
    if (/menu|food|catering/i.test(href)) {
      try {
        const resolved = new URL(href, baseUrl);
        if (resolved.origin === new URL(baseUrl).origin) {
          links.add(resolved.toString());
        }
      } catch {
        // malformed href — skip it
      }
    }
  }
  return Array.from(links).slice(0, 2);
}

export interface WebsiteResearchResult {
  research_notes: string;
  likely_bread_needs: string[];
}

export async function researchProspectWebsite(
  websiteUrl: string
): Promise<WebsiteResearchResult | null> {
  let normalized = websiteUrl.trim();
  if (!normalized) return null;
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  const homepageHtml = await fetchWithTimeout(normalized);
  if (!homepageHtml) return null;

  const menuLinks = findMenuLinks(homepageHtml, normalized);
  const menuHtmls = await Promise.all(menuLinks.map((link) => fetchWithTimeout(link)));

  const combinedText = [
    stripHtml(homepageHtml),
    ...menuHtmls.filter((h): h is string => !!h).map((h) => stripHtml(h)),
  ]
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS_FOR_MODEL);

  if (combinedText.length < 200) return null;

  const anthropic = getAIClient();
  let message;
  try {
    message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system: `You read a restaurant/foodservice website's own text (and menu page, if
found) and figure out what bread products a wholesale bakery could sell them — buns, rolls,
loaves, baguettes, flatbread, etc. — based only on what they actually serve. Never guess
beyond what the text supports. If there's nothing useful, say so plainly rather than
inventing something.

Respond with ONLY a JSON object, no other text:
{"research_notes": "...", "likely_bread_needs": ["...", "..."]}

"research_notes" is 1-3 sentences a bread salesperson could skim before emailing this
business — what they serve, and why it's relevant to bread.
"likely_bread_needs" is a short list of specific bread product categories (e.g. "hamburger
buns", "hoagie rolls", "dinner rolls", "sourdough loaves"). Empty array if nothing is clear.`,
      messages: [
        {
          role: "user",
          content: `Website/menu text for this business:\n\n${combinedText}\n\nWhat bread products do they likely need?`,
        },
      ],
    });
  } catch {
    return null;
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      research_notes: typeof parsed.research_notes === "string" ? parsed.research_notes : "",
      likely_bread_needs: Array.isArray(parsed.likely_bread_needs)
        ? parsed.likely_bread_needs.filter((x: unknown) => typeof x === "string")
        : [],
    };
  } catch {
    return null;
  }
}
