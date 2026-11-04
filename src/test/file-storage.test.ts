import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPrivateFilePath } from "@/lib/file-storage.server";
import {
  MAX_REQUEST_FILE_BYTES,
  MAX_REQUEST_UPLOAD_BYTES,
  uploadFiles,
  validateUploadFiles,
} from "@/lib/requests";

const fileKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
const filesOfSize = (...sizes: number[]) => sizes.map((size) => ({ size }) as File);

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
