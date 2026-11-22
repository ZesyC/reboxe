import { ApiClientError, type createApiClient } from "@reboxe/api-client";
import type { CheckoutQuote } from "@reboxe/shared";

export type CheckoutAttempt = { initKey: string; payKey: string };
export function clearCheckoutAttempt(storage: Pick<Storage, "removeItem">, fingerprint: string) {
  storage.removeItem(`reboxe.checkout.${fingerprint}`);
}
export function checkoutAttempt(storage: Pick<Storage, "getItem" | "setItem">, fingerprint: string): CheckoutAttempt {
  const key = `reboxe.checkout.${fingerprint}`;
  try {
    const saved = JSON.parse(storage.getItem(key) ?? "null") as CheckoutAttempt | null;
    if (saved && /^[a-f0-9-]{36}$/.test(saved.initKey) && /^[a-f0-9-]{36}$/.test(saved.payKey)) return saved;
  } catch { /* Replace malformed browser state. */ }
  const attempt = { initKey: crypto.randomUUID(), payKey: crypto.randomUUID() };
  storage.setItem(key, JSON.stringify(attempt));
  return attempt;
}
export async function confirmSandboxOrder(
  api: Pick<ReturnType<typeof createApiClient>, "initCheckout" | "payCheckout">,
  listingId: string,
  addressId: string,
  quote: CheckoutQuote
) {
  const fingerprint = `${listingId}:${addressId}`;
  const attempt = checkoutAttempt(sessionStorage, fingerprint);
  const initialized = await api.initCheckout({ items: [{ listingId, quantity: 1 }], addressId }, attempt.initKey);
  if (initialized.status !== "EXPIRED") {
    if (initialized.totalVnd !== quote.totalVnd) {
      return { quote: {
        subtotalVnd: initialized.subtotalVnd, shippingVnd: initialized.feeVnd, totalVnd: initialized.totalVnd, mode: initialized.mode
      } };
    }
    try {
      return { order: await api.payCheckout(initialized.id, attempt.payKey) };
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.code !== "INVALID_ORDER_STATE" || Date.parse(initialized.expiresAt) > Date.now()) {
        throw error;
      }
    }
  }
  clearCheckoutAttempt(sessionStorage, fingerprint);
  throw new Error("Lượt giữ hàng đã hết hạn. Bấm đặt hàng lại để kiểm tra và giữ kiện mới.");
}
