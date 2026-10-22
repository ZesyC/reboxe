import { sellerFinanceSnapshotSchema, type SellerFinanceSnapshot } from "@reboxe/shared";
import type { Pool } from "pg";
import type { IdentityModule } from "../identity";

type PersistedSnapshotRow = {
  available_balance_vnd: string;
  held_balance_vnd: string;
  net_revenue_vnd: string;
  monthly_revenue: SellerFinanceSnapshot["monthlyRevenue"];
  product_revenue: SellerFinanceSnapshot["productRevenue"];
  wallet_transactions: SellerFinanceSnapshot["walletTransactions"];
  updated_at: Date;
};

export class FinanceModule {
  constructor(private readonly pool: Pool, private readonly identity: IdentityModule, private readonly allowDemoSnapshots = false) {}

  async getSnapshot(actorId: string, shopId: string): Promise<SellerFinanceSnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      await this.identity.requireShopCapability(client, actorId, shopId, "VIEW_FINANCE");
      const persisted = this.allowDemoSnapshots ? (await client.query<PersistedSnapshotRow>(
        `SELECT available_balance_vnd::text,held_balance_vnd::text,net_revenue_vnd::text,
                monthly_revenue,product_revenue,wallet_transactions,updated_at
         FROM seller_finance_snapshots WHERE shop_id=$1`,
        [shopId]
      )).rows[0] : undefined;
      if (persisted) {
        const result = sellerFinanceSnapshotSchema.parse({
          availableBalanceVnd: Number(persisted.available_balance_vnd),
          heldBalanceVnd: Number(persisted.held_balance_vnd),
          netRevenueVnd: Number(persisted.net_revenue_vnd),
          monthlyRevenue: persisted.monthly_revenue,
          productRevenue: persisted.product_revenue,
          walletTransactions: persisted.wallet_transactions,
          updatedAt: persisted.updated_at.toISOString()
        });
        await client.query("COMMIT");
        return result;
      }
      const balances = await client.query<{ account_key: string; amount: string }>(
        `SELECT p.account_key,coalesce(sum(p.amount_vnd),0)::text AS amount FROM ledger_postings p
         JOIN ledger_transactions t ON t.id=p.transaction_id
         WHERE t.status='POSTED' AND p.account_key=ANY($1::text[]) GROUP BY p.account_key`,
        [[`shop:${shopId}:available`, `shop:${shopId}:order_locked`]]
      );
      const byAccount = new Map(balances.rows.map((row) => [row.account_key, Number(row.amount)]));
      const revenueQuery = `WITH completed AS (
        SELECT o.id,o.completed_at,coalesce(o.fee_snapshot->>'commissionVnd','0')::bigint AS commission,
          NOT (o.fee_snapshot ? 'commissionVnd') AS unpriced,
          sum(i.amount_vnd)::bigint AS gross,
          (SELECT coalesce(sum(r.amount_vnd),0) FROM refunds r WHERE r.order_id=o.id AND r.status='PAID') AS refunded,
          max(i.item_snapshot->>'title') AS title
        FROM orders o JOIN sub_orders s ON s.order_id=o.id JOIN sub_order_items i ON i.sub_order_id=s.id
        WHERE s.shop_id=$1 AND o.status='COMPLETED' GROUP BY o.id
      )`;
      const revenue = (await client.query<{ net: string; unpriced: string }>(`${revenueQuery}
        SELECT coalesce(sum(gross-commission-refunded),0)::text AS net,
        count(*) FILTER(WHERE unpriced)::text AS unpriced FROM completed`, [shopId])).rows[0]!;
      const monthly = await client.query<{ label: string; amount: string }>(`${revenueQuery}
        SELECT to_char(completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM') AS label,
        sum(gross-commission-refunded)::text AS amount FROM completed
        WHERE completed_at>=(date_trunc('month',now() AT TIME ZONE 'Asia/Ho_Chi_Minh')-interval '11 months') AT TIME ZONE 'Asia/Ho_Chi_Minh'
        GROUP BY label ORDER BY label DESC LIMIT 12`, [shopId]);
      const products = await client.query<{ label: string; amount: string }>(`${revenueQuery}
        SELECT coalesce(title,id) AS label,sum(gross-commission-refunded)::text AS amount FROM completed
        GROUP BY coalesce(title,id) ORDER BY sum(gross-commission-refunded) DESC LIMIT 12`, [shopId]);
      const transactions = await client.query<{ id: string; kind: string; amount_vnd: string; created_at: Date }>(
        `SELECT t.id,t.kind,sum(p.amount_vnd)::text AS amount_vnd,t.created_at FROM ledger_transactions t JOIN ledger_postings p ON p.transaction_id=t.id
         WHERE t.status='POSTED' AND p.account_key=$1 GROUP BY t.id ORDER BY t.created_at DESC,t.id DESC LIMIT 100`, [`shop:${shopId}:available`]
      );
      const result = sellerFinanceSnapshotSchema.parse({
        availableBalanceVnd: byAccount.get(`shop:${shopId}:available`) ?? 0,
        heldBalanceVnd: byAccount.get(`shop:${shopId}:order_locked`) ?? 0,
        netRevenueVnd: Number(revenue.net), unpricedOrderCount: Number(revenue.unpriced),
        monthlyRevenue: monthly.rows.reverse().map((row) => ({ label: row.label, amountVnd: Number(row.amount) })),
        productRevenue: products.rows.map((row) => ({ label: row.label, amountVnd: Number(row.amount) })),
        walletTransactions: transactions.rows.map((row) => ({
          code: row.id, kind: row.kind === "SANDBOX_BALANCE_SEED" ? "DEPOSIT" : row.kind === "HOLD_CREATE" ? "HOLD" : "REVENUE",
          detail: row.kind === "SANDBOX_BALANCE_SEED" ? `${row.kind} · dữ liệu mô phỏng` : row.kind,
          amountVnd: Number(row.amount_vnd), occurredAt: row.created_at.toISOString()
        })),
        updatedAt: new Date().toISOString()
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
