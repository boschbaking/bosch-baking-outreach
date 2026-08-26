"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EmailDraft, EmailSend } from "@/lib/types";

interface DraftWithProspect extends EmailDraft {
  prospects: {
    id: string;
    business_name: string;
    city: string | null;
    business_type: string | null;
    email: string | null;
    do_not_contact: boolean;
  } | null;
}

interface SendWithRelations extends EmailSend {
  prospects: { business_name: string; email: string | null } | null;
  email_drafts: { subject: string } | null;
}

interface SendingSettings {
  max_daily_sends: number;
  weekdays_only: boolean;
  sending_window_start: string;
  sending_window_end: string;
  min_spacing_minutes: number;
  max_spacing_minutes: number;
}

interface BatchResult {
  queued: number;
  skipped: { business_name: string; reason: string }[];
  first_send_at?: string;
  last_send_at?: string;
  message?: string;
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

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeOnly(t: string) {
  // t is "HH:MM:SS" from Postgres time — render as a friendly local-ish label.
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function SendQueueClient({
  initialReadyToSend,
  initialScheduled,
  initialRecent,
  settings,
}: {
  initialReadyToSend: DraftWithProspect[];
  initialScheduled: SendWithRelations[];
  initialRecent: SendWithRelations[];
  settings: SendingSettings;
}) {
  const router = useRouter();
  const sendable = initialReadyToSend.filter(
    (d) => d.prospects?.email && !d.prospects?.do_not_contact
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(sendable.map((d) => d.id)));
  const [busy, setBusy] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === sendable.length) setSelected(new Set());
    else setSelected(new Set(sendable.map((d) => d.id)));
  }

  async function sendSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api("/api/drafts/send-batch", { draft_ids: Array.from(selected) });
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSend(id: string) {
    setCancelingId(id);
    setError(null);
    try {
      await api(`/api/sends/${id}/cancel`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cancel that send.");
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
        Sending up to <strong className="text-neutral-700">{settings.max_daily_sends}</strong>{" "}
        emails/day, {settings.weekdays_only ? "weekdays only, " : ""}
        between <strong className="text-neutral-700">{timeOnly(settings.sending_window_start)}</strong>{" "}
        and <strong className="text-neutral-700">{timeOnly(settings.sending_window_end)}</strong>,
        spaced {settings.min_spacing_minutes}–{settings.max_spacing_minutes} min apart. A background
        job checks every 5 minutes for what&apos;s due and sends it via Resend.
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <p>
            Queued {result.queued} email{result.queued === 1 ? "" : "s"}
            {result.first_send_at && (
              <>
                {" "}
                — first goes out {formatWhen(result.first_send_at)}, last around{" "}
                {formatWhen(result.last_send_at ?? null)}.
              </>
            )}
          </p>
          {result.skipped.length > 0 && (
            <p className="mt-1 text-emerald-700/80">
              Skipped {result.skipped.length}: {result.skipped.map((s) => `${s.business_name} (${s.reason})`).join(", ")}
            </p>
          )}
        </div>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#001630]">
            Ready to send ({sendable.length})
          </h2>
          {sendable.length > 0 && (
            <button
              onClick={sendSelected}
              disabled={busy || selected.size === 0}
              className="text-sm rounded bg-[#001630] text-white px-4 py-1.5 hover:bg-[#0a2e57] disabled:opacity-60"
            >
              {busy ? "Queuing..." : `Send ${selected.size || ""} selected`}
            </button>
          )}
        </div>

        {sendable.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
            <input
              type="checkbox"
              checked={selected.size === sendable.length}
              onChange={toggleAll}
            />
            Select all
          </div>
        )}

        <div className="mt-2 space-y-2">
          {sendable.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2 cursor-pointer hover:bg-neutral-50"
            >
              <input
                type="checkbox"
                checked={selected.has(d.id)}
                onChange={() => toggle(d.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/prospects/${d.prospects?.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-medium text-[#001630] hover:text-[#c9a95a]"
                  >
                    {d.prospects?.business_name}
                  </Link>
                  <span className="text-xs text-neutral-400">{d.prospects?.email}</span>
                </div>
                <div className="text-xs text-neutral-500 truncate">{d.subject}</div>
              </div>
            </label>
          ))}

          {initialReadyToSend
            .filter((d) => !d.prospects?.email || d.prospects?.do_not_contact)
            .map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 opacity-60"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-neutral-500">
                    {d.prospects?.business_name}
                  </div>
                  <div className="text-xs text-neutral-400">
                    Approved, but {d.prospects?.do_not_contact ? "on the Do Not Contact list" : "no email on file"} —
                    won&apos;t be queued.
                  </div>
                </div>
              </div>
            ))}

          {sendable.length === 0 && initialReadyToSend.length === 0 && (
            <p className="text-sm text-neutral-400 py-6 text-center">
              Nothing approved and waiting to be queued. Approve drafts in the Approval Queue first.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[#001630]">
          Scheduled ({initialScheduled.length})
        </h2>
        <div className="mt-2 space-y-2">
          {initialScheduled.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-md border border-neutral-200 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#001630]">
                  {s.prospects?.business_name}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {s.email_drafts?.subject} · {s.prospects?.email}
                </div>
              </div>
              <div className="text-xs text-neutral-500 whitespace-nowrap">
                {formatWhen(s.scheduled_for)}
              </div>
              <button
                onClick={() => cancelSend(s.id)}
                disabled={cancelingId === s.id}
                className="text-xs rounded border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 disabled:opacity-60"
              >
                {cancelingId === s.id ? "..." : "Cancel"}
              </button>
            </div>
          ))}
          {initialScheduled.length === 0 && (
            <p className="text-sm text-neutral-400 py-6 text-center">Nothing scheduled right now.</p>
          )}
        </div>
      </section>

      {initialRecent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[#001630]">Recent activity</h2>
          <div className="mt-2 space-y-2">
            {initialRecent.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-md border border-neutral-100 px-3 py-2"
              >
                <span
                  className={`status-badge border ${
                    s.status === "sent"
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-rose-700 bg-rose-50 border-rose-200"
                  }`}
                >
                  {s.status}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#001630]">{s.prospects?.business_name}</div>
                  {s.status === "failed" && s.error_message && (
                    <div className="text-xs text-rose-600 truncate">{s.error_message}</div>
                  )}
                </div>
                <div className="text-xs text-neutral-400 whitespace-nowrap">
                  {formatWhen(s.sent_at ?? s.created_at)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
