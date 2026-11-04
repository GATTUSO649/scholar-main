import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLibraryResource: vi.fn(),
  deleteLibraryResource: vi.fn(),
  getDatabaseErrorCode: vi.fn(),
  getLibraryResourceForDownload: vi.fn(),
  requireLibraryAdmin: vi.fn(),
  updateLibraryResource: vi.fn(),
}));

vi.mock("@/lib/backend.server", () => mocks);
vi.mock("@/lib/backend", () => ({ requireSameOrigin: vi.fn() }));

import { Route } from "@/routes/api.library";

const patch = (
  Route.options.server as unknown as {
    handlers?: { PATCH?: (input: { request: Request }) => Promise<Response> };
  }
).handlers?.PATCH;
if (!patch) throw new Error("The library metadata PATCH handler is not registered.");

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
