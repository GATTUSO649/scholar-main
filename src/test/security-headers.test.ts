import { describe, expect, it } from "vitest";
import { addSecurityHeaders } from "@/server";

describe("HTTP framing security headers", () => {
  it.each([200, 401, 403, 404, 500])("blocks framing on HTTP %s responses", (status) => {
    const response = addSecurityHeaders(new Response("response", { status }));

    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});
