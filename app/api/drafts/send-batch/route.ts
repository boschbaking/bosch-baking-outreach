import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeScheduleSlots, type SendingSettings } from "@/lib/email/schedule";

interface DraftRow {
  id: string;
  prospect_id: string;
  status: string;
  prospects: {
    id: string;
    business_name: string;
    email: string | null;
    do_not_contact: boolean;
  } | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const draftIds: string[] | undefined = Array.isArray(body?.draft_ids)
    ? body.draft_ids
    : undefined;

  // 1. Gather candidate approved drafts.
  let query = supabase
    .from("email_drafts")
    .select("id, prospect_id, status, prospects(id, business_name, email, do_not_contact)")
    .eq("status", "approved");
  if (draftIds && draftIds.length > 0) {
    query = query.in("id", draftIds);
  }
  const { data: drafts, error: draftsError } = await query.returns<DraftRow[]>();
  if (draftsError) {
    return NextResponse.json({ error: draftsError.message }, { status: 500 });
  }
  if (!drafts || drafts.length === 0) {
    return NextResponse.json({ queued: 0, skipped: [], message: "Nothing approved to send." });
  }

  // 2. Drop anything already queued or sent, on the do-not-contact list, or
  // missing an email address entirely.
  const { data: existingSends } = await supabase
    .from("email_sends")
    .select("email_draft_id, status")
    .in(
      "email_draft_id",
      drafts.map((d) => d.id)
    );
  const alreadyQueued = new Set(
    (existingSends ?? [])
      .filter((s) => s.status === "scheduled" || s.status === "sent")
      .map((s) => s.email_draft_id)
  );

  const { data: suppressionRows } = await supabase
    .from("suppression_list")
    .select("type, value");
  const suppressedEmails = new Set(
    (suppressionRows ?? []).filter((r) => r.type === "email").map((r) => r.value.toLowerCase())
  );
  const suppressedDomains = new Set(
    (suppressionRows ?? []).filter((r) => r.type === "domain").map((r) => r.value.toLowerCase())
  );

  const skipped: { business_name: string; reason: string }[] = [];
  const eligible = drafts.filter((d) => {
    const p = d.prospects;
    if (!p) {
      skipped.push({ business_name: "(unknown)", reason: "prospect record missing" });
      return false;
    }
    if (alreadyQueued.has(d.id)) return false; // silently skip, not an error
    if (p.do_not_contact) {
      skipped.push({ business_name: p.business_name, reason: "on Do Not Contact list" });
      return false;
    }
    if (!p.email) {
      skipped.push({ business_name: p.business_name, reason: "no email on file" });
      return false;
    }
    const email = p.email.toLowerCase();
    const domain = email.split("@")[1] ?? "";
    if (suppressedEmails.has(email) || suppressedDomains.has(domain)) {
      skipped.push({ business_name: p.business_name, reason: "unsubscribed / suppressed" });
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return NextResponse.json({ queued: 0, skipped, message: "Nothing eligible to queue." });
  }

  // 3. Load sending settings + how many are already queued/sent today, so a
  // second batch doesn't blow past the daily cap.
  const { data: settingsRow } = await supabase
    .from("sending_settings")
    .select("*")
    .eq("id", true)
    .single();

  const settings: SendingSettings = {
    max_daily_sends: settingsRow?.max_daily_sends ?? 25,
    weekdays_only: settingsRow?.weekdays_only ?? true,
    sending_window_start: settingsRow?.sending_window_start ?? "09:00:00",
    sending_window_end: settingsRow?.sending_window_end ?? "16:00:00",
    min_spacing_minutes: settingsRow?.min_spacing_minutes ?? 4,
    max_spacing_minutes: settingsRow?.max_spacing_minutes ?? 18,
  };

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const { count: scheduledTodayCount } = await supabase
    .from("email_sends")
    .select("id", { count: "exact", head: true })
    .in("status", ["scheduled", "sent"])
    .gte("scheduled_for", startOfToday.toISOString());

  const slots = computeScheduleSlots({
    count: eligible.length,
    settings,
    now: new Date(),
    alreadyScheduledToday: scheduledTodayCount ?? 0,
  });

  // 4. Queue them.
  const rows = eligible.map((d, i) => ({
    email_draft_id: d.id,
    prospect_id: d.prospect_id,
    sequence_step: 0,
    status: "scheduled",
    scheduled_for: slots[i].toISOString(),
    provider: "resend",
  }));

  const { error: insertError } = await supabase.from("email_sends").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from("activity_log").insert(
    eligible.map((d) => ({
      prospect_id: d.prospect_id,
      actor_id: user.id,
      action: "send_queued",
      details: { draft_id: d.id },
    }))
  );

  return NextResponse.json({
    queued: rows.length,
    skipped,
    first_send_at: slots[0]?.toISOString(),
    last_send_at: slots[slots.length - 1]?.toISOString(),
  });
}
