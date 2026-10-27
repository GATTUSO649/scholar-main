import { createFileRoute } from "@tanstack/react-router";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createLibraryResource,
  deleteLibraryResource,
  getLibraryResourceForDownload,
  requireLibraryAdmin,
  updateLibraryResource,
} from "@/lib/backend.server";
import { requireSameOrigin } from "@/lib/backend";
import {
  InvalidUploadBodyError,
  parseMultipartFormData,
  UploadBodyTooLargeError,
} from "@/lib/form-data.server";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".pdf", ".epub", ".doc", ".docx", ".txt"]);
const CATEGORIES = new Set(["novel", "business_plan", "article"]);

function isCategory(value: string): value is "novel" | "business_plan" | "article" {
  return CATEGORIES.has(value);
}

function storagePath(key: string) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");
  return path.join(
    process.env["FILE_STORAGE_DIR"] ?? path.join(process.cwd(), "data", "uploads"),
    "library",
    key.slice(0, 2),
    key,
  );
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Library operation failed.";
  const status =
    error instanceof UploadBodyTooLargeError
      ? 413
      : error instanceof InvalidUploadBodyError
        ? 400
        : message.includes("signed in")
          ? 401
          : message.includes("Purchase this resource") || message.includes("Student library access")
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
  if (status === 500) console.error("Library operation failed", error);
  return Response.json(
    { error: status === 500 ? "Library operation failed." : message },
    { status },
  );
}

export const Route = createFileRoute("/api/library")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let destination: string | undefined;
        try {
          requireSameOrigin(request);
          await requireLibraryAdmin();
          const form = await parseMultipartFormData(request, MAX_FILE_BYTES + 64 * 1024);
          const title = String(form.get("title") ?? "").trim();
          const description = String(form.get("description") ?? "").trim();
          const category = String(form.get("category") ?? "");
          const price = Number(form.get("price") ?? 0);
          const file = form.get("file");
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
          if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES) {
            return Response.json({ error: "Choose a file up to 25 MB." }, { status: 413 });
          }
          const extension = path.extname(file.name).toLowerCase();
          if (!ALLOWED_EXTENSIONS.has(extension)) {
            return Response.json(
              { error: "Only PDF, EPUB, Word, and plain-text files are supported." },
              { status: 400 },
            );
          }

          const storageKey = crypto.randomUUID();
          const safeName = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 255) || "download";
          destination = storagePath(storageKey);
          await mkdir(path.dirname(destination), { recursive: true });
          await writeFile(destination, Buffer.from(await file.arrayBuffer()), {
            flag: "wx",
            mode: 0o600,
          });
          await createLibraryResource({
            title,
            description,
            category,
            price,
            storageKey,
            name: safeName,
            size: file.size,
          });
          return Response.json({ success: true }, { status: 201 });
        } catch (error) {
          if (destination) await rm(destination, { force: true });
          return errorResponse(error);
        }
      },
      DELETE: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const id = new URL(request.url).searchParams.get("id") ?? "";
          if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return Response.json({ error: "Invalid resource." }, { status: 400 });
          }
          const resource = await deleteLibraryResource(id);
          if (!resource) return Response.json({ error: "Resource not found." }, { status: 404 });
          await rm(storagePath(resource.storageKey), { force: true });
          return Response.json({ success: true });
        } catch (error) {
          return errorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
          const id = typeof body?.["id"] === "string" ? body["id"] : "";
          const title = typeof body?.["title"] === "string" ? body["title"].trim() : "";
          const description =
            typeof body?.["description"] === "string" ? body["description"].trim() : "";
          const category = typeof body?.["category"] === "string" ? body["category"] : "";
          const price = typeof body?.["price"] === "number" ? body["price"] : Number.NaN;
          if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return Response.json({ error: "Invalid resource." }, { status: 400 });
          }
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
          if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return Response.json({ error: "Resource not found." }, { status: 404 });
          }
          const resource = await getLibraryResourceForDownload(id);
          if (!resource) return Response.json({ error: "Resource not found." }, { status: 404 });
          const content = await readFile(storagePath(resource.storageKey));
          const asciiName = resource.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
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
