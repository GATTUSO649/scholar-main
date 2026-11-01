import { createFileRoute } from "@tanstack/react-router";
import {
  refreshStudentServiceRequestPaymentStatus,
  startServiceRequestPayment,
} from "@/lib/backend.server";
import { requireSameOrigin } from "@/lib/backend";
import {
  InvalidRequestBodyError,
  parseJsonRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/form-data.server";
import { getMpesaDiagnosticCode } from "@/lib/mpesa.server";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not process request payment.";
  const status =
    error instanceof RequestBodyTooLargeError
      ? 413
      : error instanceof InvalidRequestBodyError
        ? 400
        : message.includes("Too many recent payment attempts")
          ? 429
          : message.includes("signed in")
            ? 401
            : message.includes("origin is not allowed")
              ? 403
              : message.includes("Student library")
                ? 403
                : message.includes("not found")
                  ? 404
                  : message.includes("not configured") || message.includes("configuration")
                    ? 503
                    : message.includes("phone number") ||
                        message.includes("quote") ||
                        message.includes("payment is not available")
                      ? 400
                      : 500;
  if (status >= 500) {
    console.error("Service request payment failed.", {
      diagnostic: getMpesaDiagnosticCode(error),
      status,
    });
  }
  return Response.json(
    {
      error:
        status === 500
          ? "Could not process request payment."
          : status === 503
            ? "M-PESA payments are temporarily unavailable. Please try again later."
            : message,
    },
    { status },
  );
}

export const Route = createFileRoute("/api/request-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const body = await parseJsonRequestBody(request, 16 * 1024);
          const requestId =
            typeof body === "object" &&
            body !== null &&
            "requestId" in body &&
            typeof body.requestId === "string"
              ? body.requestId
              : "";
          const phoneNumber =
            typeof body === "object" &&
            body !== null &&
            "phoneNumber" in body &&
            typeof body.phoneNumber === "string"
              ? body.phoneNumber
              : "";
          if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
            return Response.json({ error: "Choose a valid request." }, { status: 400 });
          }
          return Response.json(await startServiceRequestPayment({ requestId, phoneNumber }), {
            status: 202,
          });
        } catch (error) {
          return errorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const body = await parseJsonRequestBody(request, 16 * 1024);
          const paymentId =
            typeof body === "object" &&
            body !== null &&
            "paymentId" in body &&
            typeof body.paymentId === "string"
              ? body.paymentId
              : "";
          if (!/^[0-9a-f-]{36}$/i.test(paymentId)) {
            return Response.json({ error: "Invalid payment." }, { status: 400 });
          }
          return Response.json(await refreshStudentServiceRequestPaymentStatus(paymentId));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
