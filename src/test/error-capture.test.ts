import { describe, expect, it } from "vitest";
import { describeError } from "@/lib/error-capture";

describe("production error logging", () => {
  it("omits error messages and stacks in production", () => {
    const previous = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    try {
      const message = describeError(new Error("query params: private@example.com"));
      expect(message).toContain("Error");
      expect(message).not.toContain("private@example.com");
      expect(message).not.toContain("query params");
    } finally {
      if (previous === undefined) delete process.env["NODE_ENV"];
      else process.env["NODE_ENV"] = previous;
    }
  });

  it("retains error details in development", () => {
    const previous = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";
    try {
      expect(describeError(new Error("database query failed"))).toContain("database query failed");
    } finally {
      if (previous === undefined) delete process.env["NODE_ENV"];
      else process.env["NODE_ENV"] = previous;
    }
  });
});
