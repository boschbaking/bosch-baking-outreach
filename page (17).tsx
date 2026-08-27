import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PROSPECT_STATUSES } from "@/lib/types";
import ProspectFilters from "./ProspectFilters";
import ProspectsTableClient from "./ProspectsTableClient";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const city = typeof params.city === "string" ? params.city : "";
  const businessType = typeof params.type === "string" ? params.type : "";
  const q = typeof params.q === "string" ? params.q : "";

  const supabase = await createClient();

  let query = supabase
    .from("prospects")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (city) query = query.eq("city", city);
  if (businessType) query = query.eq("business_type", businessType);
  if (q) {
    query = query.or(
      `business_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%`
    );
  }

  const { data: prospects } = await query;

  const [{ data: cities }, { data: types }] = await Promise.all([
    supabase.from("prospects").select("city").not("city", "is", null),
    supabase.from("prospects").select("business_type").not("business_type", "is", null),
  ]);

  const uniqueCities = Array.from(new Set((cities ?? []).map((c) => c.city))).sort() as string[];
  const uniqueTypes = Array.from(
    new Set((types ?? []).map((t) => t.business_type))
  ).sort() as string[];

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#001630]">Prospects</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {prospects?.length ?? 0} shown
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/prospects/new"
            className="rounded bg-[#001630] text-white text-sm px-4 py-2 hover:bg-[#0a2e57] transition-colors"
          >
            + Add prospect
          </Link>
          <Link
            href="/prospects/import"
            className="rounded border border-[#001630] text-[#001630] text-sm px-4 py-2 hover:bg-neutral-50 transition-colors"
          >
            Import CSV
          </Link>
        </div>
      </div>

      <ProspectFilters
        statuses={PROSPECT_STATUSES}
        cities={uniqueCities}
        types={uniqueTypes}
        current={{ status, city, type: businessType, q }}
      />

      <ProspectsTableClient prospects={prospects ?? []} />
    </div>
  );
}
