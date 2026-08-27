"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CAMPAIGN_TYPE_LABELS, type EmailDraft } from "@/lib/types";

interface DraftWithProspect extends EmailDraft {
  prospects: {
    id: string;
    business_name: string;
    city: string | null;
    business_type: string | null;
    do_not_contact: boolean;
    contact_name: string | null;
  } | null;
}

async function api(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export default function ApprovalQueueClient({
  initialDrafts,
}: {
  initialDrafts: DraftWithProspect[];
}) {
  const [drafts, setDrafts] = useState(initialDrafts.filter((d) => !d.prospects?.do_not_contact));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, { subject: string; body: string }>>({});

  const cities = useMemo(
    () => Array.from(new Set(drafts.map((d) => d.prospects?.city).filter(Boolean))) as string[],
    [drafts]
  );
  const types = useMemo(
    () =>
      Array.from(new Set(drafts.map((d) => d.prospects?.business_type).filter(Boolean))) as string[],
    [drafts]
  );

  const filtered = drafts.filter((d) => {
    if (cityFilter && d.prospects?.city !== cityFilter) return false;
    if (typeFilter && d.prospects?.business_type !== typeFilter) return false;
    if (campaignFilter && d.campaign_type !== campaignFilter) return false;
    return true;
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((d) => d.id)));
  }

  function removeFromQueue(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function approveOne(id: string) {
    await api(`/api/drafts/${id}/approve`);
    removeFromQueue(id);
  }

  async function rejectOne(id: string) {
    await api(`/api/drafts/${id}/reject`, { reason: "manual" });
    removeFromQueue(id);
  }

  async function regenerateOne(id: string) {
    await api(`/api/drafts/${id}/regenerate`, {});
    removeFromQueue(id); // the old one is superseded; new draft goes back to the prospect page
  }

  async function saveEdit(id: string) {
    const edit = editing[id];
    if (!edit) return;
    await api(`/api/drafts/${id}/edit`, edit);
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, subject: edit.subject, edited_body: edit.body } : d))
    );
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function bulkApprove() {
    setBulkBusy(true);
    try {
      for (const id of selected) {
        await api(`/api/drafts/${id}/approve`);
      }
      setDrafts((prev) => prev.filter((d) => !selected.has(d.id)));
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="text-sm rounded border border-neutral-300 px-2.5 py-1.5"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm rounded border border-neutral-300 px-2.5 py-1.5"
        >
          <option value="">All business types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="text-sm rounded border border-neutral-300 px-2.5 py-1.5"
        >
          <option value="">All campaign types</option>
          {Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        {selected.size > 0 && (
          <button
            onClick={bulkApprove}
            disabled={bulkBusy}
            className="text-sm rounded bg-[#001630] text-white px-4 py-1.5 hover:bg-[#0a2e57] disabled:opacity-60"
          >
            {bulkBusy ? "Approving..." : `Approve ${selected.size} selected`}
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
        <input
          type="checkbox"
          checked={filtered.length > 0 && selected.size === filtered.length}
          onChange={toggleAll}
        />
        Select all ({filtered.length})
      </div>

      <div className="mt-2 space-y-3">
        {filtered.map((d) => {
          const isEditing = !!editing[d.id];
          const displayBody = d.edited_body ?? d.body;
          const isManual = d.quality_score === null;
          const score = d.quality_score ?? 0;
          const scoreColor = isManual
            ? "text-neutral-600 bg-neutral-100 border-neutral-300"
            : score >= 85
            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
            : score >= 75
            ? "text-amber-700 bg-amber-50 border-amber-200"
            : "text-rose-700 bg-rose-50 border-rose-200";

          return (
            <div key={d.id} className="rounded-md border border-neutral-200 overflow-hidden">
              <div className="flex items-center gap-3 bg-neutral-50 px-3 py-2 border-b border-neutral-200">
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                />
                <Link
                  href={`/prospects/${d.prospects?.id}`}
                  className="text-sm font-medium text-[#001630] hover:text-[#c9a95a]"
                >
                  {d.prospects?.business_name}
                </Link>
                <span className="text-xs text-neutral-400">
                  {d.prospects?.city} · {d.prospects?.business_type}
                </span>
                <span className="text-xs text-neutral-400">
                  {CAMPAIGN_TYPE_LABELS[d.campaign_type]}
                </span>
                <span className={`status-badge border ml-auto ${scoreColor}`}>
                  {isManual ? "Written manually" : `Quality ${score}/100`}
                </span>
              </div>
              <div className="p-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editing[d.id].subject}
                      onChange={(e) =>
                        setEditing({ ...editing, [d.id]: { ...editing[d.id], subject: e.target.value } })
                      }
                      className="w-full text-sm font-medium border-b border-neutral-300 pb-1 focus:outline-none"
                    />
                    <textarea
                      value={editing[d.id].body}
                      onChange={(e) =>
                        setEditing({ ...editing, [d.id]: { ...editing[d.id], body: e.target.value } })
                      }
                      className="w-full text-sm border border-neutral-300 rounded px-2.5 py-2 min-h-[140px]"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-medium text-[#001630]">{d.subject}</div>
                    <div className="text-sm text-neutral-700 whitespace-pre-wrap mt-1.5">
                      {displayBody}
                    </div>
                  </>
                )}

                {expanded[d.id] && d.quality_check && (
                  <div className="mt-2 text-xs text-neutral-500 border-t border-neutral-100 pt-2">
                    <p>{d.quality_check.why_it_passed}</p>
                    {d.quality_check.banned_phrases_found.length > 0 && (
                      <p className="text-rose-600 mt-1">
                        Banned phrases: {d.quality_check.banned_phrases_found.join(", ")}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(d.id)}
                        className="text-xs rounded bg-[#001630] text-white px-3 py-1.5"
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          setEditing((prev) => {
                            const next = { ...prev };
                            delete next[d.id];
                            return next;
                          })
                        }
                        className="text-xs rounded border border-neutral-300 px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => approveOne(d.id)}
                        className="text-xs rounded bg-[#001630] text-white px-3 py-1.5 hover:bg-[#0a2e57]"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          setEditing({ ...editing, [d.id]: { subject: d.subject, body: displayBody } })
                        }
                        className="text-xs rounded border border-neutral-300 px-3 py-1.5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => rejectOne(d.id)}
                        className="text-xs rounded border border-rose-300 text-rose-600 px-3 py-1.5"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => regenerateOne(d.id)}
                        className="text-xs rounded border border-neutral-300 px-3 py-1.5"
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={() => setExpanded({ ...expanded, [d.id]: !expanded[d.id] })}
                        className="text-xs text-neutral-400 underline underline-offset-2 ml-auto"
                      >
                        {expanded[d.id] ? "Hide" : "Show"} quality details
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-neutral-400 py-10 text-center">
            Nothing waiting for approval right now.
          </p>
        )}
      </div>
    </div>
  );
}
