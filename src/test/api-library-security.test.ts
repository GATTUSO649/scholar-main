import { File as NodeFile } from "node:buffer";
import { OfficeConverter } from "officeparser";
import { PDFDocument } from "pdf-lib";
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
  PrivateFileStorageError: class extends Error {
    readonly operation = "upload";
    readonly sourceErrorName = "StorageUnknownError";
    readonly storageCode = "ECONNRESET";
    readonly destinationHostname = "project.supabase.co";
    readonly durationMs = 30_000;
    readonly retryAttempt = 3;

    constructor() {
      super("fetch failed");
      this.name = "PrivateFileStorageError";
      this.code = "ECONNRESET";
    }

    readonly code: string;
  },
}));

vi.mock("@/lib/backend.server", () => mocks);
vi.mock("@/lib/backend", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/lib/file-storage.server", () => ({
  deletePrivateFile: mocks.deletePrivateFile,
  getConfiguredFileLimit: (_name: string, fallback: number) => fallback,
  PrivateFileStorageError: mocks.PrivateFileStorageError,
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
if (!post || !put || !remove || !get)
  throw new Error("The library file handlers are not registered.");

class TestDocumentFile extends NodeFile {
  constructor(name: string, type: string, content: Uint8Array) {
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
  it("saves the admin-selected preview page", async () => {
    mocks.updateLibraryResource.mockResolvedValue({ success: true });
    const response = await patch({
      request: new Request("https://portal.example/api/library", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "resource-id",
          title: "Guide",
          description: "",
          category: "article",
          price: 250,
          preview_page: 4,
        }),
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateLibraryResource).toHaveBeenCalledWith("resource-id", {
      title: "Guide",
      description: "",
      category: "article",
      price: 250,
      previewPage: 4,
    });
  });

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
        expect.objectContaining({
          name: "one.pdf",
          mimeType: "application/pdf",
          category: "article",
        }),
        expect.objectContaining({
          name: "two.pdf",
          mimeType: "application/pdf",
          category: "article",
        }),
      ]),
    );
    expect(mocks.writePrivateFile).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.any(Buffer),
      "library",
      "application/pdf",
      true,
    );
  });

  it.each(["lesson_plan", "working_scheme"])(
    "accepts the %s library category",
    async (category) => {
      const file = new TestDocumentFile("resource.pdf", "application/pdf", Buffer.from("%PDF-1.7"));
      mocks.parseMultipartFormData.mockImplementationOnce(async () =>
        uploadForm([file], { category, description: "Academic resources", price: "0" }),
      );

      const response = await post({
        request: new Request("https://portal.example/api/library", { method: "POST" }),
      });

      expect(response.status).toBe(201);
      expect(mocks.createLibraryResources).toHaveBeenCalledWith([
        expect.objectContaining({ category }),
      ]);
    },
  );

  it("returns 503 and cleans up when a private Storage upload resets", async () => {
    const file = new TestDocumentFile("one.pdf", "application/pdf", Buffer.from("%PDF-1.7"));
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm([file], { category: "article", description: "", price: "0" }),
    );
    mocks.writePrivateFile.mockRejectedValueOnce(new mocks.PrivateFileStorageError());

    const response = await post({
      request: new Request("https://portal.example/api/library", { method: "POST" }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Library storage is temporarily unavailable. Please try again.",
    });
    expect(mocks.deletePrivateFile).toHaveBeenCalledWith(expect.any(String), "library");
    expect(mocks.createLibraryResources).not.toHaveBeenCalled();
  });

  it("returns 503 and cleans up after a transient database reset", async () => {
    const file = new TestDocumentFile("one.pdf", "application/pdf", Buffer.from("%PDF-1.7"));
    mocks.parseMultipartFormData.mockImplementationOnce(async () =>
      uploadForm([file], { category: "article", description: "", price: "0" }),
    );
    mocks.getDatabaseErrorCode.mockReturnValue("ECONNRESET");
    mocks.createLibraryResources.mockRejectedValueOnce(
      Object.assign(new Error("fetch failed"), {
        cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
      }),
    );

    const response = await post({
      request: new Request("https://portal.example/api/library", { method: "POST" }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Library services are temporarily unavailable. Please try again.",
    });
    expect(mocks.deletePrivateFile).toHaveBeenCalledWith(expect.any(String), "library");
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
    mocks.parseMultipartFormData.mockImplementationOnce(
      async () =>
        ({
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
        }) as unknown as FormData,
    );

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

  it("returns every PDF page with only the configured page readable", async () => {
    const resourceId = "9f94f2dc-4970-44d3-ae58-2a54e3811f2c";
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    sourcePdf.addPage([500, 600]);
    const sourceBytes = Buffer.from(await sourcePdf.save());
    mocks.readPrivateFile.mockImplementation(async () => sourceBytes);
    mocks.getLibraryResourceForDownload.mockResolvedValue({
      storageKey: "pdf-file-key",
      name: "guide.pdf",
      mimeType: "application/pdf",
      previewPage: 2,
      price: 250,
      currency: "KES",
      hasFullAccess: false,
    });

    const preview = await get({
      request: new Request(`https://portal.example/api/library?id=${resourceId}&preview=1`),
    });
    const download = await get({
      request: new Request(`https://portal.example/api/library?id=${resourceId}`),
    });

    const previewBytes = Buffer.from(await preview.arrayBuffer());
    expect(preview.status).toBe(200);
    expect(previewBytes.subarray(0, 8).toString()).toBe("%PDF-1.7");
    const previewPdf = await PDFDocument.load(new Uint8Array(previewBytes));
    expect(preview.headers.get("content-type")).toBe("application/pdf");
    expect(preview.headers.get("content-disposition")).toContain("inline");
    expect(previewPdf.getPageCount()).toBe(2);
    expect(previewPdf.getPage(1)?.getWidth()).toBe(500);
    expect(mocks.getLibraryResourceForDownload).toHaveBeenNthCalledWith(1, resourceId, true);
    expect(download.headers.get("content-disposition")).toContain("attachment");
    expect(Buffer.from(await download.arrayBuffer())).toEqual(sourceBytes);
  });

  it("converts DOCX resources into a locked multi-page PDF preview", async () => {
    const markdown = `# Resource preview\n\n${"A document paragraph for preview conversion.\\n\\n".repeat(180)}`;
    const { value: docxBytes } = await OfficeConverter.convert(Buffer.from(markdown), "docx", {
      parseConfig: { fileType: "md" },
    });
    mocks.readPrivateFile.mockImplementation(async () => Buffer.from(docxBytes));
    mocks.getLibraryResourceForDownload.mockResolvedValue({
      storageKey: "docx-file-key",
      name: "guide.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      previewPage: 1,
      price: 250,
      currency: "KES",
      hasFullAccess: false,
    });

    const response = await get({
      request: new Request(
        "https://portal.example/api/library?id=9f94f2dc-4970-44d3-ae58-2a54e3811f2c&preview=1",
      ),
    });
    const previewPdf = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(previewPdf.getPageCount()).toBeGreaterThan(1);
  });

  it("paginates TXT resources into a locked preview PDF", async () => {
    const text = Array.from(
      { length: 140 },
      (_, index) => `Line ${index + 1} of the document.`,
    ).join("\n");
    mocks.readPrivateFile.mockImplementation(async () => Buffer.from(text));
    mocks.getLibraryResourceForDownload.mockResolvedValue({
      storageKey: "text-file-key",
      name: "notes.txt",
      mimeType: "text/plain",
      previewPage: 2,
      price: 250,
      currency: "KES",
      hasFullAccess: false,
    });

    const response = await get({
      request: new Request(
        "https://portal.example/api/library?id=9f94f2dc-4970-44d3-ae58-2a54e3811f2c&preview=1",
      ),
    });
    const previewPdf = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));

    expect(response.status).toBe(200);
    expect(previewPdf.getPageCount()).toBeGreaterThan(1);
  });

  it("reports an invalid admin-selected page instead of a server error", async () => {
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    mocks.readPrivateFile.mockImplementation(async () => Buffer.from(await sourcePdf.save()));
    mocks.getLibraryResourceForDownload.mockResolvedValue({
      storageKey: "pdf-file-key",
      name: "guide.pdf",
      mimeType: "application/pdf",
      previewPage: 2,
      price: 250,
      currency: "KES",
      hasFullAccess: false,
    });

    const response = await get({
      request: new Request(
        "https://portal.example/api/library?id=9f94f2dc-4970-44d3-ae58-2a54e3811f2c&preview=1",
      ),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "The configured preview page does not exist." });
  });

  it("returns the full PDF preview after payment is confirmed", async () => {
    const resourceId = "9f94f2dc-4970-44d3-ae58-2a54e3811f2c";
    const sourcePdf = await PDFDocument.create();
    sourcePdf.addPage([300, 400]);
    sourcePdf.addPage([500, 600]);
    const sourceBytes = Buffer.from(await sourcePdf.save());
    mocks.readPrivateFile.mockImplementation(async () => sourceBytes);
    mocks.getLibraryResourceForDownload.mockResolvedValue({
      storageKey: "paid-pdf-key",
      name: "owned.pdf",
      mimeType: "application/pdf",
      previewPage: 1,
      price: 250,
      currency: "KES",
      hasFullAccess: true,
    });

    const response = await get({
      request: new Request(`https://portal.example/api/library?id=${resourceId}&preview=1`),
    });
    const previewBytes = Buffer.from(await response.arrayBuffer());
    const previewPdf = await PDFDocument.load(new Uint8Array(previewBytes));

    expect(response.status).toBe(200);
    expect(previewPdf.getPageCount()).toBe(2);
    expect(previewBytes).toEqual(sourceBytes);
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

  it("does not serve a preview when server-side access authorization fails", async () => {
    const resourceId = "9f94f2dc-4970-44d3-ae58-2a54e3811f2c";
    mocks.getLibraryResourceForDownload.mockRejectedValueOnce(
      new Error("Purchase this resource before downloading it."),
    );

    const response = await get({
      request: new Request(`https://portal.example/api/library?id=${resourceId}&preview=1`),
    });

    expect(response.status).toBe(403);
    expect(mocks.readPrivateFile).not.toHaveBeenCalled();
  });
});
