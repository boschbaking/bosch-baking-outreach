import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/drafts/[id]/approve">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user.id })
    .eq("id", id)
    .select()
    .single();

  if (draftError) return NextResponse.json({ error: draftError.message }, { status: 500 });

  await supabase.from("prospects").update({ status: "Approved" }).eq("id", draft.prospect_id);

  await supabase.from("activity_log").insert({
    prospect_id: draft.prospect_id,
    actor_id: user.id,
    action: "draft_approved",
    details: { draft_id: id },
  });

  return NextResponse.json({ draft });
}
