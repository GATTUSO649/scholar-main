import { afterEach, describe, expect, it, vi } from "vitest";
import { getMpesaConfig, initiateMpesaStkPush, queryMpesaStkPush } from "@/lib/mpesa.server";

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
  vi.stubEnv("MPESA_CALLBACK_URL", "https://example.com/api/library/callback");
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

  it("requires an HTTPS callback URL", () => {
    stubCompleteConfig();
    vi.stubEnv("MPESA_CALLBACK_URL", "http://example.com/api/library/callback");
    expect(() => getMpesaConfig()).toThrow(/absolute HTTPS URL/);
  });

  it("accepts complete sandbox configuration", () => {
    stubCompleteConfig();
    expect(getMpesaConfig()).toMatchObject({
      environment: "sandbox",
      shortcode: "174379",
      callbackUrl: "https://example.com/api/library/callback",
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

  it("sends an STK push to Daraja sandbox with the configured callback", async () => {
    stubCompleteConfig();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            MerchantRequestID: "merchant-request",
            CheckoutRequestID: "ws_CO_test",
            ResponseCode: "0",
            ResponseDescription: "Success",
            CustomerMessage: "Prompt sent",
          }),
          { status: 200 },
        ),
      );

    await expect(
      initiateMpesaStkPush({
        phoneNumber: "254712345678",
        amount: 500,
        accountReference: "LIB-123",
        transactionDesc: "LIBRARY",
      }),
    ).resolves.toMatchObject({ CheckoutRequestID: "ws_CO_test" });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("https://sandbox.safaricom.co.ke");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    );
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as {
      BusinessShortCode: string;
      CallBackURL: string;
      Amount: number;
      PhoneNumber: string;
    };
    expect(requestBody).toMatchObject({
      BusinessShortCode: "174379",
      CallBackURL: "https://example.com/api/library/callback",
      Amount: 500,
      PhoneNumber: "254712345678",
    });
    fetchSpy.mockRestore();
  });

  it("rejects malformed STK query references before making a request", async () => {
    stubCompleteConfig();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(queryMpesaStkPush("invalid reference")).rejects.toThrow(
      /Invalid M-Pesa checkout reference/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("queries Safaricom for an STK checkout result", async () => {
    stubCompleteConfig();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ResponseCode: "0", ResultCode: 0, CheckoutRequestID: "ws_CO_test" }),
          { status: 200 },
        ),
      );

    await expect(queryMpesaStkPush("ws_CO_test")).resolves.toMatchObject({
      ResponseCode: "0",
      ResultCode: 0,
      CheckoutRequestID: "ws_CO_test",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("/mpesa/stkpushquery/v1/query");
    fetchSpy.mockRestore();
  });
});
