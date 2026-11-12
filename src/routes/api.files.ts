import { File as NodeFile } from "node:buffer";
import { createFileRoute } from "@tanstack/react-router";
import {
  getAuthorizedFile,
  authorizedUploadTarget,
  addRequestFile,
  completeRequestDelivery,
  deleteRequestFile,
  getDatabaseErrorCode,
  notifyAdminsOfStudentUpload,
} from "@/lib/backend.server";
import {
  deletePrivateFile,
  getConfiguredFileLimit,
  PrivateFileStorageError,
  readPrivateFile,
  writePrivateFile,
} from "@/lib/file-storage.server";
import { validateDocumentFile } from "@/lib/file-signature.server";
import { requireSameOrigin } from "@/lib/backend";
import {
  InvalidUploadBodyError,
  parseMultipartFormData,
  UploadBodyTooLargeError,
} from "@/lib/form-data.server";

const MAX_FILE_BYTES = getConfiguredFileLimit("REQUEST_MAX_FILE_BYTES", 20 * 1024 * 1024);
const MAX_REQUEST_BYTES = getConfiguredFileLimit("REQUEST_MAX_TOTAL_BYTES", 50 * 1024 * 1024);
const RETRYABLE_DATABASE_CONNECTION_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "08000",
  "08003",
  "08006",
  "08001",
  "57P01",
]);

async function retryTransientDatabaseOperation<T>(stage: string, operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    const code = getDatabaseErrorCode(error);
    if (!code || !RETRYABLE_DATABASE_CONNECTION_CODES.has(code)) throw error;
    console.warn("Retrying file operation after a transient database connection error.", {
      stage,
      code,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    return operation();
  }
}

function errorResponse(error: unknown, stage: string) {
  const message = error instanceof Error ? error.message : "File operation failed.";
  const missingStorageFile = error instanceof Error && "code" in error && error.code === "ENOENT";
  const storageError = error instanceof PrivateFileStorageError ? error : null;
  const missingStorageObject =
    [400, 404].includes(storageError?.httpStatus ?? 0) &&
    ["NoSuchKey", "ObjectNotFound"].includes(storageError.storageCode ?? "");
  let status: number;
  if (storageError) status = missingStorageObject ? 404 : 503;
  else if (missingStorageFile) status = 404;
  else if (error instanceof UploadBodyTooLargeError) status = 413;
  else if (error instanceof InvalidUploadBodyError) status = 400;
  else if (message.includes("Supabase Storage")) status = 503;
  else if (message.includes("signed in")) status = 401;
  else if (message.includes("Administrator access") || message.includes("cannot upload")) {
    status = 403;
  } else if (message.includes("not found")) status = 404;
  else if (message.includes("allowed") || message.includes("file") || message.includes("upload")) {
    status = 400;
  } else status = 500;
  if (storageError) {
    console.error("Private file storage operation failed.", {
      stage,
      originalMessage: storageError.originalMessage,
      errorName: storageError.sourceErrorName,
      code: storageError.code ?? null,
      storageCode: storageError.storageCode ?? null,
      httpStatus: storageError.httpStatus ?? null,
      operation: storageError.operation,
      destinationHostname: storageError.destinationHostname ?? null,
      durationMs: storageError.durationMs ?? null,
      retryAttempt: storageError.retryAttempt ?? null,
    });
  } else if (status === 500) {
    console.error("File operation failed.", {
      stage,
      code: getDatabaseErrorCode(error),
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
  const responseMessage = storageError
    ? status === 404
      ? "File is unavailable. Please contact support to have it restored."
      : "File storage is temporarily unavailable. Please try again later."
    : missingStorageFile
      ? "File is unavailable. Please contact support to have it restored."
      : message;
  return Response.json({ error: responseMessage }, { status });
}

export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let stage = "origin validation";
        try {
          requireSameOrigin(request);
          stage = "multipart parsing";
          const form = await parseMultipartFormData(request, MAX_REQUEST_BYTES);
          stage = "request validation";
          const requestId = String(form.get("request_id") ?? "");
          const kind = String(form.get("kind") ?? "");
          if (
            !/^[0-9a-f-]{36}$/i.test(requestId) ||
            (kind !== "submission" && kind !== "delivery")
          ) {
            return Response.json({ error: "Invalid upload request." }, { status: 400 });
          }
          stage = "request authorization";
          const { userId } = await retryTransientDatabaseOperation(stage, () =>
            authorizedUploadTarget(requestId, kind),
          );
          stage = "upload validation";
          const files = form
            .getAll("files")
            .filter((entry): entry is File => entry instanceof NodeFile);
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

          const preparedFiles = await Promise.all(
            files.map(async (file) => {
              const content = Buffer.from(await file.arrayBuffer());
              const validation = validateDocumentFile(file.name, file.type, content);
              return { file, content, validation };
            }),
          );
          const invalidFile = preparedFiles.find(({ validation }) => "error" in validation);
          if (invalidFile && "error" in invalidFile.validation) {
            return Response.json({ error: invalidFile.validation.error }, { status: 400 });
          }

          const uploaded: string[] = [];
          try {
            for (const { file, content, validation } of preparedFiles) {
              if (!("mimeType" in validation) || typeof validation.mimeType !== "string") {
                throw new Error("Document validation failed.");
              }
              const storageKey = crypto.randomUUID();
              const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 255) || "file";
              stage = "private storage write";
              await writePrivateFile(storageKey, content, "requests", validation.mimeType, true);
              uploaded.push(storageKey);
              stage = "file metadata insert";
              await retryTransientDatabaseOperation(stage, () =>
                addRequestFile({
                  requestId,
                  uploadedBy: userId,
                  storageKey,
                  name: safeName,
                  mimeType: validation.mimeType,
                  size: file.size,
                  kind,
                }),
              );
            }
            if (kind === "delivery") {
              stage = "delivery finalization";
              await completeRequestDelivery(requestId);
            } else {
              stage = "student upload notification";
              try {
                await notifyAdminsOfStudentUpload(requestId);
              } catch (error) {
                console.warn("Student file upload saved, but admin notification failed.", {
                  code: getDatabaseErrorCode(error),
                  errorName: error instanceof Error ? error.name : "unknown",
                });
              }
            }
          } catch (error) {
            const cleanupResults = await Promise.allSettled(
              uploaded.flatMap((key) => [deletePrivateFile(key), deleteRequestFile(key)]),
            );
            const cleanupFailures = cleanupResults.flatMap((result) =>
              result.status === "rejected"
                ? [
                    getDatabaseErrorCode(result.reason) ??
                      (result.reason instanceof Error ? result.reason.name : "unknown"),
                  ]
                : [],
            );
            if (cleanupFailures.length) {
              console.error("File upload cleanup was incomplete.", { stage, cleanupFailures });
            }
            throw error;
          }
          return Response.json({ uploaded: uploaded.length }, { status: 201 });
        } catch (error) {
          return errorResponse(error, stage);
        }
      },
      GET: async ({ request }) => {
        let stage = "request authorization";
        try {
          const key = new URL(request.url).searchParams.get("key") ?? "";
          const file = await retryTransientDatabaseOperation(stage, () => getAuthorizedFile(key));
          if (!file) return Response.json({ error: "File not found." }, { status: 404 });
          stage = "private storage read";
          const content = await readPrivateFile(file.storageKey);
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
          return errorResponse(error, stage);
        }
      },
    },
  },
});
