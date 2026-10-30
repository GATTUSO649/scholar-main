import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMpesaConfig,
  initiateMpesaStkPush,
  mapMpesaResultCodeToPurchaseStatus,
  normalizeMpesaPhoneNumber,
  queryMpesaStkPush,
} from "@/lib/mpesa.server";

const mpesaEnv = [
  "MPESA_ENV",
  "MPESA_STK_QUERY_ENABLED",
  "MPESA_TRANSACTION_TYPE",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_PASSKEY",
  "MPESA_CALLBACK_URL",
] as const;

function stubCompleteConfig() {
  vi.stubEnv("MPESA_ENV", "production");
  vi.stubEnv("MPESA_STK_QUERY_ENABLED", "true");
  vi.stubEnv("MPESA_TRANSACTION_TYPE", "CustomerBuyGoodsOnline");
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

  it("accepts complete production till configuration", () => {
    stubCompleteConfig();
    expect(getMpesaConfig()).toMatchObject({
      transactionType: "CustomerBuyGoodsOnline",
      shortcode: "174379",
      callbackUrl: "https://example.com/api/library/callback",
    });
  });

  it("rejects unsupported transaction types", () => {
    stubCompleteConfig();
    vi.stubEnv("MPESA_TRANSACTION_TYPE", "UnsupportedTransaction");
    expect(() => getMpesaConfig()).toThrow(/MPESA_TRANSACTION_TYPE/);
  });

  it("rejects sandbox configuration instead of falling back", () => {
    stubCompleteConfig();
    vi.stubEnv("MPESA_ENV", "sandbox");
    expect(() => getMpesaConfig()).toThrow(/must be production/);
  });

  it("requires STK Query verification to be enabled", () => {
    stubCompleteConfig();
    vi.stubEnv("MPESA_STK_QUERY_ENABLED", "false");
    expect(() => getMpesaConfig()).toThrow(/MPESA_STK_QUERY_ENABLED must be true/);
  });

  it("normalizes Kenyan phone numbers to Safaricom format", () => {
    expect(normalizeMpesaPhoneNumber("0712 345 678")).toBe("254712345678");
    expect(normalizeMpesaPhoneNumber("+254 112 345 678")).toBe("254112345678");
    expect(() => normalizeMpesaPhoneNumber("12345")).toThrow(/valid Kenyan M-PESA phone/);
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

  it("rejects amounts above the supported checkout limit", async () => {
    stubCompleteConfig();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      initiateMpesaStkPush({
        phoneNumber: "254712345678",
        amount: 150_001,
        accountReference: "LIB-123",
        transactionDesc: "LIBRARY",
      }),
    ).rejects.toThrow(/between 1 and 150,000/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("sends a Buy Goods STK push to Daraja production with the configured callback", async () => {
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

    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    );
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: `Basic ${Buffer.from("consumer-key:consumer-secret").toString("base64")}`,
    });
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
      "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    );
    const requestBody = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as {
      BusinessShortCode: string;
      CallBackURL: string;
      Amount: number;
      PhoneNumber: string;
      TransactionType: string;
      PartyA: string;
      PartyB: string;
    };
    expect(requestBody).toMatchObject({
      BusinessShortCode: "174379",
      CallBackURL: "https://example.com/api/library/callback",
      Amount: 500,
      PhoneNumber: "254712345678",
      PartyA: "254712345678",
      PartyB: "174379",
      TransactionType: "CustomerBuyGoodsOnline",
    });
    fetchSpy.mockRestore();
  });

  it("does not treat a nonzero STK response as an accepted prompt", async () => {
    stubCompleteConfig();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ResponseCode: "1" }), { status: 200 }));
    await expect(
      initiateMpesaStkPush({
        phoneNumber: "254712345678",
        amount: 500,
        accountReference: "LIB-123",
        transactionDesc: "LIBRARY",
      }),
    ).rejects.toThrow(/did not accept/);
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
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query",
    );
    const queryBody = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as {
      BusinessShortCode: string;
      CheckoutRequestID: string;
    };
    expect(queryBody).toMatchObject({
      BusinessShortCode: "174379",
      CheckoutRequestID: "ws_CO_test",
    });
    fetchSpy.mockRestore();
  });
});

describe("M-Pesa checkout result mapping", () => {
  it("reports user-cancelled prompts separately from failed payments", () => {
    expect(mapMpesaResultCodeToPurchaseStatus(1032)).toBe("cancelled");
    expect(mapMpesaResultCodeToPurchaseStatus("0")).toBe("paid");
    expect(mapMpesaResultCodeToPurchaseStatus(1)).toBe("failed");
  });
});
