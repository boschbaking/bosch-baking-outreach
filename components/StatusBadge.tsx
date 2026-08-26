import { STATUS_COLORS } from "@/lib/status-colors";
import type { ProspectStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span className={`status-badge border ${STATUS_COLORS[status]}`}>{status}</span>
  );
}
