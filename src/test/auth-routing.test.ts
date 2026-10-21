import { describe, expect, it } from "vitest";
import { dashboardRouteFor } from "@/lib/auth";

describe("dashboard routing", () => {
  it("sends administrators to the admin workspace", () => {
    expect(dashboardRouteFor(true)).toBe("/admin/dashboard");
  });

  it("sends students to the student dashboard", () => {
    expect(dashboardRouteFor(false)).toBe("/dashboard");
  });
});
