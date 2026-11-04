type MpesaConfig = {
  transactionType: "CustomerBuyGoodsOnline";
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
};

type StkPushInput = {
  phoneNumber: string;
  amount: number;
  tillNumber: string;
  accountReference: string;
  transactionDesc: string;
};

export type StkPushQueryResult = {
  ResponseCode?: number | string;
  ResultCode?: number | string;
  ResultDesc?: string;
  CheckoutRequestID?: string;
};

export type VerifiedMpesaCallbackDetails = {
  receiptNumber: string;
  transactionTimestamp: Date;
};

export class MpesaUncertainOutcomeError extends Error {
  constructor() {
    super("Safaricom's STK Push outcome is not yet known.");
    this.name = "MpesaUncertainOutcomeError";
  }
}

export function getMpesaDiagnosticCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("configuration is incomplete")) return "CONFIG_INCOMPLETE";
  if (message.includes("MPESA_ENV")) return "ENVIRONMENT_INVALID";
  if (message.includes("MPESA_TRANSACTION_TYPE")) return "TRANSACTION_TYPE_INVALID";
  if (message.includes("MPESA_STK_QUERY_ENABLED")) return "STK_QUERY_DISABLED";
  if (message.includes("MPESA_CALLBACK_URL")) return "CALLBACK_URL_INVALID";
  if (message.includes("MPESA_SHORTCODE")) return "SHORTCODE_INVALID";
  if (message.includes("payments are not configured")) return "NOT_CONFIGURED";
  if (message.includes("did not return an access token")) return "ACCESS_TOKEN_MISSING";
  if (message.includes("did not accept the M-PESA prompt")) return "STK_REJECTED";
  const authStatus = message.match(/M-Pesa authentication failed \((\d{3})\)/);
  if (authStatus) return `AUTH_HTTP_${authStatus[1]}`;
  const pushStatus = message.match(/M-Pesa STK Push failed \((\d{3})\)/);
  if (pushStatus) return `STK_HTTP_${pushStatus[1]}`;
  const queryStatus = message.match(/M-Pesa payment verification failed \((\d{3})\)/);
  if (queryStatus) return `QUERY_HTTP_${queryStatus[1]}`;
  if (error instanceof MpesaUncertainOutcomeError) return "OUTCOME_UNCERTAIN";
  return error instanceof Error ? error.name.replace(/[^A-Za-z0-9_]/g, "").slice(0, 40) : "UNKNOWN";
}

export function mapMpesaResultCodeToPurchaseStatus(
  resultCode: number | string,
  resultDesc?: string | undefined,
): "paid" | "cancelled" | "failed" | "pending" {
  const code = String(resultCode);
  if (code === "0") return "paid";
  if (code === "1032") return "cancelled";
  if (isMpesaResultPending(code, resultDesc)) return "pending";
  return "failed";
}

export function isMpesaResultPending(
  resultCode: number | string,
  resultDesc?: string | null | undefined,
) {
  const code = String(resultCode);
  return (
    code === "pending" ||
    code === "1037" ||
    code === "500.001.1001" ||
    /under processing|still processing|in progress/i.test(resultDesc ?? "")
  );
}

export function resolveMpesaVerificationResult(
  verification: StkPushQueryResult | null,
  checkoutRequestId: string,
  hasVerifiedSuccessCallback: boolean,
): StkPushQueryResult | null {
  const validQueryResult =
    verification !== null &&
    String(verification.ResponseCode) === "0" &&
    (!verification.CheckoutRequestID || verification.CheckoutRequestID === checkoutRequestId) &&
    verification.ResultCode !== undefined &&
    verification.ResultCode !== null;

  if (
    hasVerifiedSuccessCallback &&
    (!validQueryResult || isMpesaResultPending(verification.ResultCode!, verification.ResultDesc))
  ) {
    return {
      ResponseCode: "0",
      CheckoutRequestID: checkoutRequestId,
      ResultCode: 0,
      ResultDesc: "Payment confirmed by matching Safaricom callback details.",
    };
  }

  return validQueryResult ? verification : null;
}

export function getVerifiedMpesaCallbackDetails(
  callbackResponse: Record<string, unknown> | null | undefined,
  expected: {
    checkoutRequestId: string;
    merchantRequestId: string | null;
    amount: number;
    phoneNumber: string;
  },
): VerifiedMpesaCallbackDetails | null {
  const body = callbackResponse;
  const bodyContent = body?.["Body"];
  if (!bodyContent || typeof bodyContent !== "object") return null;
  const callback = (bodyContent as Record<string, unknown>)["stkCallback"];
  if (!callback || typeof callback !== "object") return null;
  const result = callback as Record<string, unknown>;
  if (
    result["CheckoutRequestID"] !== expected.checkoutRequestId ||
    result["MerchantRequestID"] !== expected.merchantRequestId ||
    Number(result["ResultCode"]) !== 0
  ) {
    return null;
  }
  const metadata = result["CallbackMetadata"];
  if (!metadata || typeof metadata !== "object") return null;
  const itemList = (metadata as Record<string, unknown>)["Item"];
  if (!Array.isArray(itemList)) return null;
  const valueFor = (name: string) => {
    const item = itemList.find(
      (candidate) =>
        candidate !== null &&
        typeof candidate === "object" &&
        (candidate as Record<string, unknown>)["Name"] === name,
    );
    return item && typeof item === "object"
      ? (item as Record<string, unknown>)["Value"]
      : undefined;
  };
  const amountValue = valueFor("Amount");
  const phoneValue = valueFor("PhoneNumber");
  const receiptValue = valueFor("MpesaReceiptNumber");
  const dateValue = valueFor("TransactionDate");
  const dateText =
    typeof dateValue === "number" && Number.isSafeInteger(dateValue)
      ? String(dateValue)
      : dateValue;
  if (
    (typeof amountValue !== "number" && typeof amountValue !== "string") ||
    Number(amountValue) !== expected.amount ||
    (typeof phoneValue !== "number" && typeof phoneValue !== "string") ||
    String(phoneValue) !== expected.phoneNumber ||
    typeof receiptValue !== "string" ||
    !/^[A-Z0-9]{8,12}$/i.test(receiptValue.trim()) ||
    typeof dateText !== "string" ||
    !/^\d{14}$/.test(dateText)
  ) {
    return null;
  }
  const transactionTimestamp = new Date(
    `${dateText.slice(0, 4)}-${dateText.slice(4, 6)}-${dateText.slice(6, 8)}T${dateText.slice(8, 10)}:${dateText.slice(10, 12)}:${dateText.slice(12, 14)}+03:00`,
  );
  if (!Number.isFinite(transactionTimestamp.getTime())) return null;
  return { receiptNumber: receiptValue.trim(), transactionTimestamp };
}

export function getMpesaConfig(shortcodeOverride?: string): MpesaConfig | null {
  const consumerKey = process.env["MPESA_CONSUMER_KEY"]?.trim() ?? "";
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"]?.trim() ?? "";
  const shortcode = shortcodeOverride?.trim() || process.env["MPESA_SHORTCODE"]?.trim() || "";
  const passkey = process.env["MPESA_PASSKEY"]?.trim() ?? "";
  const callbackUrl = process.env["MPESA_CALLBACK_URL"]?.trim() ?? "";
  const environment = process.env["MPESA_ENV"]?.trim();
  const transactionType = process.env["MPESA_TRANSACTION_TYPE"]?.trim();
  const queryEnabled = process.env["MPESA_STK_QUERY_ENABLED"]?.trim();
  const values = [consumerKey, consumerSecret, shortcode, passkey, callbackUrl];

  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) {
    throw new Error(
      "M-Pesa configuration is incomplete. Set all MPESA_* credentials and callback URL.",
    );
  }
  if (environment !== "production") {
    throw new Error("MPESA_ENV must be production. Sandbox payments are not supported.");
  }
  if (transactionType !== "CustomerBuyGoodsOnline") {
    throw new Error(
      "MPESA_TRANSACTION_TYPE must be CustomerBuyGoodsOnline for a registered store.",
    );
  }
  if (!/^\d{5,7}$/.test(shortcode)) {
    throw new Error("MPESA_SHORTCODE must be the registered M-PESA Store Number.");
  }
  if (queryEnabled !== "true") {
    throw new Error("MPESA_STK_QUERY_ENABLED must be true for production payments.");
  }

  try {
    if (new URL(callbackUrl).protocol !== "https:") {
      throw new Error("Callback URL must use HTTPS.");
    }
  } catch {
    throw new Error("MPESA_CALLBACK_URL must be an absolute HTTPS URL.");
  }

  return {
    transactionType,
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    callbackUrl,
  };
}

export function normalizeMpesaPhoneNumber(value: string) {
  const compact = value.trim().replace(/[\s()+-]/g, "");
  const normalized = compact.startsWith("0")
    ? `254${compact.slice(1)}`
    : /^[17]\d{8}$/.test(compact)
      ? `254${compact}`
      : compact;
  if (!/^254[17]\d{8}$/.test(normalized)) {
    throw new Error("Enter a valid Kenyan M-PESA phone number, such as 0712345678.");
  }
  return normalized;
}

function timestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values["year"]}${values["month"]}${values["day"]}${values["hour"]}${values["minute"]}${values["second"]}`;
}

export async function initiateMpesaStkPush(input: StkPushInput) {
  const config = getMpesaConfig();
  if (!config) throw new Error("M-Pesa payments are not configured.");
  if (!/^\d{5,7}$/.test(input.tillNumber)) {
    throw new Error("The M-PESA Till Number is not configured correctly.");
  }
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 150_000) {
    throw new Error("M-Pesa amount must be a whole number of KES between 1 and 150,000.");
  }
  if (!/^254[17]\d{8}$/.test(input.phoneNumber)) {
    throw new Error("Enter a Safaricom phone number in 2547XXXXXXXX format.");
  }
  if (!/^[\w-]{1,12}$/.test(input.accountReference)) {
    throw new Error("M-Pesa account reference must be 1-12 letters, numbers, _ or -.");
  }
  if (!input.transactionDesc.trim() || input.transactionDesc.length > 13) {
    throw new Error("M-Pesa transaction description must be 1-13 characters.");
  }

  const baseUrl = "https://api.safaricom.co.ke";
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString(
    "base64",
  );
  const tokenResponse = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenResponse.ok) throw new Error(`M-Pesa authentication failed (${tokenResponse.status}).`);
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error("M-Pesa did not return an access token.");

  const requestTimestamp = timestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${requestTimestamp}`).toString(
    "base64",
  );
  let pushResponse: Response;
  try {
    pushResponse = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokenData.access_token}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        BusinessShortCode: config.shortcode,
        Password: password,
        Timestamp: requestTimestamp,
        TransactionType: config.transactionType,
        Amount: input.amount,
        PartyA: input.phoneNumber,
        PartyB: input.tillNumber,
        PhoneNumber: input.phoneNumber,
        CallBackURL: config.callbackUrl,
        AccountReference: input.accountReference,
        TransactionDesc: input.transactionDesc.trim(),
      }),
    });
  } catch {
    throw new MpesaUncertainOutcomeError();
  }
  if (!pushResponse.ok) {
    if (pushResponse.status >= 500) throw new MpesaUncertainOutcomeError();
    throw new Error(`M-Pesa STK Push failed (${pushResponse.status}).`);
  }
  let result: {
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResponseCode: string;
    ResponseDescription: string;
    CustomerMessage: string;
  };
  try {
    result = (await pushResponse.json()) as typeof result;
  } catch {
    throw new MpesaUncertainOutcomeError();
  }
  if (result.ResponseCode !== "0") throw new Error("Safaricom did not accept the M-PESA prompt.");
  if (!result.CheckoutRequestID || !result.MerchantRequestID) {
    throw new MpesaUncertainOutcomeError();
  }
  return result;
}

export async function queryMpesaStkPush(checkoutRequestId: string, merchantShortcode?: string) {
  const config = getMpesaConfig(merchantShortcode);
  if (!config) throw new Error("M-Pesa payments are not configured.");
  if (!/^[\w-]{1,100}$/.test(checkoutRequestId)) {
    throw new Error("Invalid M-Pesa checkout reference.");
  }

  const baseUrl = "https://api.safaricom.co.ke";
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString(
    "base64",
  );
  const tokenResponse = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenResponse.ok) {
    throw new Error(`M-Pesa authentication failed (${tokenResponse.status}).`);
  }
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error("M-Pesa did not return an access token.");

  const requestTimestamp = timestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${requestTimestamp}`).toString(
    "base64",
  );
  const response = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenData.access_token}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: requestTimestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  if (!response.ok) throw new Error(`M-Pesa payment verification failed (${response.status}).`);
  return (await response.json()) as StkPushQueryResult;
}
