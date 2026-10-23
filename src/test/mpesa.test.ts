import { afterEach, describe, expect, it, vi } from "vitest";
import { getMpesaConfig, initiateMpesaStkPush } from "@/lib/mpesa.server";

const mpesaEnv = [
  "MPESA_ENVIRONMENT",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_PASSKEY",
  "MPESA_CALLBACK_URL",
] as const;

function stubCompleteConfig() {
  vi.stubEnv("MPESA_ENVIRONMENT", "sandbox");
  vi.stubEnv("MPESA_CONSUMER_KEY", "consumer-key");
  vi.stubEnv("MPESA_CONSUMER_SECRET", "consumer-secret");
  vi.stubEnv("MPESA_SHORTCODE", "174379");
  vi.stubEnv("MPESA_PASSKEY", "passkey");
  vi.stubEnv("MPESA_CALLBACK_URL", "https://example.com/api/payments/mpesa/callback");
}

describe("M-Pesa configuration", () => {
  afterEach(() => {
    for (const key of mpesaEnv) vi.stubEnv(key, "");
    vi.unstubAllEnvs();
  });

  it("remains disabled when credentials are absent", () => {
    for (const key of mpesaEnv) vi.stubEnv(key, "");
    expect(getMpesaConfig()).toBeNull();
  });

  it("rejects partial configuration", () => {
    vi.stubEnv("MPESA_CONSUMER_KEY", "consumer-key");
    expect(() => getMpesaConfig()).toThrow(/configuration is incomplete/);
  });

  it("accepts complete sandbox configuration", () => {
    stubCompleteConfig();
    expect(getMpesaConfig()).toMatchObject({
      environment: "sandbox",
      shortcode: "174379",
      callbackUrl: "https://example.com/api/payments/mpesa/callback",
    });
  });

  it("rejects invalid checkout details before making a request", async () => {
    stubCompleteConfig();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      initiateMpesaStkPush({
        phoneNumber: "0712345678",
        amount: 100,
        accountReference: "SD-123",
        transactionDesc: "ScholarDesk",
      }),
    ).rejects.toThrow(/Safaricom phone number/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
