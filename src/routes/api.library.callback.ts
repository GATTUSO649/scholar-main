import { createFileRoute } from "@tanstack/react-router";
import { handleLibraryPurchaseCallback } from "@/lib/backend.server";
import {
  InvalidRequestBodyError,
  parseJsonRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/form-data.server";

type CallbackItem = { Name?: unknown; Value?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTransactionDate(value: unknown) {
  const raw = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof raw !== "string" || !/^\d{14}$/.test(raw)) return undefined;
  const timestamp = new Date(
    `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12)}:${raw.slice(12, 14)}+03:00`,
  );
  return Number.isFinite(timestamp.getTime()) ? timestamp : undefined;
}

export const Route = createFileRoute("/api/library/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await parseJsonRequestBody(request, 64 * 1024);
          const callback =
            isRecord(body) && isRecord(body["Body"]) ? body["Body"]["stkCallback"] : null;
          if (
            !isRecord(body) ||
            !isRecord(callback) ||
            typeof callback["CheckoutRequestID"] !== "string" ||
            callback["CheckoutRequestID"].length > 100 ||
            typeof callback["MerchantRequestID"] !== "string" ||
            callback["MerchantRequestID"].length > 100
          ) {
            return Response.json(
              { ResultCode: 1, ResultDesc: "Invalid payment callback." },
              { status: 400 },
            );
          }

          const metadata = isRecord(callback["CallbackMetadata"])
            ? callback["CallbackMetadata"]["Item"]
            : null;
          const items = Array.isArray(metadata) ? (metadata as CallbackItem[]) : [];
          const valueFor = (name: string) =>
            items.find((item) => isRecord(item) && item.Name === name)?.Value;
          const rawResultCode = callback["ResultCode"];
          const resultCode =
            typeof rawResultCode === "number" ? rawResultCode : Number(rawResultCode);
          if (!Number.isSafeInteger(resultCode)) {
            return Response.json(
              { ResultCode: 1, ResultDesc: "Invalid payment callback." },
              { status: 400 },
            );
          }
          const amountValue = valueFor("Amount");
          const amount =
            typeof amountValue === "number" || typeof amountValue === "string"
              ? Number(amountValue)
              : undefined;
          const receiptValue = valueFor("MpesaReceiptNumber");
          const phoneValue = valueFor("PhoneNumber");
          const transactionDate = parseTransactionDate(valueFor("TransactionDate"));

          await handleLibraryPurchaseCallback({
            checkoutRequestId: callback["CheckoutRequestID"],
            merchantRequestId: callback["MerchantRequestID"],
            resultCode,
            resultDesc:
              typeof callback["ResultDesc"] === "string"
                ? callback["ResultDesc"].slice(0, 255)
                : "Payment callback received.",
            ...(amount !== undefined && Number.isFinite(amount) ? { amount } : {}),
            ...(typeof phoneValue === "string" || typeof phoneValue === "number"
              ? { customerPhone: String(phoneValue) }
              : {}),
            ...(typeof receiptValue === "string" ? { receiptNumber: receiptValue } : {}),
            ...(transactionDate ? { transactionTimestamp: transactionDate } : {}),
            callbackResponse: body,
          });
          return Response.json({ ResultCode: 0, ResultDesc: "Callback accepted." });
        } catch (error) {
          if (error instanceof RequestBodyTooLargeError) {
            return Response.json(
              { ResultCode: 1, ResultDesc: "Callback body too large." },
              { status: 413 },
            );
          }
          if (error instanceof InvalidRequestBodyError) {
            return Response.json(
              { ResultCode: 1, ResultDesc: "Invalid callback body." },
              { status: 400 },
            );
          }
          console.error("Library payment callback processing failed.", error);
          return Response.json(
            { ResultCode: 1, ResultDesc: "Callback processing failed." },
            { status: 500 },
          );
        }
      },
    },
  },
});
