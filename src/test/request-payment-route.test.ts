import { beforeEach, describe, expect, it, vi } from "vitest";

const { startServiceRequestPayment, refreshStudentServiceRequestPaymentStatus } = vi.hoisted(
  () => ({
    startServiceRequestPayment: vi.fn(),
    refreshStudentServiceRequestPaymentStatus: vi.fn(),
  }),
);

vi.mock("@/lib/backend.server", () => ({
  startServiceRequestPayment,
  refreshStudentServiceRequestPaymentStatus,
}));

import { Route } from "@/routes/api.request-payment";

const handlers = Route.options.server?.handlers as unknown as {
  POST: (input: { request: Request }) => Promise<Response>;
  PATCH: (input: { request: Request }) => Promise<Response>;
};

function paymentRequest(
  method: "POST" | "PATCH",
  body: unknown,
  origin = "https://portal.example",
) {
  return new Request("https://portal.example/api/request-payment", {
    method,
    headers: {
      host: "portal.example",
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("service-request M-PESA route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startServiceRequestPayment.mockResolvedValue({ paymentId: "payment-1", status: "pending" });
    refreshStudentServiceRequestPaymentStatus.mockResolvedValue({ status: "paid" });
  });

  it("rejects cross-origin payment initiation before reaching the backend", async () => {
    const response = await handlers.POST({
      request: paymentRequest(
        "POST",
        { requestId: "00000000-0000-4000-8000-000000000001", phoneNumber: "0712345678" },
        "https://attacker.example",
      ),
    });

    expect(response.status).toBe(403);
    expect(startServiceRequestPayment).not.toHaveBeenCalled();
  });

  it("starts payment for a valid same-origin request", async () => {
    const requestId = "00000000-0000-4000-8000-000000000001";
    const response = await handlers.POST({
      request: paymentRequest("POST", { requestId, phoneNumber: "0712345678" }),
    });

    expect(response.status).toBe(202);
    expect(startServiceRequestPayment).toHaveBeenCalledWith({
      requestId,
      phoneNumber: "0712345678",
    });
  });

  it("reconciles an owned payment through the protected backend handler", async () => {
    const paymentId = "00000000-0000-4000-8000-000000000002";
    const response = await handlers.PATCH({ request: paymentRequest("PATCH", { paymentId }) });

    expect(response.status).toBe(200);
    expect(refreshStudentServiceRequestPaymentStatus).toHaveBeenCalledWith(paymentId);
    expect(await response.json()).toEqual({ status: "paid" });
  });
});
