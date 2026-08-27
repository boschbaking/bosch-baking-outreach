"use client";

import { useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { BUSINESS_TYPES } from "@/lib/types";

const TARGET_FIELDS = [
  { key: "business_name", label: "Business Name", required: true },
  { key: "contact_name", label: "Contact Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "business_type", label: "Business Type" },
  { key: "website", label: "Website" },
  { key: "research_notes", label: "Research Notes" },
] as const;

type FieldKey = (typeof TARGET_FIELDS)[number]["key"];

function guessMapping(headers: string[]): Record<FieldKey, string> {
  const mapping = {} as Record<FieldKey, string>;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const field of TARGET_FIELDS) {
    const target = normalize(field.label);
    const match = headers.find((h) => {
      const n = normalize(h);
      return n === target || n.includes(normalize(field.key)) || target.includes(n);
    });
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

export default function ImportPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [tagCity, setTagCity] = useState("");
  const [tagBusinessType, setTagBusinessType] = useState("");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? [];
        setHeaders(fields);
        setMapping(guessMapping(fields));
        setRows(results.data);
        setReport(null);
      },
      error: (err) => setError(err.message),
    });
  }

  async function handleImport() {
    if (!mapping.business_name) {
      setError("Map a column to Business Name before importing.");
      return;
    }
    setImporting(true);
    setError(null);

    const mappedRows = rows.map((r) => {
      const out: Record<string, string> = {};
      for (const field of TARGET_FIELDS) {
        const col = mapping[field.key];
        if (col && r[col] !== undefined) out[field.key] = r[col];
      }
      return out;
    });

    try {
      const res = await fetch("/api/prospects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: mappedRows,
          tag_city: tagCity || undefined,
          tag_business_type: tagBusinessType || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setReport(json.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#001630]">Import prospects</h1>
      <p className="text-sm text-neutral-500 mt-1">
        Upload a CSV. We&apos;ll map columns, skip duplicates by email, and check the
        suppression list automatically.
      </p>

      {!rows.length && (
        <div className="mt-6 border-2 border-dashed border-neutral-300 rounded-md p-10 text-center">
          <input type="file" accept=".csv" onChange={handleFile} className="text-sm" />
          <p className="text-xs text-neutral-400 mt-3">CSV with a header row.</p>
        </div>
      )}

      {rows.length > 0 && !report && (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-[#001630] mb-2">
              Map columns ({rows.length} rows found)
            </h2>
            <div className="space-y-2">
              {TARGET_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-sm w-36 shrink-0 text-neutral-600">
                    {field.label}
                    {"required" in field && field.required && (
                      <span className="text-rose-500"> *</span>
                    )}
                  </span>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    className="flex-1 text-sm rounded border border-neutral-300 px-2.5 py-1.5"
                  >
                    <option value="">— Don&apos;t import —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#001630] mb-2">
              Bulk tag (optional — applies to every row in this import)
            </h2>
            <div className="flex gap-3">
              <input
                placeholder="Override/set city"
                value={tagCity}
                onChange={(e) => setTagCity(e.target.value)}
                className="flex-1 text-sm rounded border border-neutral-300 px-2.5 py-1.5"
              />
              <select
                value={tagBusinessType}
                onChange={(e) => setTagBusinessType(e.target.value)}
                className="flex-1 text-sm rounded border border-neutral-300 px-2.5 py-1.5"
              >
                <option value="">Don&apos;t set business type</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[#001630] mb-2">Preview</h2>
            <div className="overflow-x-auto rounded border border-neutral-200 text-xs">
              <table className="min-w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                      <th key={f.key} className="text-left px-3 py-2 font-medium">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {TARGET_FIELDS.filter((f) => mapping[f.key]).map((f) => (
                        <td key={f.key} className="px-3 py-2 text-neutral-600">
                          {r[mapping[f.key]]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded bg-[#001630] text-white text-sm px-5 py-2.5 hover:bg-[#0a2e57] disabled:opacity-60"
          >
            {importing ? "Importing..." : `Import ${rows.length} rows`}
          </button>
        </div>
      )}

      {report && (
        <div className="mt-6 rounded-md border border-neutral-200 p-5">
          <h2 className="text-sm font-semibold text-[#001630] mb-3">Import complete</h2>
          <ul className="text-sm text-neutral-700 space-y-1">
            <li>{report.inserted} prospects added</li>
            <li>{report.duplicates} skipped as duplicates (already in your database)</li>
            <li>{report.suppressed} skipped — on your suppression list</li>
            <li>{report.invalid_email} skipped — invalid email format</li>
            <li>{report.missing_name} skipped — missing business name</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => router.push("/prospects")}
              className="rounded bg-[#001630] text-white text-sm px-4 py-2"
            >
              View prospects
            </button>
            <button
              onClick={() => {
                setRows([]);
                setReport(null);
              }}
              className="rounded border border-neutral-300 text-sm px-4 py-2"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
