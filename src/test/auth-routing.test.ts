import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUserStateFn: vi.fn() }));

vi.mock("@/lib/backend", () => ({
  getCurrentUserStateFn: mocks.getCurrentUserStateFn,
  getProfileFn: vi.fn(),
}));

import {
  adminWorkspaceRedirectFor,
  dashboardRouteFor,
  getSafeReturnTo,
  useIsAdmin,
  useUser,
} from "@/lib/auth";

describe("post-login routing", () => {
  it("preserves an internal request destination and its query", () => {
    expect(getSafeReturnTo("/request/request-1?tab=files", "/dashboard")).toBe(
      "/request/request-1?tab=files",
    );
  });

  it("rejects external destinations and authentication loops", () => {
    expect(getSafeReturnTo("https://attacker.example/", "/dashboard")).toBe("/dashboard");
    expect(getSafeReturnTo("//attacker.example/", "/dashboard")).toBe("/dashboard");
    expect(getSafeReturnTo("/auth?mode=login", "/dashboard")).toBe("/dashboard");
  });
});

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

describe("shared session query", () => {
  it("loads user and admin status from one server request", async () => {
    const user = { id: "user-1", email: "student@example.test" };
    mocks.getCurrentUserStateFn.mockResolvedValue({
      user,
      isAdmin: true,
      expiresAt: "2026-11-14T00:00:00.000Z",
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const { result, unmount } = renderHook(
      () => {
        const currentUser = useUser();
        const admin = useIsAdmin(currentUser.user?.id);
        return { currentUser, admin };
      },
      { wrapper },
    );

    await waitFor(() => expect(result.current.admin.data).toBe(true));

    expect(result.current.currentUser.user).toEqual(user);
    expect(mocks.getCurrentUserStateFn).toHaveBeenCalledOnce();
    unmount();
    queryClient.clear();
  });
});
