"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

export default function ProspectFilters({
  statuses,
  cities,
  types,
  current,
}: {
  statuses: string[];
  cities: string[];
  types: string[];
  current: { status: string; city: string; type: string; q: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(current.q);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 items-center">
      <select
        value={current.status}
        onChange={(e) => updateParam("status", e.target.value)}
        className="rounded border border-neutral-300 text-sm px-2.5 py-1.5 bg-white"
      >
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={current.city}
        onChange={(e) => updateParam("city", e.target.value)}
        className="rounded border border-neutral-300 text-sm px-2.5 py-1.5 bg-white"
      >
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={current.type}
        onChange={(e) => updateParam("type", e.target.value)}
        className="rounded border border-neutral-300 text-sm px-2.5 py-1.5 bg-white"
      >
        <option value="">All business types</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("q", q);
        }}
        className="flex-1 min-w-[180px]"
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search business, contact, or email..."
          className="w-full rounded border border-neutral-300 text-sm px-3 py-1.5"
        />
      </form>

      {(current.status || current.city || current.type || current.q) && (
        <button
          onClick={() => router.push(pathname)}
          className="text-xs text-neutral-500 underline underline-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
