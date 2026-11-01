import { describe, expect, it } from "vitest";
import {
  parseJsonRequestBody,
  parseMultipartFormData,
  RequestBodyTooLargeError,
  UploadBodyTooLargeError,
} from "@/lib/form-data.server";
import { hasSupportedLibraryFileSignature } from "@/lib/file-signature.server";

describe("bounded multipart form parsing", () => {
  it("rejects an oversized streaming body even when Content-Length is absent", async () => {
    const request = new Request("https://portal.example/api/files", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=test" },
      body: "123456789",
    });

    await expect(parseMultipartFormData(request, 8)).rejects.toBeInstanceOf(
      UploadBodyTooLargeError,
    );
  });

  it("parses a valid bounded form body", async () => {
    const data = new FormData();
    data.set("kind", "submission");
    const request = new Request("https://portal.example/api/files", {
      method: "POST",
      body: data,
    });

    const parsed = await parseMultipartFormData(request, 1024);
    expect(parsed.get("kind")).toBe("submission");
  });

  it("rejects an oversized JSON callback body before parsing", async () => {
    const request = new Request("https://portal.example/api/library/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: "123456789" }),
    });

    await expect(parseJsonRequestBody(request, 8)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});

describe("library upload file signatures", () => {
  it("accepts supported document headers", () => {
    expect(hasSupportedLibraryFileSignature(".pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(
      true,
    );
    expect(
      hasSupportedLibraryFileSignature(".docx", new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
    ).toBe(true);
    expect(hasSupportedLibraryFileSignature(".txt", new TextEncoder().encode("notes"))).toBe(true);
  });

  it("rejects mismatched and binary text content", () => {
    expect(hasSupportedLibraryFileSignature(".pdf", new TextEncoder().encode("not a PDF"))).toBe(
      false,
    );
    expect(hasSupportedLibraryFileSignature(".txt", new Uint8Array([0x61, 0x00, 0x62]))).toBe(
      false,
    );
    expect(hasSupportedLibraryFileSignature(".exe", new Uint8Array([0x4d, 0x5a]))).toBe(false);
  });
});
