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

  it("surfaces a storage configuration error instead of masking it as a generic failure", async () => {
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm([new TestUploadFile()]),
    );
    mocks.authorizedUploadTarget.mockResolvedValueOnce({ userId: "student-id" });
    const writeError = new Error(
      "FILE_STORAGE_DIR must be an absolute path to persistent private storage.",
    );
    vi.spyOn(await import("@/lib/file-storage.server"), "writePrivateFile").mockRejectedValueOnce(
      writeError,
    );

    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "FILE_STORAGE_DIR must be an absolute path to persistent private storage.",
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
