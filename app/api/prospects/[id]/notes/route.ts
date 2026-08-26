import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/prospects/[id]/notes">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { note } = await request.json();
  if (!note || typeof note !== "string") {
    return NextResponse.json({ error: "note is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({ prospect_id: id, author_id: user.id, note })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ note: data });
}
