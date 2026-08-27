import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmailDraft } from "@/lib/ai/draft-email";
import { runQualityCheck } from "@/lib/ai/quality-check";
import { researchProspectWebsite } from "@/lib/ai/research-website";
import type { CampaignType, Prospect } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prospect_id, campaign_type } = (await request.json()) as {
    prospect_id: string;
    campaign_type: CampaignType;
  };

  if (!prospect_id || !campaign_type) {
    return NextResponse.json(
      { error: "prospect_id and campaign_type are required" },
      { status: 400 }
    );
  }

  const { data: prospect, error: prospectError } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", prospect_id)
    .single<Prospect>();

  if (prospectError || !prospect) {
    return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  }

  if (prospect.do_not_contact) {
    return NextResponse.json(
      { error: "This prospect is on the Do Not Contact list." },
      { status: 409 }
    );
  }

  // Scan the prospect's own website (and menu page, if we can find one) for
  // what bread products they likely need, before writing to them. Only runs
  // once per prospect — once research_notes is filled in, later
  // generate/regenerate calls skip straight to drafting instead of
  // re-scanning the same site every time.
  let prospectForDraft = prospect;
  if (!prospect.research_notes && prospect.website) {
    const researched = await researchProspectWebsite(prospect.website).catch(() => null);
    if (researched && (researched.research_notes || researched.likely_bread_needs.length > 0)) {
      const mergedNeeds = Array.from(
        new Set([...(prospect.likely_bread_needs ?? []), ...researched.likely_bread_needs])
      );
      const { data: updatedProspect } = await supabase
        .from("prospects")
        .update({
          research_notes: researched.research_notes || null,
          likely_bread_needs: mergedNeeds,
        })
        .eq("id", prospect_id)
        .select()
        .single<Prospect>();

      if (updatedProspect) {
        prospectForDraft = updatedProspect;
        await supabase.from("activity_log").insert({
          prospect_id,
          actor_id: user.id,
          action: "website_researched",
          details: { likely_bread_needs: researched.likely_bread_needs },
        });
      }
    }
  }

  const [{ data: voiceSettings }, { data: examples }] = await Promise.all([
    supabase.from("voice_settings").select("*").single(),
    supabase
      .from("voice_examples")
      .select("*")
      .neq("rating", "do_not_use")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  let result;
  try {
    result = await generateEmailDraft(
      prospectForDraft,
      campaign_type,
      {
        banned_phrases: voiceSettings?.banned_phrases ?? [],
        preferred_phrases: voiceSettings?.preferred_phrases ?? [],
        preferred_cta_style: voiceSettings?.preferred_cta_style ?? null,
        preferred_email_length: voiceSettings?.preferred_email_length ?? null,
        formality_level: voiceSettings?.formality_level ?? null,
      },
      (examples ?? []).map((e) => ({
        subject: e.subject,
        body: e.body,
        rating: e.rating,
        campaign_type: e.campaign_type,
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI drafting failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const qualityCheck = runQualityCheck(
    result.subject,
    result.body,
    {
      banned_phrases: voiceSettings?.banned_phrases ?? [],
      preferred_phrases: voiceSettings?.preferred_phrases ?? [],
      preferred_cta_style: voiceSettings?.preferred_cta_style ?? null,
      preferred_email_length: voiceSettings?.preferred_email_length ?? null,
      formality_level: voiceSettings?.formality_level ?? null,
    }
  );
  qualityCheck.facts_used = result.facts_used;

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .insert({
      prospect_id,
      campaign_type,
      subject: result.subject,
      body: result.body,
      generated_from: { facts_used: result.facts_used },
      quality_score: qualityCheck.score,
      quality_check: qualityCheck,
      status: "draft",
    })
    .select()
    .single();

  if (draftError) {
    return NextResponse.json({ error: draftError.message }, { status: 500 });
  }

  await supabase
    .from("prospects")
    .update({
      why_emailing: result.why_emailing,
      status: prospect.status === "New" || prospect.status === "Researching"
        ? "Drafted"
        : prospect.status,
    })
    .eq("id", prospect_id);

  await supabase.from("activity_log").insert({
    prospect_id,
    actor_id: user.id,
    action: "draft_generated",
    details: { campaign_type, quality_score: qualityCheck.score },
  });

  return NextResponse.json({ draft });
}
