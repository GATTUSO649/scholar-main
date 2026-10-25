import { createFileRoute } from "@tanstack/react-router";
import { handleLibraryPurchaseCallback } from "@/lib/backend.server";

type CallbackItem = { Name?: string; Value?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const Route = createFileRoute("/api/library/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body: unknown = await request.json();
          const callback =
            isRecord(body) && isRecord(body["Body"]) ? body["Body"]["stkCallback"] : null;
          if (!isRecord(callback) || typeof callback["CheckoutRequestID"] !== "string") {
            return Response.json({ ResultCode: 0, ResultDesc: "Callback ignored." });
          }

          const metadata = isRecord(callback["CallbackMetadata"])
            ? callback["CallbackMetadata"]["Item"]
            : null;
          const items = Array.isArray(metadata) ? (metadata as CallbackItem[]) : [];
          const valueFor = (name: string) => items.find((item) => item.Name === name)?.Value;
          const rawResultCode = callback["ResultCode"];
          const resultCode =
            typeof rawResultCode === "number" ? rawResultCode : Number(rawResultCode);
          if (!Number.isFinite(resultCode)) {
            return Response.json({ ResultCode: 0, ResultDesc: "Callback ignored." });
          }
          const amountValue = valueFor("Amount");
          const amount = amountValue == null ? undefined : Number(amountValue);
          const receiptValue = valueFor("MpesaReceiptNumber");

          await handleLibraryPurchaseCallback({
            checkoutRequestId: callback["CheckoutRequestID"],
            resultCode,
            ...(amount !== undefined && Number.isFinite(amount) ? { amount } : {}),
            ...(typeof receiptValue === "string" ? { receiptNumber: receiptValue } : {}),
          });
          return Response.json({ ResultCode: 0, ResultDesc: "Callback accepted." });
        } catch (error) {
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
