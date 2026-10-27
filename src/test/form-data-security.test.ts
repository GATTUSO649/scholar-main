import { describe, expect, it } from "vitest";
import {
  parseJsonRequestBody,
  parseMultipartFormData,
  RequestBodyTooLargeError,
  UploadBodyTooLargeError,
} from "@/lib/form-data.server";

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
