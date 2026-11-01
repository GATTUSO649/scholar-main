import { describe, expect, it } from "vitest";
import { adminWorkspaceRedirectFor, dashboardRouteFor } from "@/lib/auth";

describe("dashboard routing", () => {
  it("sends administrators to the admin workspace", () => {
    expect(dashboardRouteFor(true)).toBe("/admin/dashboard");
  });

  it("sends students to the student dashboard", () => {
    expect(dashboardRouteFor(false)).toBe("/dashboard");
  });

  it("keeps students out of admin routes", () => {
    expect(adminWorkspaceRedirectFor(false, "/admin/pricing")).toBe("/admin/login");
  });

  it("sends admins from the student profile to their admin profile", () => {
    expect(adminWorkspaceRedirectFor(true, "/profile")).toBe("/admin/profile");
  });

  it("allows admins to browse public pages without mounting the admin workspace", () => {
    expect(adminWorkspaceRedirectFor(true, "/pricing")).toBeNull();
    expect(adminWorkspaceRedirectFor(true, "/services")).toBeNull();
  });

  it("keeps admins out of private student pages", () => {
    expect(adminWorkspaceRedirectFor(true, "/dashboard")).toBe("/admin/dashboard");
    expect(adminWorkspaceRedirectFor(true, "/requests")).toBe("/admin/dashboard");
    expect(adminWorkspaceRedirectFor(true, "/request/123")).toBe("/admin/dashboard");
  });

  it("allows admins to stay on admin profile and pricing paths", () => {
    expect(adminWorkspaceRedirectFor(true, "/admin/profile")).toBeNull();
    expect(adminWorkspaceRedirectFor(true, "/admin/pricing")).toBeNull();
  });
});
