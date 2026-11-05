import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deletePrivateFile,
  getPrivateFilePath,
  migrateLegacyPrivateFiles,
  readPrivateFile,
  verifyPrivateStorageBucket,
  writePrivateFile,
} from "@/lib/file-storage.server";
import { validateDocumentFile } from "@/lib/file-signature.server";
import {
  MAX_REQUEST_FILE_BYTES,
  MAX_REQUEST_UPLOAD_BYTES,
  uploadFiles,
  validateUploadFiles,
} from "@/lib/requests";

const fileKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
const filesOfSize = (...sizes: number[]) =>
  sizes.map((size) => ({ size, name: "upload.pdf", type: "application/pdf" }) as File);

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(path.resolve(process.cwd(), "data", "uploads"), { recursive: true, force: true });
});

describe("private file storage", () => {
  it("resolves request and library files under the configured private upload root", () => {
    const root = path.resolve(process.cwd(), "private", "uploads");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FILE_STORAGE_DIR", root);

    expect(getPrivateFilePath(fileKey)).toBe(path.join(root, "1d", fileKey));
    expect(getPrivateFilePath(fileKey, "library")).toBe(path.join(root, "library", "1d", fileKey));
  });

  it("rejects invalid keys and requires Supabase Storage in production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(() => getPrivateFilePath("../private-file")).toThrow("Invalid file key.");

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FILE_STORAGE_DIR", "");
    await expect(writePrivateFile(fileKey, Buffer.from("document"))).rejects.toThrow(
      /Supabase Storage must be configured/,
    );
  });

  it("uploads, reads, and deletes private objects through the Supabase Storage API", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-role-key");
    vi.stubEnv("SUPABASE_STORAGE_BUCKET", "private-uploads");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("remote document", { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await writePrivateFile(fileKey, Buffer.from("upload bytes"), "library", "application/pdf");
    await expect(readPrivateFile(fileKey, "library")).resolves.toEqual(
      Buffer.from("remote document"),
    );
    await deletePrivateFile(fileKey, "library");

    const objectUrl =
      "https://project.supabase.co/storage/v1/object/private-uploads/library/1d/1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(objectUrl);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: {
        apikey: "server-only-service-role-key",
        authorization: "Bearer server-only-service-role-key",
        "content-type": "application/pdf",
        "x-upsert": "false",
      },
      body: Buffer.from("upload bytes"),
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(objectUrl);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://project.supabase.co/storage/v1/object/private-uploads",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
      prefixes: [`library/1d/${fileKey}`],
    });
  });

  it("requires the configured Supabase bucket to exist and remain private", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-role-key");
    vi.stubEnv("SUPABASE_STORAGE_BUCKET", "private-uploads");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "private-uploads", public: false }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyPrivateStorageBucket()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/storage/v1/bucket/private-uploads",
      expect.objectContaining({
        headers: {
          apikey: "server-only-service-role-key",
          authorization: "Bearer server-only-service-role-key",
        },
      }),
    );

    fetchMock.mockResolvedValueOnce(Response.json({ id: "private-uploads", public: true }));
    await expect(verifyPrivateStorageBucket()).rejects.toThrow(/must be private/);
  });

  it("migrates legacy request and library files without replacing existing objects", async () => {
    const legacyRoot = await mkdtemp(path.join(tmpdir(), "scholardesk-object-migration-"));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-service-role-key");
    vi.stubEnv("SUPABASE_STORAGE_BUCKET", "private-uploads");
    const requestPath = path.join(legacyRoot, "1d", fileKey);
    const libraryKey = "4f2a9b6c-1d2b-4d5f-b6d2-2f9f5d1f1122";
    const libraryPath = path.join(legacyRoot, "library", "4f", libraryKey);
    await mkdir(path.dirname(requestPath), { recursive: true });
    await mkdir(path.dirname(libraryPath), { recursive: true });
    await writeFile(requestPath, "already migrated");
    await writeFile(libraryPath, "library document");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(migrateLegacyPrivateFiles(legacyRoot)).resolves.toMatchObject({
        scanned: 2,
        copied: 1,
        skipped: 1,
        destinationRoot: "Supabase Storage: private-uploads",
      });
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        `https://project.supabase.co/storage/v1/object/private-uploads/requests/1d/${fileKey}`,
      );
      expect(fetchMock.mock.calls[2]?.[0]).toBe(
        `https://project.supabase.co/storage/v1/object/private-uploads/library/4f/${libraryKey}`,
      );
      expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: "POST" });
    } finally {
      await rm(legacyRoot, { recursive: true, force: true });
    }
  });

  it("keeps stored bytes readable after a server-module reload", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "scholardesk-restart-files-"));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FILE_STORAGE_DIR", root);

    try {
      await writePrivateFile(fileKey, Buffer.from("persistent document"));
      vi.resetModules();
      const restartedStorage = await import("@/lib/file-storage.server");
      await expect(restartedStorage.readPrivateFile(fileKey)).resolves.toEqual(
        Buffer.from("persistent document"),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("copies legacy upload files into the fixed local root without overwriting existing files", async () => {
    const legacyRoot = await mkdtemp(path.join(tmpdir(), "scholardesk-legacy-files-"));
    const destinationRoot = await mkdtemp(path.join(tmpdir(), "scholardesk-migrated-files-"));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FILE_STORAGE_DIR", path.join("private", "uploads"));

    try {
      const legacyKey = fileKey;
      const libraryKey = "4f2a9b6c-1d2b-4d5f-b6d2-2f9f5d1f1122";
      const legacyRequestPath = path.join(legacyRoot, "1d", legacyKey);
      const legacyLibraryPath = path.join(legacyRoot, "library", "4f", libraryKey);
      const destinationRequestPath = path.join(destinationRoot, "1d", legacyKey);

      await mkdir(path.dirname(legacyRequestPath), { recursive: true });
      await mkdir(path.dirname(legacyLibraryPath), { recursive: true });
      await writeFile(legacyRequestPath, "legacy request payload");
      await writeFile(legacyLibraryPath, "legacy library payload");
      await mkdir(path.dirname(destinationRequestPath), { recursive: true });
      await writeFile(destinationRequestPath, "existing request payload");

      await expect(migrateLegacyPrivateFiles(legacyRoot, destinationRoot)).resolves.toMatchObject({
        copied: 1,
        skipped: 1,
        scanned: 2,
      });

      await expect(readFile(destinationRequestPath, "utf8")).resolves.toBe(
        "existing request payload",
      );
      await expect(
        readFile(path.join(destinationRoot, "library", "4f", libraryKey), "utf8"),
      ).resolves.toBe("legacy library payload");
    } finally {
      await rm(legacyRoot, { recursive: true, force: true });
      await rm(destinationRoot, { recursive: true, force: true });
    }
  });
});

describe("document format validation", () => {
  it("accepts PDF and legacy Word signatures when extension and MIME match", () => {
    expect(validateDocumentFile("report.pdf", "application/pdf", Buffer.from("%PDF-1.7"))).toEqual({
      mimeType: "application/pdf",
    });
    expect(
      validateDocumentFile(
        "report.doc",
        "application/msword",
        new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      ),
    ).toEqual({ mimeType: "application/msword" });
  });

  it("rejects mismatched MIME types and invalid document contents", () => {
    expect(
      validateDocumentFile("report.pdf", "text/plain", Buffer.from("%PDF-1.7")),
    ).toHaveProperty("error");
    expect(
      validateDocumentFile("fake.docx", "application/zip", Buffer.from("PK fake")),
    ).toHaveProperty("error");
    expect(validateDocumentFile("image.png", "image/png", Buffer.from("image"))).toHaveProperty(
      "error",
    );
  });
});

describe("request upload limits", () => {
  it("accepts an empty selection and valid files", () => {
    expect(validateUploadFiles([])).toBeNull();
    expect(validateUploadFiles(filesOfSize(1, MAX_REQUEST_FILE_BYTES))).toBeNull();
  });

  it("rejects oversized files, batches, and empty files", () => {
    expect(validateUploadFiles(filesOfSize(0))).toContain("non-empty");
    expect(validateUploadFiles(filesOfSize(MAX_REQUEST_FILE_BYTES + 1))).toContain("20 MB");
    expect(validateUploadFiles(filesOfSize(...Array(11).fill(1)))).toContain("10 files");
    expect(
      validateUploadFiles(
        filesOfSize(MAX_REQUEST_FILE_BYTES, MAX_REQUEST_FILE_BYTES, MAX_REQUEST_FILE_BYTES / 2, 1),
      ),
    ).toContain("50 MB");
  });

  it("returns a retryable failure when the upload connection drops", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));

    await expect(
      uploadFiles("a-request-id", [new File(["content"], "notes.txt")], "submission"),
    ).resolves.toBe(false);
  });
});
