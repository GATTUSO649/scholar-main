import { describe, expect, it } from "vitest";
import {
  buildAppUrl,
  genericEmailRequestResponse,
  getEmailConfig,
  isEmailVerificationRequired,
} from "@/lib/email.server";

describe("email configuration and verification settings", () => {
  it("returns a disabled config when SMTP credentials are missing", () => {
    const config = getEmailConfig({
      SMTP_HOST: "",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "",
      SMTP_PASS: "",
      SMTP_FROM: "",
      EMAIL_FROM_NAME: "",
      APP_URL: "",
    });

    expect(config.enabled).toBe(false);
    expect(config.reason).toBe("missing_smtp_configuration");
  });

  it("supports the legacy and current SMTP variable names", () => {
    const config = getEmailConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "mailer",
      SMTP_PASS: "secret",
      SMTP_FROM: "ScholarDesk <noreply@example.com>",
      EMAIL_FROM_NAME: "Example Portal",
      APP_URL: "https://portal.example.com",
    });

    expect(config.enabled).toBe(true);
    expect(config.from).toBe("ScholarDesk <noreply@example.com>");
    expect(config.appUrl).toBe("https://portal.example.com");
  });

  it("defaults to Brevo's alternate SMTP port when no port is configured", () => {
    const config = getEmailConfig({
      SMTP_HOST: "smtp-relay.brevo.com",
      SMTP_USER: "mailer",
      SMTP_PASS: "secret",
      EMAIL_FROM: "noreply@example.com",
    });

    expect(config.port).toBe(2525);
  });

  it("uses the same public response for email recovery requests", () => {
    expect(genericEmailRequestResponse()).toEqual({ requested: true });
  });

  it("builds an HTTPS app URL for production and preserves localhost in development", () => {
    expect(buildAppUrl({ NODE_ENV: "production", APP_URL: "https://portal.example.com" })).toBe(
      "https://portal.example.com",
    );
    expect(buildAppUrl({ NODE_ENV: "development", APP_URL: "http://localhost:8080" })).toBe(
      "http://localhost:8080",
    );
  });

  it("requires email verification when the environment explicitly asks for it", () => {
    expect(isEmailVerificationRequired({ REQUIRE_EMAIL_VERIFICATION: "true" })).toBe(true);
    expect(isEmailVerificationRequired({ REQUIRE_EMAIL_VERIFICATION: "false" })).toBe(false);
    expect(isEmailVerificationRequired({})).toBe(false);
  });
});
