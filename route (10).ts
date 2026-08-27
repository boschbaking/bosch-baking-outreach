import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/drafts/[id]/reject">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reason } = await request.json().catch(() => ({ reason: null }));

  const { data: draft, error } = await supabase
    .from("email_drafts")
    .update({ status: "rejected", rejected_reason: reason ?? null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("activity_log").insert({
    prospect_id: draft.prospect_id,
    actor_id: user.id,
    action: "draft_rejected",
    details: { draft_id: id, reason: reason ?? null },
  });

  return NextResponse.json({ draft });
}
