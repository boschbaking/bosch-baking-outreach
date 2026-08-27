import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ImportRow {
  business_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  business_type?: string;
  website?: string;
  research_notes?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows, tag_city, tag_business_type, tag_campaign_id } = (await request.json()) as {
    rows: ImportRow[];
    tag_city?: string;
    tag_business_type?: string;
    tag_campaign_id?: string;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  }

  const batchId = randomUUID();

  const [{ data: existingProspects }, { data: suppressed }] = await Promise.all([
    supabase.from("prospects").select("id, email"),
    supabase.from("suppression_list").select("type, value"),
  ]);

  const existingByEmail = new Map(
    (existingProspects ?? [])
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase(), p.id])
  );
  const suppressedEmails = new Set(
    (suppressed ?? []).filter((s) => s.type === "email").map((s) => s.value.toLowerCase())
  );
  const suppressedDomains = new Set(
    (suppressed ?? []).filter((s) => s.type === "domain").map((s) => s.value.toLowerCase())
  );

  const seenInBatch = new Set<string>();
  const toInsert: Record<string, unknown>[] = [];
  const report = { inserted: 0, duplicates: 0, suppressed: 0, invalid_email: 0, missing_name: 0 };

  for (const row of rows) {
    const businessName = row.business_name?.trim();
    if (!businessName) {
      report.missing_name++;
      continue;
    }

    const email = row.email?.trim().toLowerCase() || null;

    if (email) {
      if (!EMAIL_RE.test(email)) {
        report.invalid_email++;
        continue;
      }
      const domain = email.split("@")[1];
      if (suppressedEmails.has(email) || suppressedDomains.has(domain)) {
        report.suppressed++;
        continue;
      }
      if (existingByEmail.has(email) || seenInBatch.has(email)) {
        report.duplicates++;
        continue;
      }
      seenInBatch.add(email);
    }

    toInsert.push({
      business_name: businessName,
      contact_name: row.contact_name?.trim() || null,
      email,
      phone: row.phone?.trim() || null,
      city: tag_city || row.city?.trim() || null,
      state: row.state?.trim() || null,
      business_type: tag_business_type || row.business_type?.trim() || null,
      website: row.website?.trim() || null,
      research_notes: row.research_notes?.trim() || null,
      status: "New",
      source: "csv_import",
      import_batch_id: batchId,
      campaign_id: tag_campaign_id || null,
      created_by: user.id,
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("prospects").insert(toInsert);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    report.inserted = toInsert.length;
  }

  await supabase.from("activity_log").insert({
    actor_id: user.id,
    action: "csv_import",
    details: { batch_id: batchId, ...report },
  });

  return NextResponse.json({ report, batch_id: batchId });
}
