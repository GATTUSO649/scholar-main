import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { ReadableStream } from "node:stream/web";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addRequestFile: vi.fn(),
  authorizedUploadTarget: vi.fn(),
  completeRequestDelivery: vi.fn(),
  deleteRequestFile: vi.fn(),
  getAuthorizedFile: vi.fn(),
  getDatabaseErrorCode: vi.fn(),
  notifyAdminsOfStudentUpload: vi.fn(),
  parseMultipartFormData: vi.fn(),
}));

vi.mock("@/lib/backend.server", () => mocks);
vi.mock("@/lib/backend", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/form-data.server", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  parseMultipartFormData: mocks.parseMultipartFormData,
}));

import { Route } from "@/routes/api.files";
import { getPrivateFilePath } from "@/lib/file-storage.server";

const post = (
  Route.options.server as unknown as {
    handlers?: { POST?: (input: { request: Request }) => Promise<Response> };
  }
).handlers?.POST;
if (!post) throw new Error("The file upload POST handler is not registered.");
const get = (
  Route.options.server as unknown as {
    handlers?: { GET?: (input: { request: Request }) => Promise<Response> };
  }
).handlers?.GET;
if (!get) throw new Error("The file download GET handler is not registered.");

let storageRoot = "";
type StoredRequestFile = { storageKey: string; name: string; mimeType: string };

class TestUploadFile extends NodeFile {
  constructor(
    name = "assignment.txt",
    type = "text/plain",
    content: string | Uint8Array = "student attachment",
  ) {
    super([typeof content === "string" ? content : Buffer.from(content)], name, { type });
  }
}

function uploadForm(files: TestUploadFile[], kind: "submission" | "delivery" = "submission") {
  return {
    get: (name: string) =>
      name === "request_id"
        ? "9f94f2dc-4970-44d3-ae58-2a54e3811f2c"
        : name === "kind"
          ? kind
          : null,
    getAll: (name: string) => (name === "files" ? files : []),
  } as unknown as FormData;
}

function makeZip(entries: string[]) {
  const encoder = new TextEncoder();
  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry);
    const localRecord = new Uint8Array(30 + name.length);
    const localView = new DataView(localRecord.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(26, name.length, true);
    localRecord.set(name, 30);
    localRecords.push(localRecord);

    const centralRecord = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralRecord.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    centralRecord.set(name, 46);
    centralRecords.push(centralRecord);
    localOffset += localRecord.length;
  }

  const centralSize = centralRecords.reduce((size, record) => size + record.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);

  const parts = [...localRecords, ...centralRecords, endRecord];
  const archive = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    archive.set(part, offset);
    offset += part.length;
  }
  return archive;
}

function useSupabaseStorage() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-storage-key");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "private-uploads");
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("Blob", NodeBlob);
  storageRoot = await mkdtemp(path.join(tmpdir(), "scholardesk-file-api-"));
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("FILE_STORAGE_DIR", storageRoot);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "");
  mocks.authorizedUploadTarget.mockResolvedValue({ userId: "student-id" });
  mocks.getAuthorizedFile.mockResolvedValue(null);
  mocks.addRequestFile.mockResolvedValue(undefined);
  mocks.parseMultipartFormData.mockImplementation(async () => uploadForm([new TestUploadFile()]));
  mocks.notifyAdminsOfStudentUpload.mockRejectedValue(new Error("notification database reset"));
  mocks.getDatabaseErrorCode.mockReturnValue("ECONNRESET");
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(storageRoot, { recursive: true, force: true });
});

describe("private request file uploads", () => {
  it("keeps saved files and succeeds when the admin notification fails", async () => {
    mocks.authorizedUploadTarget.mockRejectedValueOnce(new Error("connection reset"));
    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });
    const responseBody = await response.json();
    const stored = mocks.addRequestFile.mock.calls[0]?.[0] as { storageKey: string } | undefined;

    expect({ status: response.status, body: responseBody }).toEqual({
      status: 201,
      body: { uploaded: 1 },
    });
    expect(mocks.authorizedUploadTarget).toHaveBeenCalledTimes(2);
    expect(mocks.addRequestFile).toHaveBeenCalledOnce();
    expect(mocks.notifyAdminsOfStudentUpload).toHaveBeenCalledOnce();
    expect(mocks.deleteRequestFile).not.toHaveBeenCalled();
    expect(stored).toBeDefined();
    await expect(readFile(getPrivateFilePath(stored!.storageKey), "utf8")).resolves.toBe(
      "student attachment",
    );
  });

  it.each([
    [
      "PDF",
      new TestUploadFile("assignment.pdf", "application/pdf", "%PDF-1.7 test"),
      "application/pdf",
    ],
    [
      "DOCX",
      new TestUploadFile(
        "assignment.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        makeZip(["[Content_Types].xml", "word/document.xml"]),
      ),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    [
      "XLSX",
      new TestUploadFile(
        "assignment.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        makeZip(["[Content_Types].xml", "xl/workbook.xml"]),
      ),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  ])("uploads a content-validated %s through Supabase Storage", async (_format, file, mimeType) => {
    useSupabaseStorage();
    mocks.parseMultipartFormData.mockImplementationOnce(async () => uploadForm([file]));
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.addRequestFile.mock.calls[0]?.[0]).toMatchObject({
      name: file.name,
      mimeType,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(
      /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/private-uploads\/requests\/[0-9a-f]{2}\//,
    );
    const uploadHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(uploadHeaders.get("content-type")).toBe(mimeType);
    expect(uploadHeaders.get("x-upsert")).toBe("true");
  });

  it("rejects unsupported file types before calling Storage", async () => {
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm([new TestUploadFile("photo.png", "image/png", "not a document")]),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.addRequestFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before calling Storage", async () => {
    const content = Buffer.alloc(20 * 1024 * 1024 + 1);
    content.set(Buffer.from("%PDF-1.7"));
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm([new TestUploadFile("large.pdf", "application/pdf", content)]),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the configured Storage bucket does not exist", async () => {
    useSupabaseStorage();
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    mocks.getAuthorizedFile.mockResolvedValue({ storageKey, name: "report.pdf" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: "BucketNotFound", message: "Bucket not found" }, { status: 404 }),
        ),
    );

    const response = await get({
      request: new Request(`https://portal.example/api/files?key=${storageKey}`),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "File storage is temporarily unavailable. Please try again later.",
    });
  });

  it("retries a transient Storage upload reset without duplicating metadata", async () => {
    useSupabaseStorage();
    const fetchError = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(fetchError)
      .mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("x-upsert")).toBe("true");
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("x-upsert")).toBe("true");
    expect(mocks.addRequestFile).toHaveBeenCalledOnce();
  });

  it("requires authentication before private downloads reach Storage", async () => {
    useSupabaseStorage();
    mocks.getDatabaseErrorCode.mockReturnValue(undefined);
    mocks.getAuthorizedFile.mockRejectedValue(new Error("You must be signed in."));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await get({
      request: new Request(
        "https://portal.example/api/files?key=1d28d191-bcce-43cf-8d7c-b03c386de3b3",
      ),
    });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("removes the uploaded object and metadata when PostgreSQL insertion fails", async () => {
    useSupabaseStorage();
    mocks.getDatabaseErrorCode.mockReturnValue(undefined);
    mocks.addRequestFile.mockRejectedValue(new Error("database unavailable"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal("fetch", fetchMock);

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE");
    expect(mocks.deleteRequestFile).toHaveBeenCalledOnce();
  });

  it("stores multiple documents from one upload request", async () => {
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm([
        new TestUploadFile("first.txt", "text/plain", "first file"),
        new TestUploadFile("second.txt", "text/plain", "second file"),
      ]),
    );

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ uploaded: 2 });
    expect(mocks.addRequestFile).toHaveBeenCalledTimes(2);
  });

  it("rejects an upload when the server denies request ownership", async () => {
    mocks.getDatabaseErrorCode.mockReturnValueOnce(undefined);
    mocks.authorizedUploadTarget.mockRejectedValueOnce(
      new Error("You cannot upload to this request."),
    );

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.addRequestFile).not.toHaveBeenCalled();
  });

  it("reports missing production storage as unavailable without masking it as a server error", async () => {
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm([new TestUploadFile()]),
    );
    mocks.authorizedUploadTarget.mockResolvedValueOnce({ userId: "student-id" });
    const writeError = new Error(
      "Supabase Storage must be configured for production file storage.",
    );
    vi.spyOn(await import("@/lib/file-storage.server"), "writePrivateFile").mockRejectedValueOnce(
      writeError,
    );

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Supabase Storage must be configured for production file storage.",
    });
  });

  it("streams an authorized stored file as a private attachment", async () => {
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    const filePath = getPrivateFilePath(storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "completed work");
    mocks.getAuthorizedFile.mockResolvedValue({
      storageKey,
      name: "completed-work.txt",
    });

    const response = await get({
      request: new Request(`https://portal.example/api/files?key=${storageKey}`),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'attachment; filename="completed-work.txt"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("completed work");
  });

  it("downloads an authorized Supabase object using the expected private object path", async () => {
    useSupabaseStorage();
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    mocks.getAuthorizedFile.mockResolvedValue({ storageKey, name: "report.pdf" });
    const fetchMock = vi.fn().mockResolvedValue(new Response("%PDF-1.7 data", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await get({
      request: new Request(`https://portal.example/api/files?key=${storageKey}`),
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("%PDF-1.7 data");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://project.supabase.co/storage/v1/object/private-uploads/requests/1d/${storageKey}`,
    );
    const requestHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(requestHeaders.get("apikey")).toBe("server-only-storage-key");
    expect(requestHeaders.get("authorization")).toBe("Bearer server-only-storage-key");
  });

  it("returns 404 when Supabase reports a missing private object with HTTP 400", async () => {
    useSupabaseStorage();
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    mocks.getAuthorizedFile.mockResolvedValue({ storageKey, name: "report.pdf" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: "NoSuchKey", message: "Object not found" }, { status: 400 }),
        ),
    );
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await get({
      request: new Request(`https://portal.example/api/files?key=${storageKey}`),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "File is unavailable. Please contact support to have it restored.",
    });
    expect(errorLog).toHaveBeenCalledWith("Private file storage operation failed.", {
      stage: "private storage read",
      originalMessage: "Object not found",
      errorName: "StorageApiError",
      code: "NoSuchKey",
      storageCode: "NoSuchKey",
      httpStatus: 400,
      operation: "download",
      destinationHostname: "project.supabase.co",
      durationMs: expect.any(Number),
      retryAttempt: 1,
    });
  });

  it("returns 503 for invalid storage credentials and redacts the key from logs", async () => {
    useSupabaseStorage();
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    mocks.getAuthorizedFile.mockResolvedValue({ storageKey, name: "report.pdf" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            code: "InvalidJWT",
            message: "Invalid bearer server-only-storage-key",
          },
          { status: 401 },
        ),
      ),
    );
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await get({
      request: new Request(`https://portal.example/api/files?key=${storageKey}`),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "File storage is temporarily unavailable. Please try again later.",
    });
    const serializedLog = JSON.stringify(errorLog.mock.calls);
    expect(serializedLog).toContain("InvalidJWT");
    expect(serializedLog).toContain("Invalid Bearer [REDACTED]");
    expect(serializedLog).not.toContain("server-only-storage-key");
  });

  it("returns 503 and logs transport failures when Supabase Storage is unavailable", async () => {
    useSupabaseStorage();
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    mocks.getAuthorizedFile.mockResolvedValue({ storageKey, name: "report.pdf" });
    const fetchError = Object.assign(new Error("fetch failed"), {
      cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
    });
    const fetchMock = vi.fn().mockRejectedValue(fetchError);
    vi.stubGlobal("fetch", fetchMock);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await get({
      request: new Request(`https://portal.example/api/files?key=${storageKey}`),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "File storage is temporarily unavailable. Please try again later.",
    });
    expect(errorLog).toHaveBeenCalledWith(
      "Private file storage operation failed.",
      expect.objectContaining({
        originalMessage: "fetch failed",
        errorName: "StorageUnknownError",
        code: "ECONNRESET",
        storageCode: "ECONNRESET",
        httpStatus: null,
        operation: "download",
        destinationHostname: "project.supabase.co",
        retryAttempt: 3,
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns 503 when the Storage response body resets after HTTP 200", async () => {
    useSupabaseStorage();
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    mocks.getAuthorizedFile.mockResolvedValue({ storageKey, name: "report.pdf" });
    const streamError = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(streamError);
            },
          }) as unknown as BodyInit,
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await get({
      request: new Request(`https://portal.example/api/files?key=${storageKey}`),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "File storage is temporarily unavailable. Please try again later.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("downloads the exact PDF uploaded by an admin as a delivery file", async () => {
    const file = new TestUploadFile(
      "KitCulture Website Security Report.pdf",
      "application/pdf",
      "%PDF-1.7 completed work",
    );
    mocks.authorizedUploadTarget.mockResolvedValueOnce({ userId: "admin-id" });
    mocks.parseMultipartFormData.mockImplementationOnce(async () => uploadForm([file], "delivery"));

    const uploadResponse = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });
    const uploaded = mocks.addRequestFile.mock.calls[0]?.[0] as StoredRequestFile | undefined;
    expect(uploadResponse.status).toBe(201);
    expect(uploaded).toMatchObject({
      name: "KitCulture Website Security Report.pdf",
      mimeType: "application/pdf",
    });
    expect(uploaded?.storageKey).toBeDefined();
    expect(mocks.completeRequestDelivery).toHaveBeenCalledWith(
      "9f94f2dc-4970-44d3-ae58-2a54e3811f2c",
    );

    mocks.getAuthorizedFile.mockResolvedValueOnce({
      storageKey: uploaded!.storageKey,
      name: uploaded!.name,
    });
    const downloadResponse = await get({
      request: new Request(
        `https://portal.example/api/files?key=${encodeURIComponent(uploaded!.storageKey)}`,
      ),
    });

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-disposition")).toContain(
      'filename="KitCulture Website Security Report.pdf"',
    );
    await expect(downloadResponse.text()).resolves.toBe("%PDF-1.7 completed work");
  });

  it("retries a transient database reset during download authorization", async () => {
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    const filePath = getPrivateFilePath(storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "completed work");
    mocks.getAuthorizedFile
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce({ storageKey, name: "completed-work.txt" });

    const response = await get({
      request: new Request(`https://portal.example/api/files?key=${storageKey}`),
    });

    expect(response.status).toBe(200);
    expect(mocks.getAuthorizedFile).toHaveBeenCalledTimes(2);
    await expect(response.text()).resolves.toBe("completed work");
  });

  it("returns not found when server-side authorization finds no file", async () => {
    const response = await get({
      request: new Request(
        "https://portal.example/api/files?key=1d28d191-bcce-43cf-8d7c-b03c386de3b3",
      ),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "File not found." });
  });
});
