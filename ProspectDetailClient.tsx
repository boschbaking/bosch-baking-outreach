"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import {
  BREAD_CATEGORIES,
  BUSINESS_TYPES,
  CAMPAIGN_TYPE_LABELS,
  PROSPECT_STATUSES,
  type CampaignType,
  type EmailDraft,
  type Note,
  type Prospect,
  type ProspectStatus,
} from "@/lib/types";

async function api(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export default function ProspectDetailClient({
  prospect,
  initialNotes,
  initialDrafts,
}: {
  prospect: Prospect;
  initialNotes: Note[];
  initialDrafts: EmailDraft[];
}) {
  const router = useRouter();
  const [p, setP] = useState(prospect);
  const [notes, setNotes] = useState(initialNotes);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [campaignType, setCampaignType] = useState<CampaignType>("new_prospect");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualSubject, setManualSubject] = useState("");
  const [manualBody, setManualBody] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  async function saveField(fields: Partial<Prospect>) {
    setSavingField(Object.keys(fields).join(","));
    try {
      const { prospect: updated } = await api(`/api/prospects/${p.id}`, fields, "PATCH");
      setP(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingField(null);
      router.refresh();
    }
  }

  function toggleBread(cat: string) {
    const needs = p.likely_bread_needs ?? [];
    const next = needs.includes(cat) ? needs.filter((c) => c !== cat) : [...needs, cat];
    saveField({ likely_bread_needs: next });
  }

  async function addNote() {
    if (!newNote.trim()) return;
    const { note } = await api(`/api/prospects/${p.id}/notes`, { note: newNote });
    setNotes([note, ...notes]);
    setNewNote("");
  }

  async function generateDraft() {
    setGenerating(true);
    setGenError(null);
    try {
      const { draft } = await api("/api/drafts/generate", {
        prospect_id: p.id,
        campaign_type: campaignType,
      });
      setDrafts([draft, ...drafts]);
      setP({ ...p, status: p.status === "New" || p.status === "Researching" ? "Drafted" : p.status });
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function saveManualDraft() {
    setManualBusy(true);
    setManualError(null);
    try {
      const { draft } = await api("/api/drafts/manual", {
        prospect_id: p.id,
        campaign_type: campaignType,
        subject: manualSubject,
        body: manualBody,
      });
      setDrafts([draft, ...drafts]);
      setP({ ...p, status: p.status === "New" || p.status === "Researching" ? "Drafted" : p.status });
      setManualSubject("");
      setManualBody("");
      setShowManualForm(false);
    } catch (e) {
      setManualError(e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#001630]">{p.business_name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <StatusBadge status={p.status} />
            {p.do_not_contact && (
              <span className="status-badge bg-red-100 text-red-800 border border-red-300">
                Do Not Contact
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={p.status}
            onChange={(e) => saveField({ status: e.target.value as ProspectStatus })}
            className="text-sm rounded border border-neutral-300 px-2.5 py-1.5"
          >
            {PROSPECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={() => saveField({ do_not_contact: !p.do_not_contact })}
            className={`text-xs rounded px-3 py-1.5 border ${
              p.do_not_contact
                ? "border-red-300 text-red-700 bg-red-50"
                : "border-neutral-300 text-neutral-600"
            }`}
          >
            {p.do_not_contact ? "Remove DNC" : "Mark Do Not Contact"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <section className="rounded-md border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold text-[#001630] mb-3">Business info</h2>
            <div className="space-y-2.5 text-sm">
              <EditableRow label="Contact name" value={p.contact_name} onSave={(v) => saveField({ contact_name: v })} />
              <EditableRow label="Email" value={p.email} onSave={(v) => saveField({ email: v })} />
              <EditableRow label="Phone" value={p.phone} onSave={(v) => saveField({ phone: v })} />
              <EditableRow label="City" value={p.city} onSave={(v) => saveField({ city: v })} />
              <EditableRow label="State" value={p.state} onSave={(v) => saveField({ state: v })} />
              <EditableRow label="Website" value={p.website} onSave={(v) => saveField({ website: v })} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Business type</span>
                <select
                  value={p.business_type ?? ""}
                  onChange={(e) => saveField({ business_type: e.target.value })}
                  className="text-right border-b border-dashed border-neutral-300 focus:outline-none"
                >
                  <option value="">—</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Prospect score</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={p.prospect_score ?? undefined}
                  onBlur={(e) =>
                    saveField({ prospect_score: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-16 text-right border-b border-dashed border-neutral-300 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-500">Next follow-up</span>
                <input
                  type="date"
                  defaultValue={p.next_follow_up_date ?? ""}
                  onBlur={(e) => saveField({ next_follow_up_date: e.target.value || null })}
                  className="text-right border-b border-dashed border-neutral-300 focus:outline-none text-xs"
                />
              </div>
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold text-[#001630] mb-3">Likely bread needs</h2>
            <div className="flex flex-wrap gap-1.5">
              {BREAD_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleBread(cat)}
                  className={`text-xs rounded-full px-2.5 py-1 border ${
                    (p.likely_bread_needs ?? []).includes(cat)
                      ? "bg-[#001630] text-white border-[#001630]"
                      : "border-neutral-300 text-neutral-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold text-[#001630] mb-3">Notes ({notes.length})</h2>
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a sales note..."
                className="w-full text-sm rounded border border-neutral-300 px-2.5 py-2 min-h-[60px]"
              />
              <button
                onClick={addNote}
                className="text-xs rounded bg-[#001630] text-white px-3 py-1.5 hover:bg-[#0a2e57]"
              >
                Add note
              </button>
            </div>
            <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="text-xs border-t border-neutral-100 pt-2">
                  <div className="text-neutral-700">{n.note}</div>
                  <div className="text-neutral-400 mt-0.5">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-neutral-400">No notes yet.</p>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-md border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold text-[#001630] mb-1">Research notes</h2>
            <p className="text-xs text-neutral-400 mb-2">
              Only confirmed facts. Anything unknown should be left out, not guessed.
            </p>
            <AutosaveTextarea
              value={p.research_notes ?? ""}
              onSave={(v) => saveField({ research_notes: v })}
              placeholder="e.g. Independent burger restaurant, large burger + sandwich menu, no breakfast program..."
            />
          </section>

          {p.why_emailing && (
            <section className="rounded-md border border-dashed border-[#c9a95a] bg-[#fbf7ee] p-4">
              <h2 className="text-xs font-semibold text-[#7a5f22] mb-1 uppercase tracking-wide">
                Why am I emailing them? (internal only — never sent)
              </h2>
              <p className="text-sm text-[#3f3018]">{p.why_emailing}</p>
            </section>
          )}

          <section className="rounded-md border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold text-[#001630] mb-1">Sales notes</h2>
            <AutosaveTextarea
              value={p.sales_notes ?? ""}
              onSave={(v) => saveField({ sales_notes: v })}
              placeholder="Anything else worth remembering about this account..."
            />
          </section>

          <section className="rounded-md border border-neutral-200 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-[#001630]">Draft an email</h2>
              <div className="flex items-center gap-2">
                <select
                  value={campaignType}
                  onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                  className="text-sm rounded border border-neutral-300 px-2.5 py-1.5"
                >
                  {Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={generateDraft}
                  disabled={generating || p.do_not_contact}
                  className="text-sm rounded bg-[#001630] text-white px-4 py-1.5 hover:bg-[#0a2e57] disabled:opacity-60"
                >
                  {generating ? "Drafting..." : "Generate draft"}
                </button>
                <button
                  onClick={() => setShowManualForm((v) => !v)}
                  disabled={p.do_not_contact}
                  className="text-sm rounded border border-neutral-300 px-4 py-1.5 hover:bg-neutral-50 disabled:opacity-60"
                >
                  {showManualForm ? "Cancel" : "Write your own"}
                </button>
              </div>
            </div>
            {genError && <p className="text-sm text-rose-600 mt-2">{genError}</p>}

            {showManualForm && (
              <div className="mt-4 rounded-md border border-dashed border-neutral-300 p-3 space-y-2">
                <input
                  value={manualSubject}
                  onChange={(e) => setManualSubject(e.target.value)}
                  placeholder="Subject line"
                  className="w-full text-sm font-medium border-b border-neutral-300 pb-1.5 focus:outline-none focus:border-[#c9a95a]"
                />
                <textarea
                  value={manualBody}
                  onChange={(e) => setManualBody(e.target.value)}
                  placeholder="Type what you want to say to this customer..."
                  className="w-full text-sm rounded border border-neutral-300 px-2.5 py-2 min-h-[160px] focus:outline-none focus:border-[#c9a95a]"
                />
                {manualError && <p className="text-sm text-rose-600">{manualError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={saveManualDraft}
                    disabled={manualBusy || !manualSubject.trim() || !manualBody.trim()}
                    className="text-xs rounded bg-[#001630] text-white px-3 py-1.5 disabled:opacity-60"
                  >
                    {manualBusy ? "Saving..." : "Save to Approval Queue"}
                  </button>
                  <button
                    onClick={() => {
                      setShowManualForm(false);
                      setManualSubject("");
                      setManualBody("");
                      setManualError(null);
                    }}
                    className="text-xs rounded border border-neutral-300 px-3 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {drafts.map((d) => (
                <DraftCard key={d.id} draft={d} onChanged={(nd) => setDrafts(drafts.map((x) => (x.id === nd.id ? nd : x)))} onNew={(nd) => setDrafts([nd, ...drafts])} />
              ))}
              {drafts.length === 0 && (
                <p className="text-sm text-neutral-400">No drafts yet — generate one above.</p>
              )}
            </div>
          </section>
        </div>
      </div>
      {savingField && (
        <div className="fixed bottom-4 right-4 text-xs bg-[#001630] text-white px-3 py-1.5 rounded shadow">
          Saving...
        </div>
      )}
    </div>
  );
}

function EditableRow({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-neutral-500 shrink-0">{label}</span>
      <input
        defaultValue={value ?? ""}
        onBlur={(e) => {
          if (e.target.value !== (value ?? "")) onSave(e.target.value);
        }}
        className="text-right border-b border-dashed border-neutral-300 focus:outline-none focus:border-[#c9a95a] max-w-[60%]"
      />
    </div>
  );
}

function AutosaveTextarea({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  return (
    <textarea
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onSave(local);
      }}
      className="w-full text-sm rounded border border-neutral-300 px-3 py-2 min-h-[100px] focus:outline-none focus:border-[#c9a95a]"
    />
  );
}

function DraftCard({
  draft,
  onChanged,
  onNew,
}: {
  draft: EmailDraft;
  onChanged: (d: EmailDraft) => void;
  onNew: (d: EmailDraft) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.edited_body ?? draft.body);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const displayBody = draft.edited_body ?? draft.body;
  const isManual = draft.quality_score === null;
  const score = draft.quality_score ?? 0;
  const scoreColor = isManual
    ? "text-neutral-600 bg-neutral-100 border-neutral-300"
    : score >= 85 ? "text-emerald-700 bg-emerald-50 border-emerald-200" :
    score >= 75 ? "text-amber-700 bg-amber-50 border-amber-200" :
    "text-rose-700 bg-rose-50 border-rose-200";

  async function save() {
    setBusy(true);
    try {
      const { draft: updated } = await api(`/api/drafts/${draft.id}/edit`, { subject, body }, "POST");
      onChanged(updated);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    try {
      const { draft: updated } = await api(`/api/drafts/${draft.id}/approve`, undefined, "POST");
      onChanged(updated);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      const { draft: updated } = await api(`/api/drafts/${draft.id}/reject`, { reason: "manual" }, "POST");
      onChanged(updated);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    try {
      const { draft: newDraft } = await api(`/api/drafts/${draft.id}/regenerate`, { feedback: feedback || null }, "POST");
      onNew(newDraft);
      onChanged({ ...draft, status: "rejected" });
      setFeedback("");
    } finally {
      setBusy(false);
    }
  }

  if (draft.status === "rejected") {
    return (
      <div className="rounded border border-neutral-100 p-3 opacity-50 text-xs text-neutral-400">
        Superseded draft — {draft.subject}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-neutral-200 overflow-hidden">
      <div className="flex items-center justify-between bg-neutral-50 px-3 py-2 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <span className={`status-badge border ${scoreColor}`}>
            {isManual ? "Written manually" : `Quality ${score}/100`}
          </span>
          <span className="text-xs text-neutral-500 capitalize">{draft.status}</span>
        </div>
        <span className="text-xs text-neutral-400">v{draft.version}</span>
      </div>
      <div className="p-3">
        {editing ? (
          <div className="space-y-2">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-sm font-medium border-b border-neutral-300 pb-1 focus:outline-none"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full text-sm border border-neutral-300 rounded px-2.5 py-2 min-h-[160px] focus:outline-none focus:border-[#c9a95a]"
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="text-xs rounded bg-[#001630] text-white px-3 py-1.5"
              >
                Save edits
              </button>
              <button
                onClick={() => {
                  setSubject(draft.subject);
                  setBody(displayBody);
                  setEditing(false);
                }}
                className="text-xs rounded border border-neutral-300 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm font-medium text-[#001630]">{draft.subject}</div>
            <div className="text-sm text-neutral-700 whitespace-pre-wrap mt-1.5">{displayBody}</div>
          </>
        )}

        {draft.quality_check && !editing && (
          <details className="mt-3 text-xs text-neutral-500">
            <summary className="cursor-pointer select-none">Quality check details</summary>
            <p className="mt-1.5">{draft.quality_check.why_it_passed}</p>
            {draft.quality_check.banned_phrases_found.length > 0 && (
              <p className="mt-1 text-rose-600">
                Banned phrases found: {draft.quality_check.banned_phrases_found.join(", ")}
              </p>
            )}
            {draft.quality_check.facts_used.length > 0 && (
              <p className="mt-1">Facts used: {draft.quality_check.facts_used.join("; ")}</p>
            )}
          </details>
        )}

        {draft.status === "draft" && !editing && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={approve} disabled={busy} className="text-xs rounded bg-[#001630] text-white px-3 py-1.5 hover:bg-[#0a2e57]">
              Approve
            </button>
            <button onClick={() => setEditing(true)} className="text-xs rounded border border-neutral-300 px-3 py-1.5">
              Edit
            </button>
            <button onClick={reject} disabled={busy} className="text-xs rounded border border-rose-300 text-rose-600 px-3 py-1.5">
              Reject
            </button>
            <input
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Feedback for regenerate (optional)"
              className="text-xs rounded border border-neutral-300 px-2 py-1.5 flex-1 min-w-[140px]"
            />
            <button onClick={regenerate} disabled={busy} className="text-xs rounded border border-neutral-300 px-3 py-1.5">
              Regenerate
            </button>
          </div>
        )}

        {draft.status === "approved" && (
          <div className="mt-3 text-xs text-emerald-700">
            Approved — ready to send once sending is set up (Phase 3).
          </div>
        )}
      </div>
    </div>
  );
}
