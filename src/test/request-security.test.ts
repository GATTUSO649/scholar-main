import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/lib/backend";

describe("same-origin mutation checks", () => {
  it("allows matching HTTP and HTTPS origins", () => {
    expect(
      isSameOriginRequest(
        new Request("https://portal.example/api", {
          headers: { host: "portal.example", origin: "https://portal.example" },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOriginRequest(
        new Request("http://localhost:3000/api", {
          headers: { host: "localhost:3000", origin: "http://localhost:3000" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects different hosts, protocols, missing origins, and malformed origins", () => {
    const request = (origin?: string) =>
      new Request("https://portal.example/api", {
        headers: {
          host: "portal.example",
          ...(origin ? { origin } : {}),
        },
      });

    expect(isSameOriginRequest(request("https://attacker.example"))).toBe(false);
    expect(isSameOriginRequest(request("http://portal.example"))).toBe(false);
    expect(isSameOriginRequest(request())).toBe(false);
    expect(isSameOriginRequest(request("not a URL"))).toBe(false);
  });

  it("uses the external protocol forwarded by the trusted deployment proxy", () => {
    expect(
      isSameOriginRequest(
        new Request("http://internal:3000/api", {
          headers: {
            host: "portal.example",
            origin: "https://portal.example",
            "x-forwarded-proto": "https",
          },
        }),
      ),
    ).toBe(true);
  });
});
