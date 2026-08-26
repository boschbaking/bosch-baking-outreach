import { createClient } from "@/lib/supabase/server";
import ApprovalQueueClient from "./ApprovalQueueClient";

export default async function ApprovalsPage() {
  const supabase = await createClient();

  const { data: drafts } = await supabase
    .from("email_drafts")
    .select(
      "*, prospects(id, business_name, city, business_type, do_not_contact, contact_name)"
    )
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-semibold text-[#001630]">Approval queue</h1>
      <p className="text-sm text-neutral-500 mt-1">
        Nothing sends until you approve it here.
      </p>
      <ApprovalQueueClient initialDrafts={drafts ?? []} />
    </div>
  );
}
