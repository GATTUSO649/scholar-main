import { createFileRoute } from "@tanstack/react-router";
import path from "node:path";
import {
  createLibraryResources,
  deleteLibraryResource,
  getLibraryResourceForDownload,
  requireLibraryAdmin,
  replaceLibraryResourceFile,
  updateLibraryResource,
  getDatabaseErrorCode,
} from "@/lib/backend.server";
import { getDocumentMimeType, validateDocumentFile } from "@/lib/file-signature.server";
import {
  deletePrivateFile,
  getConfiguredFileLimit,
  PrivateFileStorageError,
  readPrivateFile,
  writePrivateFile,
} from "@/lib/file-storage.server";
import { requireSameOrigin } from "@/lib/backend";
import {
  InvalidUploadBodyError,
  InvalidRequestBodyError,
  RequestBodyTooLargeError,
  parseMultipartFormData,
  parseJsonRequestBody,
  UploadBodyTooLargeError,
} from "@/lib/form-data.server";

const MAX_FILE_BYTES = getConfiguredFileLimit("DOCUMENT_MAX_FILE_BYTES", 25 * 1024 * 1024);
const MAX_REQUEST_BYTES = getConfiguredFileLimit("DOCUMENT_MAX_TOTAL_BYTES", 50 * 1024 * 1024);
const MAX_FILES = 10;
const CATEGORIES = new Set(["novel", "business_plan", "article"]);
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

function isCategory(value: string): value is "novel" | "business_plan" | "article" {
  return CATEGORIES.has(value);
}

function sanitizeFileName(name: string) {
  return (
    Array.from(name, (character) => {
      const code = character.charCodeAt(0);
      return character === "/" || character === "\\" || code < 32 || code === 127 ? "_" : character;
    })
      .join("")
      .slice(0, 255) || "document"
  );
}

function isFileLike(value: unknown): value is File & { arrayBuffer: () => Promise<ArrayBuffer> } {
  return (
    !!value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "size" in value &&
    typeof value.size === "number" &&
    "type" in value &&
    typeof value.type === "string"
  );
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Library operation failed.";
  const storageError = error instanceof PrivateFileStorageError ? error : null;
  const missingStorageObject =
    storageError?.httpStatus === 404 &&
    ["NoSuchKey", "ObjectNotFound"].includes(storageError.storageCode ?? "");
  const databaseErrorCode = getDatabaseErrorCode(error);
  const transientDatabaseFailure =
    databaseErrorCode !== undefined && RETRYABLE_DATABASE_CONNECTION_CODES.has(databaseErrorCode);
  const status =
    error instanceof UploadBodyTooLargeError || error instanceof RequestBodyTooLargeError
      ? 413
      : error instanceof InvalidUploadBodyError || error instanceof InvalidRequestBodyError
        ? 400
        : storageError
          ? missingStorageObject
            ? 404
            : 503
          : transientDatabaseFailure
            ? 503
            : message.includes("signed in")
              ? 401
              : message.includes("Purchase this resource") ||
                  message.includes("Student library access")
                ? 403
                : message.includes("origin is not allowed")
                  ? 403
                  : message.includes("Administrator access")
                    ? 403
                    : message.includes("not found")
                      ? 404
                      : message.includes("payments are not configured")
                        ? 503
                        : message === "Invalid file key."
                          ? 400
                          : 500;
  if (storageError) {
    console.error("Library storage operation failed.", {
      operation: storageError.operation,
      errorName: storageError.sourceErrorName,
      code: storageError.code ?? null,
      storageCode: storageError.storageCode ?? null,
      httpStatus: storageError.httpStatus ?? null,
      destinationHostname: storageError.destinationHostname ?? null,
      durationMs: storageError.durationMs ?? null,
      retryAttempt: storageError.retryAttempt ?? null,
    });
  } else if (status === 500 || transientDatabaseFailure) {
    console.error(
      transientDatabaseFailure
        ? "Temporary library database failure."
        : "Library operation failed.",
      {
        code: databaseErrorCode ?? null,
        errorName: error instanceof Error ? error.name : "unknown error",
      },
    );
  }
  const responseError =
    storageError && status === 503
      ? "Library storage is temporarily unavailable. Please try again."
      : transientDatabaseFailure
        ? "Library services are temporarily unavailable. Please try again."
        : status === 500
          ? "Library operation failed."
          : message;
  return Response.json({ error: responseError }, { status });
}

export const Route = createFileRoute("/api/library")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const storedKeys: string[] = [];
        try {
          requireSameOrigin(request);
          await requireLibraryAdmin();
          const form = await parseMultipartFormData(
            request,
            MAX_REQUEST_BYTES + MAX_FILES * 64 * 1024,
          );
          const titlePrefix = String(form.get("title") ?? "").trim();
          const description = String(form.get("description") ?? "").trim();
          const category = String(form.get("category") ?? "");
          const price = Number(form.get("price") ?? 0);
          if (description.length > 2000) {
            return Response.json(
              { error: "Description must be 2,000 characters or fewer." },
              { status: 400 },
            );
          }
          if (!isCategory(category)) {
            return Response.json({ error: "Choose a valid resource category." }, { status: 400 });
          }
          if (!Number.isInteger(price) || price < 0 || price > 150000) {
            return Response.json(
              { error: "Price must be a whole KES amount between 0 and 150,000." },
              { status: 400 },
            );
          }
          const files = form.getAll("files").filter(isFileLike);
          if (!files.length) {
            const legacyFile = form.get("file");
            if (isFileLike(legacyFile)) files.push(legacyFile);
          }
          if (!files.length || files.length > MAX_FILES) {
            return Response.json(
              { error: `Choose between 1 and ${MAX_FILES} documents.` },
              { status: 400 },
            );
          }
          if (
            files.some((file) => file.size === 0 || file.size > MAX_FILE_BYTES) ||
            files.reduce((total, file) => total + file.size, 0) > MAX_REQUEST_BYTES
          ) {
            return Response.json(
              {
                error: `Each document must be non-empty and no larger than ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))} MB; the total upload limit is ${Math.floor(MAX_REQUEST_BYTES / (1024 * 1024))} MB.`,
              },
              { status: 413 },
            );
          }

          const documents: Array<{
            title: string;
            description: string;
            category: "novel" | "business_plan" | "article";
            price: number;
            storageKey: string;
            name: string;
            mimeType: string;
            size: number;
            content: Buffer;
          }> = [];
          for (const file of files) {
            const content = Buffer.from(await file.arrayBuffer());
            const validation = validateDocumentFile(file.name, file.type, content);
            if ("error" in validation) {
              return Response.json({ error: validation.error }, { status: 400 });
            }
            const originalName = sanitizeFileName(file.name);
            const filenameTitle = path.parse(originalName).name.trim() || "Document";
            const title =
              files.length === 1
                ? titlePrefix || filenameTitle
                : titlePrefix
                  ? `${titlePrefix} - ${filenameTitle}`
                  : filenameTitle;
            if (title.length < 2 || title.length > 200) {
              return Response.json(
                { error: "Document titles must be between 2 and 200 characters." },
                { status: 400 },
              );
            }
            documents.push({
              title,
              description,
              category,
              price,
              storageKey: crypto.randomUUID(),
              name: originalName,
              mimeType: validation.mimeType,
              size: file.size,
              content,
            });
          }

          try {
            for (const document of documents) {
              storedKeys.push(document.storageKey);
              await writePrivateFile(
                document.storageKey,
                document.content,
                "library",
                document.mimeType,
                true,
              );
            }
            await createLibraryResources(
              documents.map(({ content: _content, ...metadata }) => metadata),
            );
          } catch (error) {
            await Promise.allSettled(storedKeys.map((key) => deletePrivateFile(key, "library")));
            throw error;
          }
          return Response.json({ success: true, uploaded: documents.length }, { status: 201 });
        } catch (error) {
          return errorResponse(error);
        }
      },
      PUT: async ({ request }) => {
        let newStorageKey: string | undefined;
        try {
          requireSameOrigin(request);
          await requireLibraryAdmin();
          const form = await parseMultipartFormData(request, MAX_FILE_BYTES + 64 * 1024);
          const id = String(form.get("id") ?? "");
          const file = form.get("file");
          if (!isFileLike(file) || file.size === 0 || file.size > MAX_FILE_BYTES) {
            return Response.json(
              { error: "Choose a non-empty document within the file-size limit." },
              { status: 413 },
            );
          }
          const content = Buffer.from(await file.arrayBuffer());
          const validation = validateDocumentFile(file.name, file.type, content);
          if ("error" in validation)
            return Response.json({ error: validation.error }, { status: 400 });
          const originalName = sanitizeFileName(file.name);
          newStorageKey = crypto.randomUUID();
          await writePrivateFile(newStorageKey, content, "library");
          const result = await replaceLibraryResourceFile(id, {
            storageKey: newStorageKey,
            name: originalName,
            mimeType: validation.mimeType,
            size: file.size,
          });
          if (!result) {
            await deletePrivateFile(newStorageKey, "library");
            return Response.json({ error: "Resource not found." }, { status: 404 });
          }
          await deletePrivateFile(result.previousStorageKey, "library").catch((error: unknown) =>
            console.error("Replaced library file cleanup failed.", {
              code: getDatabaseErrorCode(error),
              errorName: error instanceof Error ? error.name : "unknown",
            }),
          );
          return Response.json({ success: true });
        } catch (error) {
          if (newStorageKey) await deletePrivateFile(newStorageKey, "library").catch(() => {});
          return errorResponse(error);
        }
      },
      DELETE: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const id = new URL(request.url).searchParams.get("id") ?? "";
          const resource = await deleteLibraryResource(id);
          if (!resource) return Response.json({ error: "Resource not found." }, { status: 404 });
          await deletePrivateFile(resource.storageKey, "library");
          return Response.json({ success: true });
        } catch (error) {
          return errorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const body = (await parseJsonRequestBody(request, 16 * 1024)) as Record<
            string,
            unknown
          > | null;
          const id = typeof body?.["id"] === "string" ? body["id"] : "";
          const title = typeof body?.["title"] === "string" ? body["title"].trim() : "";
          const description =
            typeof body?.["description"] === "string" ? body["description"].trim() : "";
          const category = typeof body?.["category"] === "string" ? body["category"] : "";
          const price = typeof body?.["price"] === "number" ? body["price"] : Number.NaN;
          if (title.length < 2 || title.length > 200) {
            return Response.json(
              { error: "Title must be between 2 and 200 characters." },
              { status: 400 },
            );
          }
          if (description.length > 2000) {
            return Response.json(
              { error: "Description must be 2,000 characters or fewer." },
              { status: 400 },
            );
          }
          if (!isCategory(category)) {
            return Response.json({ error: "Choose a valid resource category." }, { status: 400 });
          }
          if (!Number.isInteger(price) || price < 0 || price > 150000) {
            return Response.json(
              { error: "Price must be a whole KES amount between 0 and 150,000." },
              { status: 400 },
            );
          }
          const result = await updateLibraryResource(id, { title, description, category, price });
          if (!result) return Response.json({ error: "Resource not found." }, { status: 404 });
          return Response.json(result);
        } catch (error) {
          return errorResponse(error);
        }
      },
      GET: async ({ request }) => {
        try {
          const id = new URL(request.url).searchParams.get("id") ?? "";
          const resource = await getLibraryResourceForDownload(id);
          if (!resource) return Response.json({ error: "Resource not found." }, { status: 404 });
          const content = await readPrivateFile(resource.storageKey, "library");
          const asciiName = resource.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
          const preview =
            new URL(request.url).searchParams.get("preview") === "1" &&
            resource.mimeType === "application/pdf";
          return new Response(content, {
            headers: {
              "content-type":
                resource.mimeType ||
                getDocumentMimeType(path.extname(resource.name)) ||
                "application/octet-stream",
              "content-length": String(content.byteLength),
              "content-disposition": `${preview ? "inline" : "attachment"}; filename="${asciiName}"`,
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
