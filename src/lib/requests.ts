import { toast } from "sonner";

export async function openFile(path: string) {
  const link = document.createElement("a");
  link.href = `/api/files?key=${encodeURIComponent(path)}`;
  link.rel = "noopener";
  link.target = "_blank";
  link.click();
}

export async function uploadFiles(
  requestId: string,
  files: File[],
  kind: "submission" | "delivery",
) {
  if (!files.length) return true;
  const form = new FormData();
  form.set("request_id", requestId);
  form.set("kind", kind);
  files.forEach((file) => form.append("files", file));
  const response = await fetch("/api/files", { method: "POST", body: form });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    toast.error(result?.error ?? "File upload failed");
    return false;
  }
  return true;
}

export const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "—";

export const money = (n?: number | null, c = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(Number(n));
