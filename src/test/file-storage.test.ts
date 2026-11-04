import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPrivateFilePath,
  migrateLegacyPrivateFiles,
  readPrivateFile,
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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("private file storage", () => {
  it("resolves request and library files under the configured root", () => {
    const root = path.join("private", "uploads");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FILE_STORAGE_DIR", root);

    expect(getPrivateFilePath(fileKey)).toBe(path.join(path.resolve(root), "1d", fileKey));
    expect(getPrivateFilePath(fileKey, "library")).toBe(
      path.join(path.resolve(root), "library", "1d", fileKey),
    );
  });

  it("rejects invalid keys and missing production storage configuration", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(() => getPrivateFilePath("../private-file")).toThrow("Invalid file key.");

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FILE_STORAGE_DIR", "");
    expect(() => getPrivateFilePath(fileKey)).toThrow("FILE_STORAGE_DIR");
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

  it("copies legacy upload files into the configured root without overwriting existing files", async () => {
    const legacyRoot = await mkdtemp(path.join(tmpdir(), "scholardesk-legacy-files-"));
    const destinationRoot = await mkdtemp(path.join(tmpdir(), "scholardesk-migrated-files-"));
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("FILE_STORAGE_DIR", destinationRoot);

    try {
      const legacyKey = fileKey;
      const libraryKey = "4f2a9b6c-1d2b-4d5f-b6d2-2f9f5d1f1122";
      const legacyRequestPath = path.join(legacyRoot, "1d", legacyKey);
      const legacyLibraryPath = path.join(legacyRoot, "library", "4f", libraryKey);

      await mkdir(path.dirname(legacyRequestPath), { recursive: true });
      await mkdir(path.dirname(legacyLibraryPath), { recursive: true });
      await writeFile(legacyRequestPath, "legacy request payload");
      await writeFile(legacyLibraryPath, "legacy library payload");
      await writePrivateFile(legacyKey, Buffer.from("existing request payload"));

      await expect(migrateLegacyPrivateFiles(legacyRoot)).resolves.toMatchObject({
        copied: 1,
        skipped: 1,
        scanned: 2,
      });

      await expect(readFile(path.join(destinationRoot, "1d", legacyKey), "utf8")).resolves.toBe(
        "existing request payload",
      );
      await expect(readFile(path.join(destinationRoot, "library", "4f", libraryKey), "utf8")).resolves.toBe(
        "legacy library payload",
      );
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
    expect(validateDocumentFile("report.pdf", "text/plain", Buffer.from("%PDF-1.7"))).toHaveProperty(
      "error",
    );
    expect(validateDocumentFile("fake.docx", "application/zip", Buffer.from("PK fake"))).toHaveProperty(
      "error",
    );
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
