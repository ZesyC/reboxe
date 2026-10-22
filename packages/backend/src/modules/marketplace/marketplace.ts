import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Marketplace, MarketplaceConnection, MarketplaceShopChoice } from "@reboxe/shared";
import { DomainError } from "../../errors";
import { createPiiKey, decryptPii, encryptPii } from "../identity/pii";
import type { MarketplaceProvider, AuthorizedMarketplaceShop } from "./provider";

type Authorization = {
  id: string; shop_id: string; platform: Marketplace; notice_version: string;
  grants_enc: Buffer | null; status: string;
};
type Connection = {
  id: string; platform: Marketplace; external_shop_id: string; shop_name: string;
  status: MarketplaceConnection["status"]; connected_at: Date; token_expires_at: Date;
  last_synced_at: Date | null;
};

export class MarketplaceModule {
  private readonly key: Buffer;
  constructor(private readonly pool: Pool, secret: string, private readonly providers: MarketplaceProvider[]) {
    this.key = createPiiKey(secret);
  }

  availability() {
    return this.providers.map(({ platform, configured }) => ({ platform, configured }));
  }

  async list(actorId: string, shopId: string): Promise<MarketplaceConnection[]> {
    await this.requireManager(this.pool, actorId, shopId);
    const result = await this.pool.query<Connection>(
      `SELECT id,platform,external_shop_id,shop_name,status,connected_at,token_expires_at,last_synced_at
       FROM marketplace_connections WHERE shop_id=$1 ORDER BY platform`, [shopId]);
    return result.rows.map((row) => ({ id: row.id, platform: row.platform, externalShopId: row.external_shop_id,
      shopName: row.shop_name, status: row.status, connectedAt: row.connected_at.toISOString(),
      expiresAt: row.token_expires_at.toISOString(), lastSyncedAt: row.last_synced_at?.toISOString() ?? null }));
  }

  async begin(actorId: string, shopId: string, platform: Marketplace, noticeVersion: string) {
    const provider = this.provider(platform);
    const state = randomBytes(32).toString("hex");
    const url = provider.authorizationUrl(state);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.requireManager(client, actorId, shopId);
      // No previous browser authorization may remain valid after a newer consent.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`marketplace:${shopId}:${platform}`]);
      await client.query(`UPDATE marketplace_authorizations SET status='FAILED',grants_enc=NULL
        WHERE shop_id=$1 AND platform=$2 AND status IN ('PENDING','EXCHANGING','SELECT_SHOP')`, [shopId, platform]);
      await client.query(`INSERT INTO marketplace_authorizations(id,shop_id,actor_id,platform,state_hash,notice_version,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')`,
      [randomUUID(), shopId, actorId, platform, digest(state), noticeVersion]);
      await this.audit(client, actorId, shopId, platform, "CONSENT", noticeVersion);
      await client.query("COMMIT");
      return { authorizationUrl: url };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async complete(actorId: string, shopId: string, state: string, code: string, externalShopId?: string): Promise<{ sessionId: string; shops: MarketplaceShopChoice[] }> {
    await this.requireManager(this.pool, actorId, shopId);
    // Claim once before calling the provider. No HTTP call runs inside a DB transaction.
    const auth = (await this.pool.query<Authorization>(`UPDATE marketplace_authorizations SET status='EXCHANGING'
      WHERE state_hash=$1 AND actor_id=$2 AND shop_id=$3 AND status='PENDING' AND expires_at>now()
      RETURNING id,shop_id,platform,notice_version,grants_enc,status`, [digest(state), actorId, shopId])).rows[0];
    if (!auth) {
      const prior = (await this.pool.query<Authorization>(`SELECT id,shop_id,platform,notice_version,grants_enc,status
        FROM marketplace_authorizations WHERE state_hash=$1 AND actor_id=$2 AND shop_id=$3
        AND status='SELECT_SHOP' AND expires_at>now()`, [digest(state), actorId, shopId])).rows[0];
      if (prior?.grants_enc) return this.choices(prior);
      throw new DomainError("MARKETPLACE_AUTH_INVALID", 409, "Authorization expired or already used; connect again");
    }
    try {
      const grants = await this.provider(auth.platform).exchange(code, externalShopId);
      if (!grants.length || grants.length > 100) throw new Error("INVALID_AUTHORIZED_SHOPS");
      const saved = await this.pool.query(`UPDATE marketplace_authorizations SET status='SELECT_SHOP',grants_enc=$2
        WHERE id=$1 AND status='EXCHANGING' AND expires_at>now()`, [auth.id, encryptPii(JSON.stringify(grants), this.key)]);
      if (!saved.rowCount) throw new DomainError("MARKETPLACE_AUTH_INVALID", 409, "Authorization was cancelled or expired");
      return { sessionId: auth.id, shops: grants.map(({ id, name }) => ({ id, name })) };
    } catch (error) {
      await this.pool.query("UPDATE marketplace_authorizations SET status='FAILED',grants_enc=NULL WHERE id=$1 AND status='EXCHANGING'", [auth.id]);
      if (error instanceof DomainError) throw error;
      throw new DomainError("MARKETPLACE_UNAVAILABLE", 502, "Could not verify platform authorization; connect again");
    }
  }

  async confirm(actorId: string, shopId: string, sessionId: string, externalShopId: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.requireManager(client, actorId, shopId);
      const header = (await client.query<{ platform: Marketplace }>("SELECT platform FROM marketplace_authorizations WHERE id=$1 AND actor_id=$2 AND shop_id=$3", [sessionId, actorId, shopId])).rows[0];
      if (!header) throw new DomainError("MARKETPLACE_AUTH_INVALID", 409, "Authorization expired; connect again");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`marketplace:${shopId}:${header.platform}`]);
      const auth = (await client.query<Authorization>(`SELECT id,shop_id,platform,notice_version,grants_enc,status
        FROM marketplace_authorizations WHERE id=$1 AND actor_id=$2 AND shop_id=$3
        AND status='SELECT_SHOP' AND expires_at>now() FOR UPDATE`, [sessionId, actorId, shopId])).rows[0];
      if (!auth?.grants_enc) throw new DomainError("MARKETPLACE_AUTH_INVALID", 409, "Authorization expired; connect again");
      const grant = this.grants(auth).find((shop) => shop.id === externalShopId);
      if (!grant) throw new DomainError("MARKETPLACE_AUTH_INVALID", 422, "Shop was not authorized by the platform");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`marketplace:${shopId}:${auth.platform}`]);
      await client.query(`INSERT INTO marketplace_connections(id,shop_id,platform,external_shop_id,shop_name,credentials_enc,
        status,consent_actor_id,notice_version,token_expires_at,refresh_expires_at)
        VALUES($1,$2,$3,$4,$5,$6,'CONNECTED',$7,$8,$9,$10)
        ON CONFLICT(shop_id,platform) DO UPDATE SET external_shop_id=excluded.external_shop_id,
        shop_name=excluded.shop_name,credentials_enc=excluded.credentials_enc,status='CONNECTED',
        consent_actor_id=excluded.consent_actor_id,notice_version=excluded.notice_version,
        token_expires_at=excluded.token_expires_at,refresh_expires_at=excluded.refresh_expires_at,
        connected_at=now(),disconnected_at=NULL,last_synced_at=NULL`,
      [randomUUID(), shopId, auth.platform, grant.id, grant.name, encryptPii(JSON.stringify(grant), this.key), actorId,
        auth.notice_version, grant.credentials.expiresAt, grant.credentials.refreshExpiresAt]);
      await client.query("UPDATE marketplace_authorizations SET status='COMPLETED',grants_enc=NULL,completed_at=now() WHERE id=$1", [sessionId]);
      await this.audit(client, actorId, shopId, auth.platform, "CONNECTED", auth.notice_version);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === "23505") throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "This platform shop is already linked to another REBOXE shop");
      throw error;
    } finally { client.release(); }
    return this.list(actorId, shopId);
  }

  async disconnect(actorId: string, shopId: string, platform: Marketplace) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.requireManager(client, actorId, shopId);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`marketplace:${shopId}:${platform}`]);
      const row = (await client.query<{ notice_version: string }>(`UPDATE marketplace_connections SET status='DISCONNECTED',
        credentials_enc=NULL,disconnected_at=now() WHERE shop_id=$1 AND platform=$2 AND status<>'DISCONNECTED' RETURNING notice_version`,
      [shopId, platform])).rows[0];
      await client.query("UPDATE marketplace_authorizations SET status='FAILED',grants_enc=NULL WHERE shop_id=$1 AND platform=$2 AND status<>'COMPLETED'", [shopId, platform]);
      if (row) await this.audit(client, actorId, shopId, platform, "DISCONNECTED", row.notice_version);
      await client.query("COMMIT");
      return { disconnected: true as const };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async cleanupExpiredAuthorizations(): Promise<void> {
    await this.pool.query("UPDATE marketplace_authorizations SET grants_enc=NULL,status='FAILED' WHERE expires_at<=now() AND status<>'COMPLETED'");
  }

  async maintainConnections(): Promise<void> {
    await this.cleanupExpiredAuthorizations();
    const candidates = await this.pool.query<{ shop_id: string; platform: Marketplace }>(`SELECT shop_id,platform
      FROM marketplace_connections WHERE status='CONNECTED' AND token_expires_at<now()+interval '5 minutes'
      AND refresh_retry_at<=now() ORDER BY token_expires_at LIMIT 10`);
    for (const candidate of candidates.rows) await this.refreshConnection(candidate.shop_id, candidate.platform);
  }

  private async refreshConnection(shopId: string, platform: Marketplace) {
    const client = await this.pool.connect();
    const lock = `marketplace:${shopId}:${platform}`;
    let locked = false;
    try {
      // Session lock serializes token rotation with disconnect/confirm. No transaction spans HTTP.
      locked = (await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [lock])).rows[0]!.locked;
      if (!locked) return;
      const row = (await client.query<{ id: string; credentials_enc: Buffer; refresh_expires_at: Date;
        consent_actor_id: string; notice_version: string }>(`SELECT id,credentials_enc,refresh_expires_at,consent_actor_id,notice_version
        FROM marketplace_connections WHERE shop_id=$1 AND platform=$2 AND status='CONNECTED'
        AND token_expires_at<now()+interval '5 minutes' AND refresh_retry_at<=now()`, [shopId, platform])).rows[0];
      if (!row) return;
      if (row.refresh_expires_at.getTime() <= Date.now()) {
        await client.query("UPDATE marketplace_connections SET status='REAUTH_REQUIRED' WHERE id=$1", [row.id]);
        await this.audit(client, row.consent_actor_id, shopId, platform, "REAUTH_REQUIRED", row.notice_version);
        return;
      }
      try {
        const grant = JSON.parse(decryptPii(row.credentials_enc, this.key)!) as AuthorizedMarketplaceShop;
        const credentials = await this.provider(platform).refresh(grant);
        await client.query(`UPDATE marketplace_connections SET credentials_enc=$2,token_expires_at=$3,
          refresh_expires_at=$4,refresh_retry_at=now() WHERE id=$1 AND status='CONNECTED'`,
        [row.id, encryptPii(JSON.stringify({ ...grant, credentials }), this.key), credentials.expiresAt, credentials.refreshExpiresAt]);
      } catch {
        await client.query("UPDATE marketplace_connections SET refresh_retry_at=now()+interval '5 minutes' WHERE id=$1", [row.id]);
      }
    } finally {
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lock]);
      client.release();
    }
  }

  private choices(auth: Authorization) { return { sessionId: auth.id, shops: this.grants(auth).map(({ id, name }) => ({ id, name })) }; }
  private grants(auth: Authorization): AuthorizedMarketplaceShop[] { return JSON.parse(decryptPii(auth.grants_enc, this.key) ?? "[]") as AuthorizedMarketplaceShop[]; }
  private provider(platform: Marketplace) {
    const provider = this.providers.find((item) => item.platform === platform);
    if (!provider?.configured) throw new DomainError("MARKETPLACE_NOT_CONFIGURED", 503, "Platform connection is not configured");
    return provider;
  }
  private async requireManager(client: Pick<Pool, "query"> | Pick<PoolClient, "query">, actorId: string, shopId: string) {
    const result = await client.query(`SELECT 1 FROM shop_memberships m JOIN profiles p ON p.id=m.user_id
      JOIN shops s ON s.id=m.shop_id WHERE m.user_id=$1 AND m.shop_id=$2 AND m.status='ACTIVE'
      AND m.role IN ('OWNER','MANAGER') AND p.status='ACTIVE' AND s.status<>'SUSPENDED'`, [actorId, shopId]);
    if (!result.rowCount) throw new DomainError("FORBIDDEN", 403, "Shop connection requires an active owner or manager");
  }
  private async audit(client: PoolClient, actorId: string, shopId: string, platform: Marketplace, event: string, version: string) {
    await client.query(`INSERT INTO marketplace_connection_events(id,shop_id,platform,actor_id,event,notice_version)
      VALUES($1,$2,$3,$4,$5,$6)`, [randomUUID(), shopId, platform, actorId, event, version]);
  }
}
function digest(state: string) { return createHash("sha256").update(state).digest("hex"); }
