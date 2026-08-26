import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { PROSPECT_STATUSES, type ProspectStatus } from "@/lib/types";
import ProspectFilters from "./ProspectFilters";

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

      <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Business</th>
              <th className="text-left px-4 py-2.5 font-medium">City</th>
              <th className="text-left px-4 py-2.5 font-medium">Type</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-left px-4 py-2.5 font-medium">Score</th>
              <th className="text-left px-4 py-2.5 font-medium">Last Contact</th>
              <th className="text-left px-4 py-2.5 font-medium">Next Follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {(prospects ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/prospects/${p.id}`}
                    className="font-medium text-[#001630] hover:text-[#c9a95a]"
                  >
                    {p.business_name}
                  </Link>
                  {p.do_not_contact && (
                    <span className="ml-2 text-[10px] uppercase text-red-600 font-semibold">
                      DNC
                    </span>
                  )}
                  <div className="text-xs text-neutral-400">{p.contact_name}</div>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{p.city ?? "—"}</td>
                <td className="px-4 py-2.5 text-neutral-600">{p.business_type ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={p.status as ProspectStatus} />
                </td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {p.prospect_score ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {p.last_contact_date ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {p.next_follow_up_date ?? "—"}
                </td>
              </tr>
            ))}
            {(prospects ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-neutral-400">
                  No prospects match these filters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
