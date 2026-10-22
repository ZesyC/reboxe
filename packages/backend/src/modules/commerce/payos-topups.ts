import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { PayOS } from "@payos/node";
import { DomainError } from "../../errors";

type Topup = { id: string; shop_id: string; amount_vnd: string; order_code: string; status: string; payment_link_id: string | null;
  checkout_url: string | null; merchant_client_id: string; expires_at: Date };
type Webhook = Parameters<PayOS["webhooks"]["verify"]>[0];

export class PayosPromotionTopups {
  constructor(private readonly pool: Pool, private readonly client: PayOS | undefined,
    private readonly webOrigin: string, private readonly accountNumber: string, private readonly bankBin: string) {}
  get configured() { return Boolean(this.client && this.accountNumber && this.bankBin); }

  async create(actorId: string, shopId: string, amountVnd: number, key: string) {
    const provider = this.provider();
    const client = await this.pool.connect();
    let intent: Topup;
    let created = false;
    try {
      await client.query("BEGIN");
      await this.requireManager(client, actorId, shopId);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`payos-topup:${actorId}:${key}`]);
      const prior = (await client.query<Topup>("SELECT * FROM promotion_credit_topups WHERE actor_id=$1 AND idempotency_key=$2", [actorId, key])).rows[0];
      if (prior) {
        if (prior.shop_id !== shopId || Number(prior.amount_vnd) !== amountVnd) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "Top-up key was used with a different amount or shop");
        intent = prior;
      } else {
        intent = (await client.query<Topup>(`INSERT INTO promotion_credit_topups(id,actor_id,shop_id,idempotency_key,merchant_client_id,amount_vnd,expires_at)
          VALUES($1,$2,$3,$4,$5,$6,now()+interval '30 minutes') RETURNING *`, [randomUUID(), actorId, shopId, key, provider.clientId, amountVnd])).rows[0]!;
        created = true;
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    if (!created) return this.present(intent);
    try {
      const response = await provider.paymentRequests.create({ orderCode: Number(intent.order_code), amount: amountVnd,
        description: `QC${intent.order_code}`.slice(-9), returnUrl: new URL("/seller/promotions", this.webOrigin).toString(),
        cancelUrl: new URL("/seller/promotions", this.webOrigin).toString(), expiredAt: Math.floor(intent.expires_at.getTime()/1000) }, { maxRetries: 0 });
      if (response.amount !== amountVnd || response.orderCode !== Number(intent.order_code) || response.accountNumber !== this.accountNumber
        || response.bin !== this.bankBin || response.currency !== "VND") {
        await this.pool.query("UPDATE promotion_credit_topups SET status='BLOCKED' WHERE id=$1 AND status<>'PAID'", [intent.id]);
        return this.present({ ...intent, status: "BLOCKED" });
      }
      const checkout = new URL(response.checkoutUrl);
      if (checkout.protocol !== "https:" || checkout.hostname !== "pay.payos.vn" || checkout.port || checkout.username || checkout.password) {
        await this.pool.query("UPDATE promotion_credit_topups SET status='BLOCKED' WHERE id=$1 AND status<>'PAID'", [intent.id]);
        return this.present({ ...intent, status: "BLOCKED" });
      }
      await this.pool.query(`UPDATE promotion_credit_topups SET payment_link_id=$2,checkout_url=$3,
        status=CASE WHEN status='PAID' THEN 'PAID' ELSE 'PENDING' END WHERE id=$1`, [intent.id, response.paymentLinkId, checkout.toString()]);
      return this.present({ ...intent, payment_link_id: response.paymentLinkId, checkout_url: checkout.toString(), status: "PENDING" });
    } catch {
      await this.pool.query("UPDATE promotion_credit_topups SET status='UNKNOWN' WHERE id=$1 AND status='CREATING'", [intent.id]);
      return this.present({ ...intent, status: "UNKNOWN" });
    }
  }

  async get(actorId: string, shopId: string, id: string) {
    const client = await this.pool.connect();
    let intent: Topup;
    try {
      await this.requireManager(client, actorId, shopId);
      const row = (await client.query<Topup>("SELECT * FROM promotion_credit_topups WHERE id=$1 AND shop_id=$2", [id, shopId])).rows[0];
      if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Top-up not found");
      intent = row;
    } finally { client.release(); }
    await this.reconcile(intent);
    const current = (await this.pool.query<Topup>("SELECT * FROM promotion_credit_topups WHERE id=$1", [id])).rows[0]!;
    return this.present(current);
  }

  async reconcileOutstanding() {
    if (!this.configured || !this.client) return;
    const rows = await this.pool.query<Topup>(`SELECT * FROM promotion_credit_topups
      WHERE merchant_client_id=$1 AND status IN ('CREATING','UNKNOWN','PENDING') AND created_at<now()-interval '30 seconds'
      ORDER BY created_at LIMIT 10`, [this.client.clientId]);
    for (const row of rows.rows) await this.reconcile(row);
  }

  private async reconcile(intent: Topup) {
    if (["PAID", "BLOCKED"].includes(intent.status) || !this.client || intent.merchant_client_id !== this.client.clientId) return;
    try {
      const result = await this.client.paymentRequests.get(Number(intent.order_code), { maxRetries: 0 });
      if (result.orderCode !== Number(intent.order_code) || result.amount !== Number(intent.amount_vnd)
        || (intent.payment_link_id && result.id !== intent.payment_link_id)) return;
      if (result.status === "PAID" && result.amountPaid === Number(intent.amount_vnd) && result.transactions.length
        && result.transactions.every((transaction) => transaction.accountNumber === this.accountNumber)) {
        await this.credit(intent, `reconcile:${intent.id}`, createHash("sha256").update(JSON.stringify({ id: result.id,
          orderCode: result.orderCode, amountPaid: result.amountPaid, accountNumber: this.accountNumber })).digest("hex"));
      } else if (result.status === "PENDING" && result.amountPaid === 0 && /^[a-zA-Z0-9-]{1,200}$/.test(result.id)) {
        await this.pool.query(`UPDATE promotion_credit_topups SET payment_link_id=$2,checkout_url=$3,status='PENDING'
          WHERE id=$1 AND status<>'PAID'`, [intent.id, result.id, `https://pay.payos.vn/web/${result.id}`]);
      } else if (["CANCELLED", "EXPIRED"].includes(result.status) && result.amountPaid === 0) {
        await this.pool.query("UPDATE promotion_credit_topups SET status=$2 WHERE id=$1 AND status<>'PAID'", [intent.id, result.status]);
      }
    } catch { /* UNKNOWN never releases money or credits a balance. Try again via reconciliation. */ }
  }

  async webhook(payload: unknown) {
    const provider = this.provider();
    let data: Awaited<ReturnType<PayOS["webhooks"]["verify"]>>;
    try { data = await provider.webhooks.verify(payload as Webhook); }
    catch { throw new DomainError("INVALID_CREDENTIALS", 401, "Invalid payment signature"); }
    if (data.code !== "00" || data.currency !== "VND" || data.accountNumber !== this.accountNumber
      || !Number.isSafeInteger(data.orderCode) || !Number.isSafeInteger(data.amount) || data.amount <= 0) {
      throw new DomainError("VALIDATION_FAILED", 422, "Payment channel, currency or amount mismatch");
    }
    const row = (await this.pool.query<Topup>("SELECT * FROM promotion_credit_topups WHERE order_code=$1 AND merchant_client_id=$2", [data.orderCode, provider.clientId])).rows[0];
    // Includes provider's signed webhook-registration test, which must never credit a wallet.
    if (!row) return { received: true, matched: false };
    if (row.status === "BLOCKED") throw new DomainError("VALIDATION_FAILED", 422, "Payment requires manual channel review");
    if (Number(row.amount_vnd) !== data.amount || (row.payment_link_id && row.payment_link_id !== data.paymentLinkId)) {
      throw new DomainError("VALIDATION_FAILED", 422, "Payment does not match top-up");
    }
    await this.credit(row, data.reference, createHash("sha256").update(JSON.stringify({ orderCode: data.orderCode, amount: data.amount,
      reference: data.reference, paymentLinkId: data.paymentLinkId, accountNumber: data.accountNumber })).digest("hex"));
    return { received: true, matched: true };
  }

  private async credit(intent: Topup, reference: string, payloadHash: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`wallet:${intent.shop_id}`]);
      const row = (await client.query<Topup>("SELECT * FROM promotion_credit_topups WHERE id=$1 FOR UPDATE", [intent.id])).rows[0]!;
      if (row.status === "BLOCKED") throw new DomainError("VALIDATION_FAILED", 422, "Payment requires manual channel review");
      const receipt = (await client.query<{ payload_hash: string; topup_id: string }>("SELECT payload_hash,topup_id FROM payos_receipts WHERE reference=$1", [reference])).rows[0];
      if (receipt && (receipt.payload_hash !== payloadHash || receipt.topup_id !== intent.id)) throw new DomainError("EVENT_ID_CONFLICT", 409, "Payment reference payload differs");
      if (row.status !== "PAID") {
        const transactionId = randomUUID();
        await client.query("INSERT INTO ledger_transactions(id,kind,reference_id) VALUES($1,'PROMOTION_CREDIT_PAID',$2)", [transactionId, intent.id]);
        await client.query(`INSERT INTO ledger_postings(id,transaction_id,account_key,amount_vnd) VALUES
          ($1,$2,$3,$4),($5,$2,'platform:promotion_payment_clearing',-$4::bigint)`,
        [randomUUID(), transactionId, `shop:${intent.shop_id}:promotion_credit`, Number(intent.amount_vnd), randomUUID()]);
        await client.query("UPDATE ledger_transactions SET status='POSTED' WHERE id=$1", [transactionId]);
        await client.query("UPDATE promotion_credit_topups SET status='PAID',paid_at=now() WHERE id=$1", [intent.id]);
      }
      if (!receipt) await client.query("INSERT INTO payos_receipts(reference,topup_id,payload_hash) VALUES($1,$2,$3)", [reference, intent.id, payloadHash]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  private present(row: Topup) { return { id: row.id, amountVnd: Number(row.amount_vnd), status: row.status,
    checkoutUrl: row.status === "PENDING" ? row.checkout_url : null, expiresAt: row.expires_at.toISOString() }; }
  private provider() {
    if (!this.client || !this.configured) throw new DomainError("PAYMENT_METHOD_DISABLED", 503, "payOS promotion payments are not configured");
    return this.client;
  }
  private async requireManager(client: PoolClient, actorId: string, shopId: string) {
    const result = await client.query(`SELECT 1 FROM shop_memberships m JOIN profiles p ON p.id=m.user_id
      WHERE m.user_id=$1 AND m.shop_id=$2 AND m.status='ACTIVE' AND m.role IN ('OWNER','MANAGER') AND p.status='ACTIVE'`, [actorId, shopId]);
    if (!result.rowCount) throw new DomainError("FORBIDDEN", 403, "Promotion payments require a shop owner or manager");
  }
}
export function createPayosClient(): PayOS | undefined {
  if (process.env.PAYOS_PROMOTION_PAYMENTS_ENABLED !== "true") return undefined;
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
  if (!clientId || !apiKey || !checksumKey) throw new Error("payOS credentials are required");
  return new PayOS({ clientId, apiKey, checksumKey, baseURL: "https://api-merchant.payos.vn", maxRetries: 0, timeout: 15_000, logger: null, logLevel: "off" });
}
