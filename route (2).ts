import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_FIELDS = [
  "business_name",
  "contact_name",
  "email",
  "phone",
  "city",
  "state",
  "business_type",
  "website",
  "prospect_score",
  "likely_bread_needs",
  "research_notes",
  "why_emailing",
  "next_follow_up_date",
  "status",
  "sample_status",
  "sales_notes",
  "do_not_contact",
  "customer_relationship",
];

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/prospects/[id]">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const update: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Enforce suppression when someone flips do_not_contact off — no special
  // case needed there. But block setting an email that's on the suppression
  // list.
  if (update.email) {
    const domain = String(update.email).split("@")[1]?.toLowerCase();
    const { data: suppressed } = await supabase
      .from("suppression_list")
      .select("id")
      .or(
        `and(type.eq.email,value.eq.${String(update.email).toLowerCase()}),and(type.eq.domain,value.eq.${domain})`
      )
      .limit(1);
    if (suppressed && suppressed.length > 0) {
      return NextResponse.json(
        { error: "This email or domain is on the suppression list." },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabase
    .from("prospects")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("activity_log").insert({
    prospect_id: id,
    actor_id: user.id,
    action: "prospect_updated",
    details: { fields: Object.keys(update) },
  });

  return NextResponse.json({ prospect: data });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/prospects/[id]">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("prospects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
