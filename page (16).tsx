import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProspectDetailClient from "./ProspectDetailClient";
import type { EmailDraft, Note, Prospect } from "@/lib/types";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: prospect }, { data: notes }, { data: drafts }] = await Promise.all([
    supabase.from("prospects").select("*").eq("id", id).single<Prospect>(),
    supabase
      .from("notes")
      .select("*")
      .eq("prospect_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_drafts")
      .select("*")
      .eq("prospect_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!prospect) notFound();

  return (
    <ProspectDetailClient
      prospect={prospect}
      initialNotes={(notes ?? []) as Note[]}
      initialDrafts={(drafts ?? []) as EmailDraft[]}
    />
  );
}
