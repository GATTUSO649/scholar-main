export const MPESA_PAYMENT_EXPIRY_MS = 60_000;

export function hasMpesaPaymentExpired(expiresAt: Date | null, now = Date.now()) {
  return expiresAt !== null && expiresAt.getTime() <= now;
}
