type MpesaConfig = {
  environment: "sandbox" | "production";
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
};

type StkPushInput = {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
};

export function getMpesaConfig(): MpesaConfig | null {
  const consumerKey = process.env["MPESA_CONSUMER_KEY"]?.trim() ?? "";
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"]?.trim() ?? "";
  const shortcode = process.env["MPESA_SHORTCODE"]?.trim() ?? "";
  const passkey = process.env["MPESA_PASSKEY"]?.trim() ?? "";
  const callbackUrl = process.env["MPESA_CALLBACK_URL"]?.trim() ?? "";
  const environment = process.env["MPESA_ENVIRONMENT"]?.trim() || "sandbox";
  const values = [consumerKey, consumerSecret, shortcode, passkey, callbackUrl];

  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) {
    throw new Error(
      "M-Pesa configuration is incomplete. Set all MPESA_* credentials and callback URL.",
    );
  }
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("MPESA_ENVIRONMENT must be sandbox or production.");
  }

  try {
    new URL(callbackUrl);
  } catch {
    throw new Error("MPESA_CALLBACK_URL must be an absolute URL.");
  }

  return { environment, consumerKey, consumerSecret, shortcode, passkey, callbackUrl };
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
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error("M-Pesa amount must be a positive whole number of KES.");
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

  const baseUrl =
    config.environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString(
    "base64",
  );
  const tokenResponse = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { authorization: `Basic ${credentials}` },
  });
  if (!tokenResponse.ok) throw new Error(`M-Pesa authentication failed (${tokenResponse.status}).`);
  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error("M-Pesa did not return an access token.");

  const requestTimestamp = timestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${requestTimestamp}`).toString(
    "base64",
  );
  const pushResponse = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenData.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: requestTimestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: input.amount,
      PartyA: input.phoneNumber,
      PartyB: config.shortcode,
      PhoneNumber: input.phoneNumber,
      CallBackURL: config.callbackUrl,
      AccountReference: input.accountReference,
      TransactionDesc: input.transactionDesc.trim(),
    }),
  });
  if (!pushResponse.ok) throw new Error(`M-Pesa STK Push failed (${pushResponse.status}).`);
  return pushResponse.json() as Promise<{
    MerchantRequestID: string;
    CheckoutRequestID: string;
    ResponseCode: string;
    ResponseDescription: string;
    CustomerMessage: string;
  }>;
}
