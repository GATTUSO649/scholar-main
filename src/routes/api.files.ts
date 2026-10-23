import { createFileRoute } from "@tanstack/react-router";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getAuthorizedFile,
  authorizedUploadTarget,
  addRequestFile,
  completeRequestDelivery,
  deleteRequestFile,
} from "@/lib/backend.server";
import { requireSameOrigin } from "@/lib/backend";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_REQUEST_BYTES = 50 * 1024 * 1024;

function storagePath(key: string) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");
  return path.join(
    process.env["FILE_STORAGE_DIR"] ?? path.join(process.cwd(), "data", "uploads"),
    key.slice(0, 2),
    key,
  );
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "File operation failed.";
  const status = message.includes("signed in")
    ? 401
    : message.includes("Administrator access") || message.includes("cannot upload")
      ? 403
      : message.includes("not found")
        ? 404
        : message.includes("allowed") || message.includes("file") || message.includes("upload")
          ? 400
          : 500;
  if (status === 500) console.error("File operation failed", error);
  return Response.json({ error: status === 500 ? "File operation failed." : message }, { status });
}

export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const length = Number(request.headers.get("content-length") ?? 0);
          if (length > MAX_REQUEST_BYTES)
            return Response.json(
              { error: "Files exceed the 50 MB upload limit." },
              { status: 413 },
            );
          const form = await request.formData();
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
              const destination = storagePath(storageKey);
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
          } catch (error) {
            await Promise.all(
              uploaded.flatMap((key) => [
                rm(storagePath(key), { force: true }),
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
          const content = await readFile(storagePath(file.storageKey));
          const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
          return new Response(content, {
            headers: {
              "content-type": file.mimeType,
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
