"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS_TYPES, BREAD_CATEGORIES } from "@/lib/types";

export default function NewProspectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    business_type: "",
    website: "",
    research_notes: "",
  });
  const [breadNeeds, setBreadNeeds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleBread(cat: string) {
    setBreadNeeds((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, likely_bread_needs: breadNeeds }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Something went wrong.");
      return;
    }
    router.push(`/prospects/${json.prospect.id}`);
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#001630]">Add a prospect</h1>
      <p className="text-sm text-neutral-500 mt-1">
        For one-off adds. Use CSV import for bulk lists.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Business name" required>
            <input
              required
              className="input"
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            />
          </Field>
          <Field label="Business type">
            <select
              className="input"
              value={form.business_type}
              onChange={(e) => setForm({ ...form, business_type: e.target.value })}
            >
              <option value="">Select...</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact name">
            <input
              className="input"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Website">
            <input
              className="input"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <Field label="City">
            <input
              className="input"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </Field>
          <Field label="State">
            <input
              className="input"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Likely bread needs">
          <div className="flex flex-wrap gap-2">
            {BREAD_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => toggleBread(cat)}
                className={`text-xs rounded-full px-3 py-1 border ${
                  breadNeeds.includes(cat)
                    ? "bg-[#001630] text-white border-[#001630]"
                    : "border-neutral-300 text-neutral-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Research notes (only confirmed facts — leave unknowns out)">
          <textarea
            className="input min-h-[100px]"
            value={form.research_notes}
            onChange={(e) => setForm({ ...form, research_notes: e.target.value })}
          />
        </Field>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-[#001630] text-white text-sm px-5 py-2.5 hover:bg-[#0a2e57] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save prospect"}
        </button>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 4px;
          border: 1px solid #d4d4d4;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: #c9a95a;
          box-shadow: 0 0 0 2px rgba(201, 169, 90, 0.25);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-600 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}
