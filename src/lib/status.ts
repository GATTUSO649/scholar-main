export type RequestStatus =
  | "submitted"
  | "under_review"
  | "quoted"
  | "awaiting_payment"
  | "in_progress"
  | "completed"
  | "cancelled";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  quoted: "Quoted",
  awaiting_payment: "Awaiting payment",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_ORDER: RequestStatus[] = [
  "submitted",
  "under_review",
  "quoted",
  "awaiting_payment",
  "in_progress",
  "completed",
];

export const STATUS_TONE: Record<RequestStatus, string> = {
  submitted: "bg-info/15 text-info",
  under_review: "bg-info/15 text-info",
  quoted: "bg-warning/25 text-warning-foreground",
  awaiting_payment: "bg-warning/25 text-warning-foreground",
  in_progress: "bg-accent/25 text-accent-foreground",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

export const PAY_TONE: Record<PaymentStatus, string> = {
  unpaid: "bg-muted text-muted-foreground",
  pending: "bg-warning/25 text-warning-foreground",
  paid: "bg-success/15 text-success",
  refunded: "bg-destructive/15 text-destructive",
};

export const ACTIVE: RequestStatus[] = [
  "submitted",
  "under_review",
  "quoted",
  "awaiting_payment",
  "in_progress",
];
