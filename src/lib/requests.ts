import { toast } from "sonner";

export const MAX_REQUEST_FILES = 10;
export const MAX_REQUEST_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_REQUEST_UPLOAD_BYTES = 50 * 1024 * 1024;
export const SERVICES_WITHOUT_UPLOADS = new Set(["Assignment Typing", "Practicum Typing"]);
const DOCUMENT_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
};

export function validateUploadFiles(files: File[]) {
  if (files.length > MAX_REQUEST_FILES) return "Choose no more than 10 files.";
  if (files.some((file) => file.size === 0 || file.size > MAX_REQUEST_FILE_BYTES)) {
    return "Each file must be non-empty and no larger than 20 MB.";
  }
  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const expectedMimeType = DOCUMENT_MIME_TYPES[extension];
    const mimeType = file.type.toLowerCase();
    if (!expectedMimeType)
      return "Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, and TXT.";
    if (
      mimeType &&
      mimeType !== expectedMimeType &&
      mimeType !== "application/octet-stream" &&
      !(mimeType === "application/zip" && ["docx", "xlsx", "pptx"].includes(extension))
    ) {
      return `The file type does not match ${file.name}.`;
    }
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_REQUEST_UPLOAD_BYTES) {
    return "The combined upload must be no larger than 50 MB.";
  }
  return null;
}

export async function openFile(path: string) {
  const toastId = toast.loading("Preparing download…");
  try {
    const response = await fetch(`/api/files?key=${encodeURIComponent(path)}`, {
      credentials: "same-origin",
    });
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
  const validationError = validateUploadFiles(files);
  if (validationError) {
    toast.error(validationError);
    return false;
  }
  const form = new FormData();
  form.set("request_id", requestId);
  form.set("kind", kind);
  files.forEach((file) => form.append("files", file));
  let response: Response;
  try {
    response = await fetch("/api/files", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
  } catch {
    toast.error("File upload failed. Check your connection and try again.");
    return false;
  }
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
