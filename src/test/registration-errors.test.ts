import { describe, expect, it } from "vitest";
import {
  canUseAdminPortal,
  canUseStudentPortal,
  getDatabaseErrorCode,
  getSessionExpiration,
  isSessionIdleExpired,
  isAdminSignupConfigured,
} from "@/lib/backend.server";

describe("database error handling", () => {
  it("reads PostgreSQL unique-constraint error codes from wrapped causes", () => {
    const postgresError = Object.assign(new Error("duplicate"), { code: "23505" });
    const drizzleError = Object.assign(new Error("Failed query with params"), {
      cause: postgresError,
    });

    expect(getDatabaseErrorCode(drizzleError)).toBe("23505");
  });

  it("returns no code for errors without a database cause", () => {
    expect(getDatabaseErrorCode(new Error("unexpected failure"))).toBeUndefined();
  });

  it("handles cyclic causes without looping", () => {
    const error: { cause?: unknown; code?: string } = {};
    error.cause = error;

    expect(getDatabaseErrorCode(error)).toBeUndefined();
  });
});

describe("admin signup configuration", () => {
  it("requires a configured secret with at least 32 characters", () => {
    expect(isAdminSignupConfigured(undefined)).toBe(false);
    expect(isAdminSignupConfigured("x".repeat(31))).toBe(false);
    expect(isAdminSignupConfigured("x".repeat(32))).toBe(true);
  });
});

describe("session expiration policy", () => {
  it("limits administrator sessions to eight hours", () => {
    const now = 1_800_000_000_000;
    expect(getSessionExpiration(true, now).getTime()).toBe(now + 8 * 60 * 60 * 1000);
  });

  it("keeps student sessions at fourteen days", () => {
    const now = 1_800_000_000_000;
    expect(getSessionExpiration(false, now).getTime()).toBe(now + 14 * 24 * 60 * 60 * 1000);
  });

  it("expires student sessions after twenty minutes without activity", () => {
    const now = 1_800_000_000_000;
    const lastActivityAt = new Date(now - 20 * 60 * 1000);

    expect(isSessionIdleExpired(lastActivityAt, now)).toBe(true);
    expect(isSessionIdleExpired(new Date(now - 20 * 60 * 1000 + 1), now)).toBe(false);
  });
});

describe("student portal login roles", () => {
  it("allows student accounts", () => {
    expect(canUseStudentPortal(["student"])).toBe(true);
  });

  describe("administrator portal login roles", () => {
    it("allows only accounts with the administrator role", () => {
      expect(canUseAdminPortal(["admin"])).toBe(true);
      expect(canUseAdminPortal(["student"])).toBe(false);
      expect(canUseAdminPortal([])).toBe(false);
    });
  });

  it("blocks administrator accounts even if they also have a student role", () => {
    expect(canUseStudentPortal(["admin"])).toBe(false);
    expect(canUseStudentPortal(["admin", "student"])).toBe(false);
  });

  it("blocks accounts without a student role", () => {
    expect(canUseStudentPortal([])).toBe(false);
  });
});
