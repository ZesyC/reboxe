import { describe, expect, it } from "vitest";
import { checkoutAttempt } from "./checkout-session";

describe("checkout recovery after lost responses", () => {
  it("reuses both idempotency keys for the same package/address across reloads", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const attempt = checkoutAttempt(storage, "package:address");
    expect(checkoutAttempt(storage, "package:address")).toEqual(attempt);
    expect(checkoutAttempt(storage, "other-package:address")).not.toEqual(attempt);
  });
});
