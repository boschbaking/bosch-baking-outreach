import { createClient } from "@/lib/supabase/server";
import { PIPELINE_STAGES } from "@/lib/types";
import PipelineBoard from "./PipelineBoard";

export default async function PipelinePage() {
  const supabase = await createClient();

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, business_name, city, business_type, status, prospect_score, do_not_contact")
    .in("status", PIPELINE_STAGES)
    .order("updated_at", { ascending: false })
    .limit(500);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-xl font-semibold text-[#001630]">Pipeline</h1>
      <p className="text-sm text-neutral-500 mt-1">Drag a card to change its stage.</p>
      <PipelineBoard initialProspects={prospects ?? []} />
    </div>
  );
}
