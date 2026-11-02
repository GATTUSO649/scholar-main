import { toast } from "sonner";

export async function openFile(path: string) {
  const toastId = toast.loading("Preparing download…");
  try {
    const response = await fetch(`/api/files?key=${encodeURIComponent(path)}`);
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.dismiss(toastId);
      toast.error(result?.error ?? "File download failed.");
      return;
    }

    const fileName =
      response.headers.get("content-disposition")?.match(/filename="([^"]*)"/i)?.[1] ?? "download";
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    toast.dismiss(toastId);
  } catch {
    toast.dismiss(toastId);
    toast.error("File download failed. Check your connection and try again.");
  }
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

export const money = (n?: number | null, c = "KES") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-KE", { style: "currency", currency: c }).format(Number(n));
