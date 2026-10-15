import { describe, expect, it } from "vitest";
import { getDatabaseErrorCode } from "@/lib/backend.server";

describe("database error handling", () => {
  it("reads MySQL error codes from Drizzle's wrapped cause", () => {
    const mysqlError = Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
    const drizzleError = Object.assign(new Error("Failed query with params"), {
      cause: mysqlError,
    });

    expect(getDatabaseErrorCode(drizzleError)).toBe("ER_DUP_ENTRY");
  });

  it("returns no code for errors without a MySQL cause", () => {
    expect(getDatabaseErrorCode(new Error("unexpected failure"))).toBeUndefined();
  });

  it("handles cyclic causes without looping", () => {
    const error: { cause?: unknown; code?: string } = {};
    error.cause = error;

    expect(getDatabaseErrorCode(error)).toBeUndefined();
  });
});