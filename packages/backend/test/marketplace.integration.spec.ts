import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MarketplaceModule } from "../src/modules/marketplace/marketplace";
import type { MarketplaceProvider } from "../src/modules/marketplace/provider";

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
const actorId = randomUUID();
const stranger = randomUUID();
const shopId = `marketplace-test-${randomUUID()}`;
const externalShopId = randomUUID();
const provider: MarketplaceProvider = {
  platform: "TIKTOK", configured: true,
  authorizationUrl: (state) => `https://services.tiktokshop.com/open/authorize?state=${state}`,
  exchange: vi.fn(async () => [{ id: externalShopId, name: "Authorized synthetic shop", credentials: {
    accessToken: "private-access-token", refreshToken: "private-refresh-token",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(), refreshExpiresAt: new Date(Date.now() + 86400_000).toISOString()
  } }]),
  refresh: vi.fn(async (grant) => ({ ...grant.credentials, accessToken: "rotated-private-token", expiresAt: new Date(Date.now() + 3600_000).toISOString() }))
};
const marketplace = new MarketplaceModule(pool, "test-marketplace-secret-with-at-least-32-characters", [provider]);
beforeAll(async () => {
  await pool.query("INSERT INTO auth.users(id,email_confirmed_at) VALUES($1,now()),($2,now())", [actorId, stranger]);
  await pool.query("INSERT INTO profiles(id,status) VALUES($1,'ACTIVE'),($2,'ACTIVE') ON CONFLICT(id) DO NOTHING", [actorId, stranger]);
  await pool.query("INSERT INTO shops(id,display_name,legal_type,kyc_status,status) VALUES($1,'Synthetic integration shop','INDIVIDUAL','VERIFIED','ACTIVE')", [shopId]);
  await pool.query("INSERT INTO shop_memberships(user_id,shop_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')", [actorId, shopId]);
});
afterAll(async () => {
  for (const table of ["marketplace_connection_events", "marketplace_connections", "marketplace_authorizations", "shop_memberships"]) {
    await pool.query(`DELETE FROM ${table} WHERE shop_id=$1`, [shopId]);
  }
  await pool.query("DELETE FROM shops WHERE id=$1", [shopId]);
  await pool.query("DELETE FROM profiles WHERE id=ANY($1::uuid[])", [[actorId, stranger]]);
  await pool.query("DELETE FROM auth.users WHERE id=ANY($1::uuid[])", [[actorId, stranger]]);
  await pool.end();
});
async function begin() {
  const result = await marketplace.begin(actorId, shopId, "TIKTOK", "2026-10-20");
  return new URL(result.authorizationUrl).searchParams.get("state")!;
}
describe("marketplace shop authorization", () => {
  it("checks membership before reading connections or making an authorization", async () => {
    await expect(marketplace.list(stranger, shopId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(marketplace.begin(stranger, shopId, "TIKTOK", "2026-10-20")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("binds state to actor, hashes state and exchanges a code once across concurrent callbacks", async () => {
    const state = await begin();
    const stored = (await pool.query("SELECT state_hash FROM marketplace_authorizations WHERE shop_id=$1 AND status='PENDING'", [shopId])).rows[0];
    expect(stored.state_hash).not.toBe(state);
    await expect(marketplace.complete(stranger, shopId, state, "code")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => marketplace.complete(actorId, shopId, state, "code")));
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect(provider.exchange).toHaveBeenCalledTimes(1);
    const choice = await marketplace.complete(actorId, shopId, state, "code");
    expect(JSON.stringify(choice)).not.toContain("private-access-token");
    await expect(marketplace.confirm(actorId, shopId, choice.sessionId, "not-authorized")).rejects.toMatchObject({ code: "MARKETPLACE_AUTH_INVALID" });
    const connections = await marketplace.confirm(actorId, shopId, choice.sessionId, externalShopId);
    expect(connections).toEqual([expect.objectContaining({ status: "CONNECTED", externalShopId })]);
    expect(JSON.stringify(connections)).not.toContain("private-");
    const encrypted = (await pool.query("SELECT credentials_enc FROM marketplace_connections WHERE shop_id=$1", [shopId])).rows[0].credentials_enc as Buffer;
    expect(encrypted.toString()).not.toContain("private-access-token");
    await expect(marketplace.confirm(actorId, shopId, choice.sessionId, externalShopId)).rejects.toMatchObject({ code: "MARKETPLACE_AUTH_INVALID" });
  });
  it("rotates expiring tokens and erases credentials when disconnected", async () => {
    await pool.query("UPDATE marketplace_connections SET token_expires_at=now()-interval '1 second' WHERE shop_id=$1", [shopId]);
    await marketplace.maintainConnections();
    expect(provider.refresh).toHaveBeenCalledTimes(1);
    await marketplace.disconnect(actorId, shopId, "TIKTOK");
    const row = (await pool.query("SELECT status,credentials_enc FROM marketplace_connections WHERE shop_id=$1", [shopId])).rows[0];
    expect(row).toEqual({ status: "DISCONNECTED", credentials_enc: null });
  });
  it("invalidates pending callbacks when consent is restarted or withdrawn", async () => {
    const first = await begin();
    const second = await begin();
    await expect(marketplace.complete(actorId, shopId, first, "code")).rejects.toMatchObject({ code: "MARKETPLACE_AUTH_INVALID" });
    await marketplace.disconnect(actorId, shopId, "TIKTOK");
    await expect(marketplace.complete(actorId, shopId, second, "code")).rejects.toMatchObject({ code: "MARKETPLACE_AUTH_INVALID" });
  });
  it("denies browser roles direct access to tokens, state and consent audit", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE authenticated");
      await expect(client.query("SELECT * FROM marketplace_connections")).rejects.toThrow(/permission denied/);
    } finally { await client.query("ROLLBACK"); client.release(); }
  });
});
