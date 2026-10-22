import type { Provider } from "@nestjs/common";
import { CommerceModule, createDatabase, createMarketplaceProviders, createPayosClient, MarketplaceModule, OutboxModule, PayosPromotionTopups, type DatabaseContext } from "@reboxe/backend";

export const DATABASE = Symbol("DATABASE");
export const OUTBOX = Symbol("OUTBOX");
export const COMMERCE = Symbol("COMMERCE");
export const MARKETPLACE = Symbol("MARKETPLACE");
export const PAYOS_TOPUPS = Symbol("PAYOS_TOPUPS");

export const workerProviders: Provider[] = [
  { provide: PAYOS_TOPUPS, inject: [DATABASE], useFactory: (database: DatabaseContext) => new PayosPromotionTopups(database.pool,
    createPayosClient(), process.env.WEB_ORIGIN ?? "http://localhost:3000", process.env.PAYOS_EXPECTED_ACCOUNT_NUMBER ?? "", process.env.PAYOS_EXPECTED_BANK_BIN ?? "") },
  {
    provide: MARKETPLACE, inject: [DATABASE],
    useFactory: (database: DatabaseContext) => {
      const secret = process.env.MARKETPLACE_TOKEN_ENCRYPTION_KEY ?? process.env.SELLER_PII_ENCRYPTION_KEY;
      if (!secret && process.env.NODE_ENV === "production") throw new Error("Marketplace token encryption secret is required");
      return new MarketplaceModule(database.pool, secret ?? "local-dev-only-marketplace-secret-change-before-production", createMarketplaceProviders());
    }
  },
  {
    provide: DATABASE,
    useFactory: (): DatabaseContext =>
      createDatabase(
        process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
      )
  },
  {
    provide: OUTBOX,
    inject: [DATABASE],
    useFactory: (database: DatabaseContext): OutboxModule => new OutboxModule(database.pool)
  },
  {
    provide: COMMERCE,
    inject: [DATABASE],
    useFactory: (database: DatabaseContext): CommerceModule => new CommerceModule(
      database.pool,
      process.env.SELLER_PII_ENCRYPTION_KEY ?? "local-dev-only-seller-pii-encryption-key-change-before-production",
      process.env.NODE_ENV !== "production" && (process.env.COMMERCE_MODE ?? "SANDBOX") === "SANDBOX"
    )
  }
];
