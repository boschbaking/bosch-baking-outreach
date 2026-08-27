import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/sends/[id]/cancel">
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: send, error } = await supabase
    .from("email_sends")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "scheduled") // can't cancel one that already went out
    .select()
    .single();

  if (error || !send) {
    return NextResponse.json(
      { error: error?.message || "Send not found or already sent" },
      { status: 409 }
    );
  }

  return NextResponse.json({ send });
}
