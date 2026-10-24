import { cn } from "@/lib/utils";
import {
  PAY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  type PaymentStatus,
  type RequestStatus,
} from "@/lib/status";

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_TONE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PayBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        PAY_TONE[status],
      )}
    >
      {status}
    </span>
  );
}
