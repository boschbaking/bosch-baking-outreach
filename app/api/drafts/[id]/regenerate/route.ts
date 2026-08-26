import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmailDraft } from "@/lib/ai/draft-email";
import { runQualityCheck } from "@/lib/ai/quality-check";
import type { Prospect } from "@/lib/types";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/drafts/[id]/regenerate">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { feedback } = await request.json().catch(() => ({ feedback: null }));

  const { data: oldDraft, error: oldDraftError } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("id", id)
    .single();

  if (oldDraftError || !oldDraft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const { data: prospect } = await supabase
    .from("prospects")
    .select("*")
    .eq("id", oldDraft.prospect_id)
    .single<Prospect>();

  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });

  const [{ data: voiceSettings }, { data: examples }] = await Promise.all([
    supabase.from("voice_settings").select("*").single(),
    supabase
      .from("voice_examples")
      .select("*")
      .neq("rating", "do_not_use")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const voice = {
    banned_phrases: voiceSettings?.banned_phrases ?? [],
    preferred_phrases: voiceSettings?.preferred_phrases ?? [],
    preferred_cta_style: voiceSettings?.preferred_cta_style ?? null,
    preferred_email_length: voiceSettings?.preferred_email_length ?? null,
    formality_level: feedback
      ? `${voiceSettings?.formality_level ?? "conversational"}. Also incorporate this feedback from Brandon on the previous draft: "${feedback}"`
      : voiceSettings?.formality_level ?? null,
  };

  let result;
  try {
    result = await generateEmailDraft(
      prospect,
      oldDraft.campaign_type,
      voice,
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

  const qualityCheck = runQualityCheck(result.subject, result.body, voice);
  qualityCheck.facts_used = result.facts_used;

  const { data: newDraft, error: insertError } = await supabase
    .from("email_drafts")
    .insert({
      prospect_id: oldDraft.prospect_id,
      campaign_id: oldDraft.campaign_id,
      campaign_type: oldDraft.campaign_type,
      subject: result.subject,
      body: result.body,
      generated_from: { facts_used: result.facts_used, regenerated_from: id, feedback },
      quality_score: qualityCheck.score,
      quality_check: qualityCheck,
      status: "draft",
      version: (oldDraft.version ?? 1) + 1,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Superseded — keep the old one around for history but mark it rejected.
  await supabase
    .from("email_drafts")
    .update({ status: "rejected", rejected_reason: "regenerated" })
    .eq("id", id);

  await supabase.from("activity_log").insert({
    prospect_id: oldDraft.prospect_id,
    actor_id: user.id,
    action: "draft_regenerated",
    details: { previous_draft_id: id, feedback },
  });

  return NextResponse.json({ draft: newDraft });
}
