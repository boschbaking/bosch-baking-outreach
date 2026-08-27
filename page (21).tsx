import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    newProspects,
    awaitingApproval,
    sentToday,
    replies,
    interested,
    samplesRequested,
    samplesDropped,
    customersWon,
    followUpsDue,
    doNotContact,
  ] = await Promise.all([
    supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "New"),
    supabase.from("email_drafts").select("*", { count: "exact", head: true }).eq("status", "draft"),
    supabase
      .from("email_sends")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", `${today}T00:00:00`)
      .lte("sent_at", `${today}T23:59:59`),
    supabase.from("replies").select("*", { count: "exact", head: true }).eq("handled", false),
    supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "Interested"),
    supabase.from("sample_requests").select("*", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("sample_requests").select("*", { count: "exact", head: true }).eq("status", "dropped"),
    supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "Customer"),
    supabase
      .from("prospects")
      .select("*", { count: "exact", head: true })
      .lte("next_follow_up_date", today)
      .not("next_follow_up_date", "is", null),
    supabase.from("prospects").select("*", { count: "exact", head: true }).eq("do_not_contact", true),
  ]);

  const cards = [
    { label: "New Prospects", value: newProspects.count ?? 0, href: "/prospects?status=New" },
    { label: "Awaiting Approval", value: awaitingApproval.count ?? 0, href: "/approvals" },
    { label: "Sent Today", value: sentToday.count ?? 0, href: "/pipeline" },
    { label: "Unhandled Replies", value: replies.count ?? 0, href: "/prospects?status=Replied" },
    { label: "Interested", value: interested.count ?? 0, href: "/prospects?status=Interested" },
    { label: "Samples Requested", value: samplesRequested.count ?? 0, href: "/prospects?status=Sample Requested" },
    { label: "Samples Dropped", value: samplesDropped.count ?? 0, href: "/prospects?status=Sample Dropped" },
    { label: "Customers Won", value: customersWon.count ?? 0, href: "/prospects?status=Customer" },
    { label: "Follow-ups Due", value: followUpsDue.count ?? 0, href: "/prospects" },
    { label: "Do Not Contact", value: doNotContact.count ?? 0, href: "/prospects?status=Do Not Contact" },
  ];

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-semibold text-[#001630]">Dashboard</h1>
      <p className="text-sm text-neutral-500 mt-1">
        Where things stand across your pipeline right now.
      </p>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-md border border-neutral-200 bg-white p-4 hover:border-[#c9a95a] hover:shadow-sm transition-all"
          >
            <div className="text-2xl font-semibold text-[#001630]">{card.value}</div>
            <div className="text-xs text-neutral-500 mt-1">{card.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/prospects/import"
          className="rounded bg-[#001630] text-white text-sm px-4 py-2 hover:bg-[#0a2e57] transition-colors"
        >
          Import prospects
        </Link>
        <Link
          href="/approvals"
          className="rounded border border-[#001630] text-[#001630] text-sm px-4 py-2 hover:bg-neutral-50 transition-colors"
        >
          Review drafts
        </Link>
        <Link
          href="/pipeline"
          className="rounded border border-neutral-300 text-neutral-700 text-sm px-4 py-2 hover:bg-neutral-50 transition-colors"
        >
          View pipeline
        </Link>
      </div>
    </div>
  );
}
