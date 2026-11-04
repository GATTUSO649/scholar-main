import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    const response = await post({
      request: new Request("https://portal.example/api/files", { method: "POST" }),
    });
    const responseBody = await response.json();
    const stored = mocks.addRequestFile.mock.calls[0]?.[0] as { storageKey: string } | undefined;

    expect({ status: response.status, body: responseBody }).toEqual({
      status: 201,
      body: { uploaded: 1 },
    });
    expect(mocks.notifyAdminsOfStudentUpload).toHaveBeenCalledOnce();
    expect(mocks.deleteRequestFile).not.toHaveBeenCalled();
    expect(stored).toBeDefined();
    await expect(readFile(getPrivateFilePath(stored!.storageKey), "utf8")).resolves.toBe(
      "student attachment",
    );
  });
});
