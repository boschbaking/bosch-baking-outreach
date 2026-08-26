import type { ProspectStatus } from "@/lib/types";

// Every status maps to a Tailwind class string used by <StatusBadge>. Kept in
// one place so the palette can be tuned without hunting through components.
export const STATUS_COLORS: Record<ProspectStatus, string> = {
  New: "bg-slate-100 text-slate-700 border-slate-300",
  Researching: "bg-blue-50 text-blue-700 border-blue-200",
  "Ready to Contact": "bg-sky-50 text-sky-700 border-sky-200",
  Drafted: "bg-amber-50 text-amber-800 border-amber-200",
  Approved: "bg-[#f4ecd8] text-[#7a5f22] border-[#dfc383]",
  Contacted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Replied: "bg-purple-50 text-purple-700 border-purple-200",
  Interested: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Sample Requested": "bg-teal-50 text-teal-700 border-teal-200",
  "Sample Dropped": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Follow Up Later": "bg-orange-50 text-orange-700 border-orange-200",
  "Not Interested": "bg-rose-50 text-rose-600 border-rose-200",
  "Wrong Contact": "bg-neutral-100 text-neutral-600 border-neutral-300",
  Customer: "bg-green-100 text-green-800 border-green-300",
  "Do Not Contact": "bg-red-100 text-red-800 border-red-300",
};
