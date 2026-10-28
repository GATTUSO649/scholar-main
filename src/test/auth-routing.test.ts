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

  it("keeps admins in the admin workspace from public and student paths", () => {
    expect(adminWorkspaceRedirectFor(true, "/pricing")).toBe("/admin/dashboard");
    expect(adminWorkspaceRedirectFor(true, "/dashboard")).toBe("/admin/dashboard");
  });

  it("allows admins to stay on admin profile and pricing paths", () => {
    expect(adminWorkspaceRedirectFor(true, "/admin/profile")).toBeNull();
    expect(adminWorkspaceRedirectFor(true, "/admin/pricing")).toBeNull();
  });
});
