import { createClient } from "@/lib/supabase/server";
import SendQueueClient from "./SendQueueClient";

export default async function SendQueuePage() {
  const supabase = await createClient();

  const { data: approvedDrafts } = await supabase
    .from("email_drafts")
    .select(
      "*, prospects(id, business_name, city, business_type, email, do_not_contact)"
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  // A draft stays status="approved" even after it's been queued or sent
  // (email_sends is what tracks that), so filter those back out here —
  // same rule /api/drafts/send-batch uses to avoid double-queuing.
  const draftIds = (approvedDrafts ?? []).map((d) => d.id);
  const { data: existingSends } = draftIds.length
    ? await supabase
        .from("email_sends")
        .select("email_draft_id, status")
        .in("email_draft_id", draftIds)
    : { data: [] as { email_draft_id: string; status: string }[] };

  const alreadyHandled = new Set(
    (existingSends ?? [])
      .filter((s) => s.status === "scheduled" || s.status === "sent")
      .map((s) => s.email_draft_id)
  );
  const readyToSend = (approvedDrafts ?? []).filter((d) => !alreadyHandled.has(d.id));

  const { data: scheduled } = await supabase
    .from("email_sends")
    .select("*, prospects(business_name, email), email_drafts(subject)")
    .eq("status", "scheduled")
    .order("scheduled_for", { ascending: true });

  const { data: recent } = await supabase
    .from("email_sends")
    .select("*, prospects(business_name, email), email_drafts(subject)")
    .in("status", ["sent", "failed"])
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: settings } = await supabase
    .from("sending_settings")
    .select("*")
    .eq("id", true)
    .single();

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-semibold text-[#001630]">Send queue</h1>
      <p className="text-sm text-neutral-500 mt-1">
        Approve emails in the Approval Queue first. From here, queue a batch and they go out
        automatically — spaced out through the day so it doesn&apos;t look like a blast.
      </p>
      <SendQueueClient
        initialReadyToSend={readyToSend}
        initialScheduled={scheduled ?? []}
        initialRecent={recent ?? []}
        settings={
          settings ?? {
            max_daily_sends: 25,
            weekdays_only: true,
            sending_window_start: "09:00:00",
            sending_window_end: "16:00:00",
            min_spacing_minutes: 4,
            max_spacing_minutes: 18,
          }
        }
      />
    </div>
  );
}
