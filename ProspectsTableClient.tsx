"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import type { Prospect, ProspectStatus } from "@/lib/types";

// Statuses that mean "hasn't been drafted yet" — these are the prospects a
// bulk "generate drafts" run should offer to touch. Anything past this
// point (Drafted, Approved, Contacted, etc.) already has a draft or has
// moved on, so re-running the batch later only picks up new prospects
// instead of redundantly re-drafting everyone every time.
const UNDRAFTED_STATUSES: ProspectStatus[] = ["New", "Researching", "Ready to Contact"];

export default function ProspectsTableClient({ prospects }: { prospects: Prospect[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [stoppedReason, setStoppedReason] = useState<string | null>(null);
  const [failures, setFailures] = useState<{ name: string; error: string }[]>([]);

  const eligible = useMemo(
    () => prospects.filter((p) => !p.do_not_contact && UNDRAFTED_STATUSES.includes(p.status)),
    [prospects]
  );

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAllEligible() {
    setSelected(new Set(eligible.map((p) => p.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function generateSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    setBusy(true);
    setStoppedReason(null);
    setFailures([]);
    setProgress({ done: 0, total: ids.length });

    for (let i = 0; i < ids.length; i++) {
      const prospect = prospects.find((p) => p.id === ids[i]);
      try {
        const res = await fetch("/api/drafts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prospect_id: ids[i], campaign_type: "new_prospect" }),
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message = json.error || "Draft generation failed";
          // A billing/credit error will fail for every remaining prospect
          // too — stop the batch instead of burning through the rest of
          // the list on calls that are guaranteed to fail the same way.
          if (/credit balance/i.test(message)) {
            setStoppedReason(
              "Your Anthropic API account is out of credits. Add credits at console.anthropic.com, then run this again — it'll pick up right where it left off."
            );
            break;
          }
          setFailures((prev) => [...prev, { name: prospect?.business_name ?? ids[i], error: message }]);
        }
      } catch {
        setFailures((prev) => [
          ...prev,
          { name: prospect?.business_name ?? ids[i], error: "Network error" },
        ]);
      }

      setProgress({ done: i + 1, total: ids.length });
    }

    setBusy(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={selectAllEligible}
          disabled={busy || eligible.length === 0}
          className="text-xs rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-50"
        >
          Select all without a draft ({eligible.length})
        </button>
        {selected.size > 0 && (
          <button
            onClick={clearSelection}
            disabled={busy}
            className="text-xs text-neutral-500 underline underline-offset-2"
          >
            Clear selection
          </button>
        )}

        <div className="flex-1" />

        {selected.size > 0 && (
          <button
            onClick={generateSelected}
            disabled={busy}
            className="text-sm rounded bg-[#001630] text-white px-4 py-1.5 hover:bg-[#0a2e57] disabled:opacity-60"
          >
            {busy
              ? `Generating ${progress?.done ?? 0}/${progress?.total ?? selected.size}...`
              : `Generate drafts for ${selected.size} selected`}
          </button>
        )}
      </div>

      {stoppedReason && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Stopped early: {stoppedReason}
        </div>
      )}

      {failures.length > 0 && (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <p className="font-medium">{failures.length} prospect(s) failed:</p>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {failures.map((f, i) => (
              <li key={i}>
                {f.name} — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="w-8 px-4 py-2.5"></th>
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
            {prospects.map((p) => {
              const isEligible = !p.do_not_contact && UNDRAFTED_STATUSES.includes(p.status);
              return (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    {isEligible && (
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        disabled={busy}
                        onChange={() => toggle(p.id)}
                      />
                    )}
                  </td>
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
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{p.prospect_score ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{p.last_contact_date ?? "—"}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{p.next_follow_up_date ?? "—"}</td>
                </tr>
              );
            })}
            {prospects.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-neutral-400">
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
