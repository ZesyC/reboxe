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
