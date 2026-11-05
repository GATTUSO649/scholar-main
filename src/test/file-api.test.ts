import { File as NodeFile } from "node:buffer";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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

function useSupabaseStorage() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-storage-key");
  vi.stubEnv("SUPABASE_STORAGE_BUCKET", "private-uploads");
}

beforeEach(async () => {
  vi.clearAllMocks();
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
    ["PDF", new TestUploadFile("assignment.pdf", "application/pdf", "%PDF-1.7 test")],
    [
      "Word",
      new TestUploadFile(
        "assignment.doc",
        "application/msword",
        new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      ),
    ],
  ])("accepts a content-validated %s upload", async (_format, file) => {
    mocks.parseMultipartFormData.mockImplementationOnce(async () => uploadForm([file]));

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(201);
    expect(mocks.addRequestFile.mock.calls[0]?.[0]).toMatchObject({ name: file.name });
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
    expect(fetchMock).toHaveBeenCalledWith(
      `https://project.supabase.co/storage/v1/object/private-uploads/requests/1d/${storageKey}`,
      expect.objectContaining({
        headers: {
          apikey: "server-only-storage-key",
          authorization: "Bearer server-only-storage-key",
        },
      }),
    );
  });

  it("returns 404 and logs provider details when the private object is missing", async () => {
    useSupabaseStorage();
    const storageKey = "1d28d191-bcce-43cf-8d7c-b03c386de3b3";
    mocks.getAuthorizedFile.mockResolvedValue({ storageKey, name: "report.pdf" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: "ObjectNotFound", message: "Object not found" }, { status: 404 }),
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
      errorName: "SupabaseStorageResponseError",
      code: "ObjectNotFound",
      httpStatus: 404,
      operation: "download",
      bucket: "private-uploads",
      objectPath: `requests/1d/${storageKey}`,
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
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
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
        originalMessage: "connect ECONNREFUSED",
        errorName: "Error",
        httpStatus: null,
        operation: "download",
        bucket: "private-uploads",
        objectPath: `requests/1d/${storageKey}`,
      }),
    );
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
