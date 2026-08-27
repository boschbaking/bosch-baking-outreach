import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROSPECT_STATUSES } from "@/lib/types";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/prospects/[id]/status">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await request.json();
  if (!PROSPECT_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("prospects")
    .update({ status, last_contact_date: status === "Contacted" ? new Date().toISOString().slice(0, 10) : undefined })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("activity_log").insert({
    prospect_id: id,
    actor_id: user.id,
    action: "status_changed",
    details: { status },
  });

  return NextResponse.json({ prospect: data });
}
