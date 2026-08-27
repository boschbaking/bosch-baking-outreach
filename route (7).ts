import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runQualityCheck } from "@/lib/ai/quality-check";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/drafts/[id]/edit">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, body } = await request.json();

  const { data: voiceSettings } = await supabase.from("voice_settings").select("*").single();
  const qualityCheck = runQualityCheck(subject, body, {
    banned_phrases: voiceSettings?.banned_phrases ?? [],
    preferred_phrases: voiceSettings?.preferred_phrases ?? [],
    preferred_cta_style: voiceSettings?.preferred_cta_style ?? null,
    preferred_email_length: voiceSettings?.preferred_email_length ?? null,
    formality_level: voiceSettings?.formality_level ?? null,
  });

  const { data: draft, error } = await supabase
    .from("email_drafts")
    .update({
      subject,
      edited_body: body,
      quality_score: qualityCheck.score,
      quality_check: qualityCheck,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ draft });
}
