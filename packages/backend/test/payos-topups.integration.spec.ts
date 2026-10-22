import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { PayOS } from "@payos/node";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PayosPromotionTopups } from "../src/modules/commerce/payos-topups";

const namespace = `payos_test_${randomUUID().replaceAll("-", "")}`;
const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const admin = new Pool({ connectionString });
const pool = new Pool({ connectionString, options: `-c search_path=${namespace},public` });
const actor = randomUUID();
const outsider = randomUUID();
const shop = randomUUID();
const links = new Map<number, { id: string; orderCode: number; amount: number; amountPaid: number; status: string; transactions: Array<{ accountNumber: string }> }>();
const provider = {
  clientId: "synthetic-client",
  paymentRequests: {
    create: vi.fn(async (input: { orderCode: number; amount: number }) => {
      const id = `link-${input.orderCode}`;
      links.set(input.orderCode, { id, orderCode: input.orderCode, amount: input.amount, amountPaid: 0, status: "PENDING", transactions: [] });
      return { ...input, paymentLinkId: id, checkoutUrl: `https://pay.payos.vn/web/${id}`, accountNumber: "0000001", bin: "970452", currency: "VND" };
    }),
    get: vi.fn(async (code: number) => { const value = links.get(code); if (!value) throw new Error("not found"); return value; })
  },
  webhooks: { verify: vi.fn(async (payload: { signature: string; data: Record<string, unknown> }) => {
    if (payload.signature !== "verified-synthetic-signature") throw new Error("invalid signature");
    return payload.data;
  }) }
};
const topups = new PayosPromotionTopups(pool, provider as unknown as PayOS, "https://reboxe.test", "0000001", "970452");
beforeAll(async () => {
  await admin.query(`CREATE SCHEMA ${namespace}`);
  for (const table of ["profiles", "shops", "shop_memberships", "promotion_credit_topups", "payos_receipts", "ledger_transactions", "ledger_postings"]) {
    await admin.query(`CREATE TABLE ${namespace}.${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  await pool.query("INSERT INTO profiles(id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE')", [actor, outsider]);
  await pool.query("INSERT INTO shops(id,display_name,legal_type,kyc_status,status) VALUES($1,'PayOS synthetic shop','INDIVIDUAL','VERIFIED','ACTIVE')", [shop]);
  await pool.query("INSERT INTO shop_memberships(user_id,shop_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')", [actor, shop]);
});
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA ${namespace} CASCADE`); await admin.end(); });

describe("payOS promotion payments", () => {
  it("authorizes before creating a provider link and reuses a durable intent on retries", async () => {
    await expect(topups.create(outsider, shop, 100_000, randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const key = randomUUID();
    const result = await topups.create(actor, shop, 100_000, key);
    expect(result.status).toBe("PENDING");
    expect(await topups.create(actor, shop, 100_000, key)).toEqual(result);
    expect(provider.paymentRequests.create).toHaveBeenCalledTimes(1);
    await expect(topups.create(actor, shop, 200_000, key)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("credits once across concurrent verified webhooks with balanced postings", async () => {
    const intent = await topups.create(actor, shop, 100_000, randomUUID());
    const row = (await pool.query("SELECT order_code,payment_link_id FROM promotion_credit_topups WHERE id=$1", [intent.id])).rows[0];
    const data = { orderCode: Number(row.order_code), paymentLinkId: row.payment_link_id, amount: 100_000,
      accountNumber: "0000001", currency: "VND", code: "00", reference: randomUUID() };
    await expect(topups.webhook({ signature: "invalid", data })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(topups.webhook({ signature: "verified-synthetic-signature", data: { ...data, amount: 99_999 } })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await Promise.all(Array.from({ length: 20 }, () => topups.webhook({ signature: "verified-synthetic-signature", data })));
    expect((await pool.query("SELECT count(*)::int AS count FROM ledger_transactions WHERE reference_id=$1", [intent.id])).rows[0].count).toBe(1);
    expect((await pool.query("SELECT sum(amount_vnd)::text AS total FROM ledger_postings")).rows[0].total).toBe("0");
    expect((await topups.get(actor, shop, intent.id)).status).toBe("PAID");
  });
  it("reconciles a lost response without creating a second payment link", async () => {
    const intent = await topups.create(actor, shop, 100_000, randomUUID());
    const code = Number((await pool.query("SELECT order_code FROM promotion_credit_topups WHERE id=$1", [intent.id])).rows[0].order_code);
    await pool.query("UPDATE promotion_credit_topups SET status='UNKNOWN',checkout_url=NULL,payment_link_id=NULL WHERE id=$1", [intent.id]);
    const before = provider.paymentRequests.create.mock.calls.length;
    expect((await topups.get(actor, shop, intent.id)).checkoutUrl).toBe(`https://pay.payos.vn/web/link-${code}`);
    expect(provider.paymentRequests.create.mock.calls.length).toBe(before);
  });
  it("blocks a mismatched recipient and never recovers its checkout URL", async () => {
    const misconfigured = new PayosPromotionTopups(pool, provider as unknown as PayOS, "https://reboxe.test", "different-recipient", "970452");
    const result = await misconfigured.create(actor, shop, 100_000, randomUUID());
    expect(result.status).toBe("BLOCKED");
    const calls = provider.paymentRequests.get.mock.calls.length;
    expect((await misconfigured.get(actor, shop, result.id)).checkoutUrl).toBeNull();
    expect(provider.paymentRequests.get.mock.calls.length).toBe(calls);
  });
});
