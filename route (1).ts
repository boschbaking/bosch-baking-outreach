import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (!body.business_name || typeof body.business_name !== "string") {
    return NextResponse.json({ error: "business_name is required" }, { status: 400 });
  }

  // Refuse to (re)create a prospect on the suppression list.
  if (body.email) {
    const domain = String(body.email).split("@")[1]?.toLowerCase();
    const { data: suppressed } = await supabase
      .from("suppression_list")
      .select("id")
      .or(
        `and(type.eq.email,value.eq.${body.email.toLowerCase()}),and(type.eq.domain,value.eq.${domain})`
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
    .insert({
      business_name: body.business_name,
      contact_name: body.contact_name || null,
      email: body.email || null,
      phone: body.phone || null,
      city: body.city || null,
      state: body.state || null,
      business_type: body.business_type || null,
      website: body.website || null,
      likely_bread_needs: body.likely_bread_needs || [],
      research_notes: body.research_notes || null,
      sales_notes: body.sales_notes || null,
      status: body.status || "New",
      source: body.source || "manual",
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("activity_log").insert({
    prospect_id: data.id,
    actor_id: user.id,
    action: "prospect_created",
    details: { source: body.source || "manual" },
  });

  return NextResponse.json({ prospect: data });
}
