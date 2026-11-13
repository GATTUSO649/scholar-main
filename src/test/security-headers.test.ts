import { describe, expect, it } from "vitest";
import { addSecurityHeaders } from "@/server";

describe("HTTP framing security headers", () => {
  it.each([200, 401, 403, 404, 500])("blocks framing on HTTP %s responses", (status) => {
    const response = addSecurityHeaders(new Response("response", { status }));

    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("allows same-origin framing for successful library PDF previews only", () => {
    const request = new Request("https://portal.example/api/library?id=resource-1&preview=1");
    const preview = addSecurityHeaders(
      new Response("%PDF-preview", { headers: { "content-type": "application/pdf" } }),
      request,
    );
    const privateDownload = addSecurityHeaders(
      new Response("%PDF-file", { headers: { "content-type": "application/pdf" } }),
      new Request("https://portal.example/api/files?key=file-key"),
    );
    const failedPreview = addSecurityHeaders(
      Response.json({ error: "Not authorized." }, { status: 403 }),
      request,
    );

    expect(preview.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(preview.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    expect(privateDownload.headers.get("x-frame-options")).toBe("DENY");
    expect(privateDownload.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(failedPreview.headers.get("x-frame-options")).toBe("DENY");
  });
});
