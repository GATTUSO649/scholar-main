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

class TestUploadFile {
  readonly name = "assignment.txt";
  readonly size = 18;
  readonly type = "text/plain";

  async arrayBuffer() {
    const bytes = new TextEncoder().encode("student attachment");
    return bytes.buffer as ArrayBuffer;
  }
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("File", TestUploadFile);
  storageRoot = await mkdtemp(path.join(tmpdir(), "scholardesk-file-api-"));
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("FILE_STORAGE_DIR", storageRoot);
  mocks.authorizedUploadTarget.mockResolvedValue({ userId: "student-id" });
  mocks.getAuthorizedFile.mockResolvedValue(null);
  mocks.addRequestFile.mockResolvedValue(undefined);
  mocks.parseMultipartFormData.mockImplementation(async () => {
    return {
      get: (name: string) =>
        name === "request_id"
          ? "9f94f2dc-4970-44d3-ae58-2a54e3811f2c"
          : name === "kind"
            ? "submission"
            : null,
      getAll: (name: string) => (name === "files" ? [new TestUploadFile()] : []),
    } as unknown as FormData;
  });
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
