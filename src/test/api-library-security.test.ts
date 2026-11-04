import { File as NodeFile } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLibraryResources: vi.fn(),
  createLibraryResource: vi.fn(),
  deleteLibraryResource: vi.fn(),
  deletePrivateFile: vi.fn(),
  getDatabaseErrorCode: vi.fn(),
  getLibraryResourceForDownload: vi.fn(),
  parseMultipartFormData: vi.fn(),
  readPrivateFile: vi.fn(),
  requireLibraryAdmin: vi.fn(),
  replaceLibraryResourceFile: vi.fn(),
  updateLibraryResource: vi.fn(),
  writePrivateFile: vi.fn(),
}));

vi.mock("@/lib/backend.server", () => mocks);
vi.mock("@/lib/backend", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/file-storage.server", () => ({
  deletePrivateFile: mocks.deletePrivateFile,
  getConfiguredFileLimit: (_name: string, fallback: number) => fallback,
  readPrivateFile: mocks.readPrivateFile,
  writePrivateFile: mocks.writePrivateFile,
}));
vi.mock("@/lib/form-data.server", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  parseMultipartFormData: mocks.parseMultipartFormData,
}));

import { Route } from "@/routes/api.library";

const patch = (
  Route.options.server as unknown as {
    handlers?: { PATCH?: (input: { request: Request }) => Promise<Response> };
  }
).handlers?.PATCH;
if (!patch) throw new Error("The library metadata PATCH handler is not registered.");
const handlers = Route.options.server as unknown as {
  handlers?: {
    POST?: (input: { request: Request }) => Promise<Response>;
    PUT?: (input: { request: Request }) => Promise<Response>;
    DELETE?: (input: { request: Request }) => Promise<Response>;
    GET?: (input: { request: Request }) => Promise<Response>;
  };
};
const post = handlers.handlers?.POST;
const put = handlers.handlers?.PUT;
const remove = handlers.handlers?.DELETE;
const get = handlers.handlers?.GET;
if (!post || !put || !remove || !get) throw new Error("The library file handlers are not registered.");

class TestDocumentFile extends NodeFile {
  constructor(
    name: string,
    type: string,
    content: Uint8Array,
  ) {
    super([Buffer.from(content)], name, { type });
  }
}

function uploadForm(files: TestDocumentFile[], fields: Record<string, string> = {}) {
  return {
    get: (name: string) => fields[name] ?? null,
    getAll: (name: string) => (name === "files" ? files : []),
  } as unknown as FormData;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireLibraryAdmin.mockResolvedValue(undefined);
  mocks.writePrivateFile.mockResolvedValue(undefined);
  mocks.deletePrivateFile.mockResolvedValue(undefined);
  mocks.createLibraryResources.mockResolvedValue({ success: true, ids: ["id-1", "id-2"] });
  mocks.replaceLibraryResourceFile.mockResolvedValue({ previousStorageKey: "old-file-key" });
  mocks.deleteLibraryResource.mockResolvedValue({ storageKey: "file-key" });
  mocks.readPrivateFile.mockResolvedValue(Buffer.from("%PDF-1.7 document"));
  mocks.parseMultipartFormData.mockImplementation(async () => uploadForm([], {}));
});

describe("library metadata API body limits", () => {
  it("rejects oversized JSON before invoking the admin mutation", async () => {
    const request = new Request("https://portal.example/api/library", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: `{"data":"${"x".repeat(16 * 1024)}"}`,
    });

    const response = await patch({ request });

    expect(response.status).toBe(413);
    expect(mocks.updateLibraryResource).not.toHaveBeenCalled();
  });

  it("rejects non-JSON content types before mutation", async () => {
    const response = await patch({
      request: new Request("https://portal.example/api/library", {
        method: "PATCH",
        headers: { "content-type": "text/plain" },
        body: "not json",
      }),
    });

    expect(response.status).toBe(400);
    expect(mocks.updateLibraryResource).not.toHaveBeenCalled();
  });
});

describe("private library documents", () => {
  it("creates multiple PDF documents with server-generated keys and MIME metadata", async () => {
    const files = [
      new TestDocumentFile("one.pdf", "application/pdf", Buffer.from("%PDF-1.7 one")),
      new TestDocumentFile("two.pdf", "application/pdf", Buffer.from("%PDF-1.7 two")),
    ];
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm(files, { category: "article", description: "Documents", price: "0" }),
    );

    const response = await post({
      request: new Request("https://portal.example/api/library", { method: "POST" }),
    });

    const body = await response.json();
    expect({
      status: response.status,
      writes: mocks.writePrivateFile.mock.calls.length,
      creates: mocks.createLibraryResources.mock.calls.length,
      body,
    }).toEqual({
      status: 201,
      writes: 2,
      creates: 1,
      body: { success: true, uploaded: 2 },
    });
    expect(mocks.writePrivateFile).toHaveBeenCalledTimes(2);
    expect(mocks.createLibraryResources).toHaveBeenCalledOnce();
    expect(mocks.createLibraryResources.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "one.pdf", mimeType: "application/pdf", category: "article" }),
        expect.objectContaining({ name: "two.pdf", mimeType: "application/pdf", category: "article" }),
      ]),
    );
  });

  it("rejects unauthorized uploads before writing files", async () => {
    mocks.requireLibraryAdmin.mockRejectedValueOnce(new Error("Administrator access is required."));
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm([new TestDocumentFile("one.pdf", "application/pdf", Buffer.from("%PDF-1.7"))]),
    );

    const response = await post({
      request: new Request("https://portal.example/api/library", { method: "POST" }),
    });

    expect(response.status).toBe(403);
    expect(mocks.writePrivateFile).not.toHaveBeenCalled();
  });

  it("replaces the document while preserving the resource ID and deleting old bytes", async () => {
    const resourceId = "9f94f2dc-4970-44d3-ae58-2a54e3811f2c";
    mocks.parseMultipartFormData.mockImplementationOnce(async () => ({
      get: (name: string) =>
        name === "id"
          ? resourceId
          : name === "file"
            ? new TestDocumentFile(
                "replacement.doc",
                "application/msword",
                new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
              )
            : null,
      getAll: () => [],
    }) as unknown as FormData);

    const response = await put({
      request: new Request("https://portal.example/api/library", { method: "PUT" }),
    });
    const body = await response.json();

    expect({
      status: response.status,
      writes: mocks.writePrivateFile.mock.calls.length,
      replaces: mocks.replaceLibraryResourceFile.mock.calls.length,
      body,
    }).toEqual({ status: 200, writes: 1, replaces: 1, body: { success: true } });
    expect(mocks.replaceLibraryResourceFile).toHaveBeenCalledWith(
      resourceId,
      expect.objectContaining({ name: "replacement.doc", mimeType: "application/msword" }),
    );
    expect(mocks.deletePrivateFile).toHaveBeenCalledWith("old-file-key", "library");
  });

  it("deletes a document record and its private bytes", async () => {
    const resourceId = "9f94f2dc-4970-44d3-ae58-2a54e3811f2c";
    const response = await remove({
      request: new Request(`https://portal.example/api/library?id=${resourceId}`, {
        method: "DELETE",
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.deleteLibraryResource).toHaveBeenCalledWith(resourceId);
    expect(mocks.deletePrivateFile).toHaveBeenCalledWith("file-key", "library");
  });

  it("previews an authorized PDF inline and downloads it as an attachment by default", async () => {
    const resourceId = "9f94f2dc-4970-44d3-ae58-2a54e3811f2c";
    mocks.getLibraryResourceForDownload.mockResolvedValue({
      storageKey: "pdf-file-key",
      name: "guide.pdf",
      mimeType: "application/pdf",
    });

    const preview = await get({
      request: new Request(`https://portal.example/api/library?id=${resourceId}&preview=1`),
    });
    const download = await get({
      request: new Request(`https://portal.example/api/library?id=${resourceId}`),
    });

    expect(preview.headers.get("content-type")).toBe("application/pdf");
    expect(preview.headers.get("content-disposition")).toContain("inline");
    expect(download.headers.get("content-disposition")).toContain("attachment");
  });

  it("does not return a document when server authorization fails", async () => {
    const resourceId = "9f94f2dc-4970-44d3-ae58-2a54e3811f2c";
    mocks.getLibraryResourceForDownload.mockRejectedValueOnce(new Error("You must be signed in."));

    const response = await get({
      request: new Request(`https://portal.example/api/library?id=${resourceId}`),
    });

    expect(response.status).toBe(401);
    expect(mocks.readPrivateFile).not.toHaveBeenCalled();
  });
});
