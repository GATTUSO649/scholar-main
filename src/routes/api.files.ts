import { createFileRoute } from "@tanstack/react-router";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getAuthorizedFile,
  authorizedUploadTarget,
  addRequestFile,
  completeRequestDelivery,
  deleteRequestFile,
  getDatabaseErrorCode,
  notifyAdminsOfStudentUpload,
} from "@/lib/backend.server";
import { getPrivateFilePath } from "@/lib/file-storage.server";
import { requireSameOrigin } from "@/lib/backend";
import {
  InvalidUploadBodyError,
  parseMultipartFormData,
  UploadBodyTooLargeError,
} from "@/lib/form-data.server";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_REQUEST_BYTES = 50 * 1024 * 1024;

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "File operation failed.";
  const missingStorageFile = error instanceof Error && "code" in error && error.code === "ENOENT";
  let status: number;
  if (missingStorageFile) status = 404;
  else if (error instanceof UploadBodyTooLargeError) status = 413;
  else if (error instanceof InvalidUploadBodyError) status = 400;
  else if (message.includes("signed in")) status = 401;
  else if (message.includes("Administrator access") || message.includes("cannot upload")) {
    status = 403;
  } else if (message.includes("not found")) status = 404;
  else if (message.includes("allowed") || message.includes("file") || message.includes("upload")) {
    status = 400;
  } else status = 500;
  if (status === 500) {
    console.error(
      "File operation failed.",
      getDatabaseErrorCode(error) ?? (error instanceof Error ? error.name : "unknown error"),
    );
  }
  const responseMessage = missingStorageFile
    ? "File is unavailable. Please contact support to have it restored."
    : status === 500
      ? "File operation failed."
      : message;
  return Response.json({ error: responseMessage }, { status });
}

export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const form = await parseMultipartFormData(request, MAX_REQUEST_BYTES);
          const requestId = String(form.get("request_id") ?? "");
          const kind = String(form.get("kind") ?? "");
          if (
            !/^[0-9a-f-]{36}$/i.test(requestId) ||
            (kind !== "submission" && kind !== "delivery")
          ) {
            return Response.json({ error: "Invalid upload request." }, { status: 400 });
          }
          const { userId } = await authorizedUploadTarget(requestId, kind);
          const files = form
            .getAll("files")
            .filter((entry): entry is File => entry instanceof File);
          if (!files.length || files.length > 10) {
            return Response.json({ error: "Choose between 1 and 10 files." }, { status: 400 });
          }
          if (
            files.some((file) => file.size === 0 || file.size > MAX_FILE_BYTES) ||
            files.reduce((total, file) => total + file.size, 0) > MAX_REQUEST_BYTES
          ) {
            return Response.json(
              { error: "Each file must be under 20 MB and the total upload under 50 MB." },
              { status: 413 },
            );
          }

          const uploaded: string[] = [];
          try {
            for (const file of files) {
              const storageKey = crypto.randomUUID();
              const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 255) || "file";
              const destination = getPrivateFilePath(storageKey);
              await mkdir(path.dirname(destination), { recursive: true });
              await writeFile(destination, Buffer.from(await file.arrayBuffer()), {
                flag: "wx",
                mode: 0o600,
              });
              uploaded.push(storageKey);
              await addRequestFile({
                requestId,
                uploadedBy: userId,
                storageKey,
                name: safeName,
                mimeType: file.type.slice(0, 120) || "application/octet-stream",
                size: file.size,
                kind,
              });
            }
            if (kind === "delivery") await completeRequestDelivery(requestId);
            else await notifyAdminsOfStudentUpload(requestId);
          } catch (error) {
            await Promise.all(
              uploaded.flatMap((key) => [
                rm(getPrivateFilePath(key), { force: true }),
                deleteRequestFile(key),
              ]),
            );
            throw error;
          }
          return Response.json({ uploaded: uploaded.length }, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
      GET: async ({ request }) => {
        try {
          const key = new URL(request.url).searchParams.get("key") ?? "";
          const file = await getAuthorizedFile(key);
          if (!file) return Response.json({ error: "File not found." }, { status: 404 });
          const content = await readFile(getPrivateFilePath(file.storageKey));
          const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
          return new Response(content, {
            headers: {
              "content-type": "application/octet-stream",
              "content-length": String(content.byteLength),
              "content-disposition": `attachment; filename="${asciiName}"`,
              "cache-control": "private, no-store",
              "x-content-type-options": "nosniff",
            },
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
