export type ProspectStatus =
  | "New"
  | "Researching"
  | "Ready to Contact"
  | "Drafted"
  | "Approved"
  | "Contacted"
  | "Replied"
  | "Interested"
  | "Sample Requested"
  | "Sample Dropped"
  | "Follow Up Later"
  | "Not Interested"
  | "Wrong Contact"
  | "Customer"
  | "Do Not Contact";

export const PROSPECT_STATUSES: ProspectStatus[] = [
  "New",
  "Researching",
  "Ready to Contact",
  "Drafted",
  "Approved",
  "Contacted",
  "Replied",
  "Interested",
  "Sample Requested",
  "Sample Dropped",
  "Follow Up Later",
  "Not Interested",
  "Wrong Contact",
  "Customer",
  "Do Not Contact",
];

export const PIPELINE_STAGES: ProspectStatus[] = [
  "New",
  "Ready to Contact",
  "Contacted",
  "Replied",
  "Interested",
  "Sample Requested",
  "Sample Dropped",
  "Customer",
];

export type CampaignType =
  | "new_prospect"
  | "lost_customer"
  | "dormant_customer"
  | "existing_upsell";

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  new_prospect: "New Prospect",
  lost_customer: "Lost Customer",
  dormant_customer: "Dormant Customer",
  existing_upsell: "Existing Customer Upsell",
};

export type DraftStatus = "draft" | "quality_checked" | "approved" | "rejected" | "sent";

export type CustomerRelationship =
  | "none"
  | "former_customer"
  | "dormant_customer"
  | "existing_customer";

export interface Prospect {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  business_type: string | null;
  website: string | null;
  prospect_score: number | null;
  likely_bread_needs: string[] | null;
  research_notes: string | null;
  why_emailing: string | null;
  last_email_sent_at: string | null;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  status: ProspectStatus;
  sample_status: string | null;
  sales_notes: string | null;
  do_not_contact: boolean;
  customer_relationship: CustomerRelationship;
  campaign_id: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailDraft {
  id: string;
  prospect_id: string;
  campaign_id: string | null;
  campaign_type: CampaignType;
  subject: string;
  body: string;
  generated_from: Record<string, unknown> | null;
  quality_score: number | null;
  quality_check: QualityCheckResult | null;
  status: DraftStatus;
  version: number;
  edited_body: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
}

export interface QualityCheckResult {
  score: number;
  passed: boolean;
  sounds_human: boolean;
  relevance: boolean;
  no_fake_personalization: boolean;
  length_ok: boolean;
  clear_cta: boolean;
  banned_phrases_found: string[];
  unsupported_claims: string[];
  ai_risk_flags: string[];
  why_it_passed: string;
  facts_used: string[];
}

export type EmailSendStatus = "scheduled" | "sent" | "failed" | "cancelled";

export interface EmailSend {
  id: string;
  email_draft_id: string;
  prospect_id: string;
  sequence_step: number;
  status: EmailSendStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  prospect_id: string;
  author_id: string | null;
  note: string;
  created_at: string;
}

export const BUSINESS_TYPES = [
  "Independent Restaurant",
  "Cafe",
  "Hotel",
  "Country Club",
  "Golf Course",
  "Hospital",
  "Senior Living",
  "College / University",
  "Casino",
  "Brewery with Kitchen",
  "Caterer",
  "Banquet / Event Venue",
  "Other Foodservice",
];

export const BREAD_CATEGORIES = [
  "Hamburger Buns",
  "Sandwich Bread",
  "Rolls",
  "Sourdough",
  "Brioche",
  "Ciabatta",
  "Rye",
  "Whole Wheat",
  "Bagels",
  "English Muffins",
  "Croissants",
  "Specialty Breads",
];
