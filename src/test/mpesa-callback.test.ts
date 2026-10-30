import { beforeEach, describe, expect, it, vi } from "vitest";

const { handleLibraryPurchaseCallback } = vi.hoisted(() => ({
  handleLibraryPurchaseCallback: vi.fn(),
}));

vi.mock("@/lib/backend.server", () => ({ handleLibraryPurchaseCallback }));

import { Route } from "@/routes/api.library.callback";
import { parseJsonRequestBody } from "@/lib/form-data.server";

const post = Route.options.server?.handlers?.POST as unknown as (input: {
  request: Request;
}) => Promise<Response>;

function callbackRequest(body: unknown) {
  return new Request("https://portal.example/api/library/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function successfulCallback() {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "merchant-1",
        CheckoutRequestID: "ws_CO_1",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 500 },
            { Name: "MpesaReceiptNumber", Value: "QWE1234567" },
            { Name: "TransactionDate", Value: 20261030120000 },
            { Name: "PhoneNumber", Value: 254712345678 },
          ],
        },
      },
    },
  };
}

describe("M-PESA payment callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleLibraryPurchaseCallback.mockResolvedValue({ status: "paid" });
  });

  it("rejects malformed callback structures", async () => {
    const response = await post({ request: callbackRequest({ Body: {} }) });

    expect(response.status).toBe(400);
    expect(handleLibraryPurchaseCallback).not.toHaveBeenCalled();
  });

  it("extracts and forwards genuine callback payment fields for provider verification", async () => {
    const body = successfulCallback();
    const request = callbackRequest(body);
    await expect(request.clone().text()).resolves.toBe(JSON.stringify(body));
    await expect(parseJsonRequestBody(request, 64 * 1024)).resolves.toEqual(body);
    const response = await post({ request: callbackRequest(body) });
    const sent = handleLibraryPurchaseCallback.mock.calls[0]?.[0] as {
      checkoutRequestId: string;
      merchantRequestId: string;
      resultCode: number;
      amount: number;
      customerPhone: string;
      receiptNumber: string;
      transactionTimestamp: Date;
      callbackResponse: unknown;
    };

    expect(await response.clone().json()).toEqual({
      ResultCode: 0,
      ResultDesc: "Callback accepted.",
    });
    expect(response.status).toBe(200);
    expect(sent).toMatchObject({
      checkoutRequestId: "ws_CO_1",
      merchantRequestId: "merchant-1",
      resultCode: 0,
      amount: 500,
      customerPhone: "254712345678",
      receiptNumber: "QWE1234567",
      callbackResponse: body,
    });
    expect(sent.transactionTimestamp.toISOString()).toBe("2026-10-30T09:00:00.000Z");
  });

  it("passes duplicate callback deliveries to the idempotent transaction handler", async () => {
    const body = successfulCallback();

    const first = await post({ request: callbackRequest(body) });
    const second = await post({ request: callbackRequest(body) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(handleLibraryPurchaseCallback).toHaveBeenCalledTimes(2);
    expect(handleLibraryPurchaseCallback.mock.calls[0]?.[0]).toEqual(
      handleLibraryPurchaseCallback.mock.calls[1]?.[0],
    );
  });
});
