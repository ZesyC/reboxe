import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import type { IdentityModule } from "../src/modules/identity";
import { FinanceModule } from "../src/modules/finance/finance";

describe("seller finance snapshot", () => {
  it("returns the persisted demo snapshot after checking shop access", async () => {
    const snapshot = {
      availableBalanceVnd: 300_000,
      heldBalanceVnd: 850_000,
      netRevenueVnd: 432_000,
      monthlyRevenue: [{ label: "T8", amountVnd: 432_000 }],
      productRevenue: [{ label: "Sony XM4", amountVnd: 950_000 }],
      walletTransactions: [{ code: "#RBX-DEMO-001", kind: "REVENUE", detail: "Tai nghe", amountVnd: 855_000, occurredAt: "2026-09-02T03:00:00.000Z" }],
      updatedAt: "2026-09-08T03:00:00.000Z"
    } as const;
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("BEGIN") || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
        if (!sql.includes("seller_finance_snapshots")) throw new Error(`Unexpected query: ${sql}`);
        return { rows: [{
          available_balance_vnd: String(snapshot.availableBalanceVnd),
          held_balance_vnd: String(snapshot.heldBalanceVnd),
          net_revenue_vnd: String(snapshot.netRevenueVnd),
          monthly_revenue: snapshot.monthlyRevenue,
          product_revenue: snapshot.productRevenue,
          wallet_transactions: snapshot.walletTransactions,
          updated_at: new Date(snapshot.updatedAt)
        }] };
      }),
      release: vi.fn()
    };
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    const identity = { requireShopCapability: vi.fn(async () => undefined) } as unknown as IdentityModule;

    await expect(new FinanceModule(pool, identity, true).getSnapshot("seller-id", "demo-shop")).resolves.toEqual(snapshot);
    expect(identity.requireShopCapability).toHaveBeenCalledWith(client, "seller-id", "demo-shop", "VIEW_FINANCE");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
