import { createFileRoute } from "@tanstack/react-router";
import { refreshStudentLibraryPurchaseStatus, startLibraryPurchase } from "@/lib/backend.server";
import { requireSameOrigin } from "@/lib/backend";
import {
  InvalidRequestBodyError,
  parseJsonRequestBody,
  RequestBodyTooLargeError,
} from "@/lib/form-data.server";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not start library checkout.";
  const status =
    error instanceof RequestBodyTooLargeError
      ? 413
      : error instanceof InvalidRequestBodyError
        ? 400
        : message.includes("signed in")
          ? 401
          : message.includes("Student library")
            ? 403
            : message.includes("not found")
              ? 404
              : message.includes("not configured")
                ? 503
                : message.includes("phone number") ||
                    message.includes("price") ||
                    message.includes("free")
                  ? 400
                  : 500;
  if (status === 500) console.error("Library checkout failed.", error);
  return Response.json(
    { error: status === 500 ? "Could not start library checkout." : message },
    { status },
  );
}

export const Route = createFileRoute("/api/library/purchase")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const body = await parseJsonRequestBody(request, 16 * 1024);
          const resourceId =
            typeof body === "object" &&
            body !== null &&
            "resourceId" in body &&
            typeof body.resourceId === "string"
              ? body.resourceId
              : "";
          const phoneNumber =
            typeof body === "object" &&
            body !== null &&
            "phoneNumber" in body &&
            typeof body.phoneNumber === "string"
              ? body.phoneNumber
              : "";
          if (!/^[0-9a-f-]{36}$/i.test(resourceId)) {
            return Response.json({ error: "Choose a valid library resource." }, { status: 400 });
          }
          const result = await startLibraryPurchase({ resourceId, phoneNumber });
          return Response.json(result, { status: 202 });
        } catch (error) {
          return errorResponse(error);
        }
      },
      PATCH: async ({ request }) => {
        try {
          requireSameOrigin(request);
          const body = await parseJsonRequestBody(request, 16 * 1024);
          const purchaseId =
            typeof body === "object" &&
            body !== null &&
            "purchaseId" in body &&
            typeof body.purchaseId === "string"
              ? body.purchaseId
              : "";
          if (!/^[0-9a-f-]{36}$/i.test(purchaseId)) {
            return Response.json({ error: "Invalid purchase." }, { status: 400 });
          }
          return Response.json(await refreshStudentLibraryPurchaseStatus(purchaseId));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
