import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CampaignType, Prospect } from "@/lib/types";

// Lets a person write an email straight into the Approval Queue instead of
// generating one with AI — same downstream flow (approve, edit, send) as an
// AI-drafted email, it just skips generation and the AI quality check.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prospect_id, campaign_type, subject, body } = (await request.json()) as {
    prospect_id: string;
    campaign_type: CampaignType;
    subject: string;
    body: string;
  };

  if (!prospect_id || !campaign_type || !subject?.trim() || !body?.trim()) {
    return NextResponse.json(
      { error: "prospect_id, campaign_type, subject, and body are all required" },
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

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .insert({
      prospect_id,
      campaign_type,
      subject: subject.trim(),
      body: body.trim(),
      generated_from: { manual: true },
      quality_score: null,
      quality_check: null,
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
      status: prospect.status === "New" || prospect.status === "Researching"
        ? "Drafted"
        : prospect.status,
    })
    .eq("id", prospect_id);

  await supabase.from("activity_log").insert({
    prospect_id,
    actor_id: user.id,
    action: "draft_written_manually",
    details: { campaign_type },
  });

  return NextResponse.json({ draft });
}
