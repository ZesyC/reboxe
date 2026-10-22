import type { CheckoutInitInput, CheckoutQuote, CommerceOrder, ListingPromotion, PromotionOverview, SellerFinanceProjection } from "@reboxe/shared";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ulid } from "ulid";
import { DomainError } from "../../errors";
import { createPiiKey, encryptPii } from "../identity/pii";

type OrderRow = {
  id: string; buyer_id: string; shop_id: string; display_name: string; status: CommerceOrder["status"];
  payment_method: "SANDBOX_COD" | null; subtotal_vnd: string; fee_vnd: string; total_vnd: string;
  expires_at: Date; confirmed_at: Date | null; completed_at: Date | null; created_at: Date;
  item_snapshot: CommerceOrder["item"];
};

type PromotionRow = {
  id: string; listing_id: string; fee_vnd: string; starts_at: Date; ends_at: Date;
};

const promotionFeeVnd = 20_000;
const promotionDurationMs = 7 * 24 * 60 * 60_000;
const sandboxShippingVnd = 30_000;

export class CommerceModule {
  private readonly piiKey: Buffer;

  constructor(private readonly pool: Pool, piiSecret: string, private readonly sandboxEnabled: boolean, private readonly promotionsEnabled = false) {
    this.piiKey = createPiiKey(piiSecret);
    if (process.env.NODE_ENV === "production" && sandboxEnabled) {
      throw new Error("Sandbox commerce must never be enabled in production");
    }
  }

  async seedSandboxBalance(shopId: string, amountVnd: number, referenceId = "DEFAULT"): Promise<void> {
    if (!this.sandboxEnabled) throw new DomainError("PAYMENT_METHOD_DISABLED", 409, "Sandbox commerce is disabled");
    if (!Number.isInteger(amountVnd) || amountVnd <= 0) throw new DomainError("VALIDATION_FAILED", 422, "Seed amount must be positive integer VND");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`wallet:${shopId}`]);
      await this.post(client, "SANDBOX_BALANCE_SEED", `${shopId}:${referenceId}`, [
        [`shop:${shopId}:available`, amountVnd], ["sandbox:clearing", -amountVnd]
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async seedPromotionCredit(actorId: string, shopId: string, idempotencyKey: string): Promise<PromotionOverview> {
    this.requireSandbox();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.requirePromotionManager(client, actorId, shopId);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`wallet:${shopId}`]);
      const prior = await this.lockIdempotency(client, actorId, "promotion.credit", idempotencyKey, hash({ shopId }));
      if (!prior) {
        await this.post(client, "PROMOTION_CREDIT_SEED", `${shopId}:${idempotencyKey}`, [
          [`shop:${shopId}:promotion_credit`, 100_000], ["sandbox:promotion_clearing", -100_000]
        ]);
        await this.saveIdempotency(client, actorId, "promotion.credit", idempotencyKey, { credited: true });
      }
      await client.query("COMMIT");
      return this.getPromotionOverview(actorId, shopId);
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  async getPromotionOverview(actorId: string, shopId: string): Promise<PromotionOverview> {
    await this.requirePromotionManager(this.pool, actorId, shopId);
    const campaigns = await this.pool.query<PromotionRow>(
      `SELECT id,listing_id,fee_vnd,starts_at,ends_at FROM listing_promotions
       WHERE shop_id=$1 AND status='ACTIVE' AND starts_at<=now() AND ends_at>now()
       ORDER BY ends_at`, [shopId]
    );
    return {
      creditVnd: await this.accountBalance(this.pool, `shop:${shopId}:promotion_credit`),
      campaigns: campaigns.rows.map(presentPromotion)
    };
  }

  async sponsorListing(actorId: string, shopId: string, listingId: string, idempotencyKey: string): Promise<ListingPromotion> {
    if (!this.sandboxEnabled && !this.promotionsEnabled) throw new DomainError("PAYMENT_METHOD_DISABLED", 503, "Promotion purchases are disabled");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.requirePromotionManager(client, actorId, shopId);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["promotion:home_top"]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`wallet:${shopId}`]);
      const prior = await this.lockIdempotency(client, actorId, "promotion.purchase", idempotencyKey, hash({ shopId, listingId }));
      if (prior) { await client.query("COMMIT"); return prior as ListingPromotion; }
      const listing = (await client.query<{ status: string; shop_status: string }>(
        `SELECT l.status,s.status AS shop_status FROM listings l JOIN shops s ON s.id=l.shop_id
         WHERE l.id=$1 AND l.shop_id=$2 FOR UPDATE OF l,s`, [listingId, shopId]
      )).rows[0];
      if (!listing) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
      if (listing.status !== "ACTIVE" || listing.shop_status !== "ACTIVE") {
        throw new DomainError("PROMOTION_LISTING_UNAVAILABLE", 409, "Only an active listing can be sponsored");
      }
      await client.query("UPDATE listing_promotions SET status='ENDED',ended_at=ends_at WHERE status='ACTIVE' AND ends_at<=now()");
      if ((await client.query("SELECT 1 FROM listing_promotions WHERE listing_id=$1 AND status='ACTIVE'", [listingId])).rowCount) {
        throw new DomainError("PROMOTION_ALREADY_ACTIVE", 409, "Listing is already sponsored");
      }
      // ponytail: six fixed slots avoid a ranking auction; add fair rotation when paid demand exceeds homepage capacity.
      if (Number((await client.query<{ count: string }>("SELECT count(*)::text AS count FROM listing_promotions WHERE status='ACTIVE' AND ends_at>now()" )).rows[0]!.count) >= 6) {
        throw new DomainError("PROMOTION_SLOTS_FULL", 409, "Sponsored slots are full");
      }
      if (await this.accountBalance(client, `shop:${shopId}:promotion_credit`) < promotionFeeVnd) {
        throw new DomainError("INSUFFICIENT_PROMOTION_CREDIT", 409, "Promotion credit is insufficient");
      }
      const id = `RBX-PROMO-${ulid()}`;
      const endsAt = new Date(Date.now() + promotionDurationMs);
      const row = (await client.query<PromotionRow>(
        `INSERT INTO listing_promotions(id,listing_id,shop_id,fee_vnd,ends_at)
         VALUES($1,$2,$3,$4,$5) RETURNING id,listing_id,fee_vnd,starts_at,ends_at`,
        [id, listingId, shopId, promotionFeeVnd, endsAt]
      )).rows[0]!;
      await this.post(client, "PROMOTION_PURCHASE", id, [
        [`shop:${shopId}:promotion_credit`, -promotionFeeVnd], ["platform:promotion_revenue", promotionFeeVnd]
      ]);
      const response = presentPromotion(row);
      await this.saveIdempotency(client, actorId, "promotion.purchase", idempotencyKey, response);
      await client.query("COMMIT");
      return response;
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  async quoteCheckout(actorId: string, input: CheckoutInitInput): Promise<CheckoutQuote> {
    this.requireSandbox();
    if (input.items.length !== 1) throw new DomainError("ONE_PACKAGE_PER_CHECKOUT", 422, "Checkout accepts exactly one package");
    const result = await this.pool.query<{ price: string; shipping: string | null }>(`SELECT coalesce(prior.subtotal_vnd,l.price)::text AS price,prior.fee_vnd::text AS shipping FROM listings l
      JOIN return_packages p ON p.id=l.return_package_id JOIN shops s ON s.id=l.shop_id
      LEFT JOIN LATERAL (SELECT o.subtotal_vnd,o.fee_vnd FROM orders o JOIN sub_orders so ON so.order_id=o.id
        JOIN sub_order_items i ON i.sub_order_id=so.id WHERE i.listing_id=l.id AND o.buyer_id=$3
        AND (o.status='RESERVED' AND o.expires_at>now() OR o.status IN ('CONFIRMED','READY_TO_SHIP','PICKED_UP','IN_TRANSIT','DELIVERED','COMPLETED'))
        ORDER BY o.created_at DESC LIMIT 1) prior ON true
      WHERE l.id=$1 AND ((l.status='ACTIVE' AND p.inventory_status='AVAILABLE' AND s.status='ACTIVE') OR prior.subtotal_vnd IS NOT NULL)
      AND EXISTS(SELECT 1 FROM account_addresses WHERE id=$2 AND user_id=$3)`,
    [input.items[0]!.listingId, input.addressId, actorId]);
    if (!result.rows[0]) throw new DomainError("ITEM_BEING_PURCHASED", 409, "Package or shipping address is unavailable");
    const subtotalVnd = Number(result.rows[0].price);
    const shippingVnd = result.rows[0].shipping === null ? sandboxShippingVnd : Number(result.rows[0].shipping);
    return { subtotalVnd, shippingVnd, totalVnd: subtotalVnd + shippingVnd, mode: "SANDBOX" };
  }

  async initCheckout(actorId: string, input: CheckoutInitInput, idempotencyKey: string): Promise<CommerceOrder> {
    this.requireSandbox();
    const requestHash = hash({ input });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO profiles(id,status) VALUES($1,'ACTIVE') ON CONFLICT(id) DO NOTHING", [actorId]);
      const prior = await this.lockIdempotency(client, actorId, "checkout.init", idempotencyKey, requestHash);
      if (prior) { await client.query("COMMIT"); return prior as CommerceOrder; }
      if (input.items.length !== 1) {
        const shops = await client.query<{ count: string }>("SELECT count(DISTINCT shop_id)::text AS count FROM listings WHERE id=ANY($1::text[])", [input.items.map((item) => item.listingId)]);
        if (Number(shops.rows[0]?.count) > 1) throw new DomainError("MULTI_SELLER_CHECKOUT_NOT_SUPPORTED", 422, "Multi-seller checkout is not supported");
        throw new DomainError("ONE_PACKAGE_PER_CHECKOUT", 422, "Checkout accepts exactly one package with quantity 1");
      }

      const address = (await client.query<{
        recipient_name_enc: Buffer; phone_enc: Buffer; address_line_enc: Buffer;
        ward: string; district: string; province: string;
      }>(
        `SELECT recipient_name_enc, phone_enc, address_line_enc, ward, district, province
         FROM account_addresses WHERE id = $1 AND user_id = $2`, [input.addressId, actorId]
      )).rows[0];
      if (!address) throw new DomainError("ADDRESS_NOT_FOUND", 404, "Address not found");

      const lockTarget = (await client.query<{ shop_id: string }>("SELECT shop_id FROM listings WHERE id=$1", [input.items[0]!.listingId])).rows[0];
      if (!lockTarget) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`wallet:${lockTarget.shop_id}`]);
      const listing = (await client.query<{
        id: string; shop_id: string; return_package_id: string | null; title: string; price: string;
        images: Array<{key: string}>; status: string; display_name: string; shop_status: string;
        disclosure: "UNOPENED_UNINSPECTED"; seal_status: string; package_status: string;
      }>(
        `SELECT l.id,l.shop_id,l.return_package_id,l.title,l.price,l.images,l.status,
                s.display_name,s.status AS shop_status,p.disclosure,p.seal_status,p.inventory_status AS package_status
         FROM listings l JOIN shops s ON s.id=l.shop_id
         JOIN return_packages p ON p.id=l.return_package_id
         WHERE l.id=$1 FOR UPDATE OF l,s,p`, [input.items[0]!.listingId]
      )).rows[0];
      if (!listing?.return_package_id) throw new DomainError("ONE_PACKAGE_PER_CHECKOUT", 422, "Only package-backed listings can be checked out");
      if (listing.shop_status !== "ACTIVE") throw new DomainError("SHOP_UNAVAILABLE", 409, "Shop is unavailable");
      if (listing.status === "SOLD" || listing.package_status === "SOLD") throw new DomainError("ITEM_SOLD", 409, "Package is sold");
      if (listing.status !== "ACTIVE" || listing.package_status !== "AVAILABLE") throw new DomainError("ITEM_BEING_PURCHASED", 409, "Package is being purchased");

      const subtotalVnd = Number(listing.price);
      const feeVnd = sandboxShippingVnd;
      const holdVnd = Math.ceil(subtotalVnd * 0.1);
      if (await this.accountBalance(client, `shop:${listing.shop_id}:available`) < holdVnd) {
        throw new DomainError("INSUFFICIENT_SHOP_FUNDS", 409, "Synthetic shop balance does not cover the hold");
      }
      const orderId = `RBX-ORD-${ulid()}`;
      const subOrderId = `RBX-SUB-${ulid()}`;
      const expiresAt = new Date(Date.now() + 30 * 60_000);
      const addressPayload = Buffer.from(JSON.stringify({
        recipientName: address.recipient_name_enc.toString("base64"), phone: address.phone_enc.toString("base64"),
        addressLine: address.address_line_enc.toString("base64"), ward: address.ward, district: address.district, province: address.province
      }));
      const item = {
        listingId: listing.id, title: listing.title, imageUrl: null,
        disclosure: listing.disclosure, sealStatus: listing.seal_status, priceVnd: subtotalVnd
      } satisfies CommerceOrder["item"];
      await client.query(
        `INSERT INTO orders(id,buyer_id,subtotal_vnd,fee_vnd,total_vnd,address_snapshot_enc,address_hash,fee_snapshot,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [orderId, actorId, subtotalVnd, feeVnd, subtotalVnd + feeVnd, encryptPii(addressPayload.toString("base64"), this.piiKey),
          createHash("sha256").update(addressPayload).digest("hex"), JSON.stringify({ version: "sandbox-v1", shippingVnd: feeVnd }), expiresAt]
      );
      await client.query(
        `INSERT INTO sub_orders(id,order_id,shop_id,shop_snapshot) VALUES($1,$2,$3,$4::jsonb)`,
        [subOrderId, orderId, listing.shop_id, JSON.stringify({ id: listing.shop_id, displayName: listing.display_name, status: listing.shop_status })]
      );
      await client.query(
        `INSERT INTO sub_order_items(id,sub_order_id,listing_id,return_package_id,item_snapshot,amount_vnd)
         VALUES($1,$2,$3,$4,$5::jsonb,$6)`,
        [`RBX-ITEM-${ulid()}`, subOrderId, listing.id, listing.return_package_id, JSON.stringify(item), subtotalVnd]
      );
      await client.query(
        `INSERT INTO fund_holds(id,order_id,shop_id,amount_vnd) VALUES($1,$2,$3,$4)`,
        [`RBX-HOLD-${ulid()}`, orderId, listing.shop_id, holdVnd]
      );
      await this.post(client, "HOLD_CREATE", orderId, [
        [`shop:${listing.shop_id}:available`, -holdVnd], [`shop:${listing.shop_id}:order_locked`, holdVnd]
      ]);
      await client.query("UPDATE listings SET status='RESERVED' WHERE id=$1", [listing.id]);
      await client.query("UPDATE return_packages SET inventory_status='RESERVED',reserved_until=$2 WHERE id=$1", [listing.return_package_id, expiresAt]);
      await this.addOrderEvent(client, orderId, null, "RESERVED", `checkout:${idempotencyKey}`);
      await client.query(
        `INSERT INTO outbox_events(id,topic,aggregate_id,payload,available_at) VALUES($1,'commerce.reservation_expire',$2,$3::jsonb,$4)`,
        [`RBX-${ulid()}`, orderId, JSON.stringify({ orderId }), expiresAt]
      );
      const response = await this.getOrderWithClient(client, actorId, orderId);
      await this.saveIdempotency(client, actorId, "checkout.init", idempotencyKey, response);
      await client.query("COMMIT");
      return response;
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  }

  async payCheckout(actorId: string, orderId: string, idempotencyKey: string): Promise<CommerceOrder> {
    this.requireSandbox();
    const requestHash = hash({ orderId, method: "SANDBOX_COD" });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const prior = await this.lockIdempotency(client, actorId, "checkout.pay", idempotencyKey, requestHash);
      if (prior) { await client.query("COMMIT"); return prior as CommerceOrder; }
      const row = (await client.query<{ status: string; expires_at: Date; shop_id: string; listing_id: string; return_package_id: string; amount_vnd: string }>(
        `SELECT o.status,o.expires_at,so.shop_id,i.listing_id,i.return_package_id,h.amount_vnd
         FROM orders o JOIN sub_orders so ON so.order_id=o.id JOIN sub_order_items i ON i.sub_order_id=so.id
         JOIN fund_holds h ON h.order_id=o.id WHERE o.id=$1 AND o.buyer_id=$2 FOR UPDATE OF o,h`, [orderId, actorId]
      )).rows[0];
      if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Order not found");
      if (row.status !== "RESERVED") throw new DomainError("INVALID_ORDER_STATE", 409, "Only a reserved order can be confirmed");
      if (row.expires_at <= new Date()) throw new DomainError("INVALID_ORDER_STATE", 409, "Reservation expired");
      await this.post(client, "HOLD_CAPTURE_SIMULATED", orderId, [
        [`shop:${row.shop_id}:order_locked`, -Number(row.amount_vnd)], ["sandbox:risk_reserve", Number(row.amount_vnd)]
      ]);
      await client.query("UPDATE fund_holds SET status='CAPTURED_SIMULATED',updated_at=now() WHERE order_id=$1 AND status='HELD'", [orderId]);
      await client.query("UPDATE orders SET status='CONFIRMED',payment_method='SANDBOX_COD',confirmed_at=now(),updated_at=now() WHERE id=$1", [orderId]);
      await client.query("UPDATE sub_orders SET status='CONFIRMED' WHERE order_id=$1", [orderId]);
      await client.query("UPDATE listings SET status='SOLD' WHERE id=$1", [row.listing_id]);
      await this.endPromotionAfterSale(client, row.listing_id, row.shop_id);
      await client.query("UPDATE return_packages SET inventory_status='SOLD',reserved_until=NULL WHERE id=$1", [row.return_package_id]);
      await this.addOrderEvent(client, orderId, "RESERVED", "CONFIRMED", `pay:${idempotencyKey}`);
      await client.query(`INSERT INTO outbox_events(id,topic,aggregate_id,payload) VALUES($1,'commerce.order_confirmed',$2,$3::jsonb)`,
        [`RBX-${ulid()}`, orderId, JSON.stringify({ orderId })]);
      const response = await this.getOrderWithClient(client, actorId, orderId);
      await this.saveIdempotency(client, actorId, "checkout.pay", idempotencyKey, response);
      await client.query("COMMIT"); return response;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async getOrder(actorId: string, orderId: string): Promise<CommerceOrder> {
    return this.getOrderWithClient(this.pool, actorId, orderId);
  }

  async listBuyerOrders(actorId: string): Promise<CommerceOrder[]> {
    const ids = await this.pool.query<{ id: string }>("SELECT id FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC", [actorId]);
    return Promise.all(ids.rows.map((row) => this.getOrder(actorId, row.id)));
  }

  async listSellerOrders(actorId: string, shopId: string): Promise<CommerceOrder[]> {
    if (!(await this.pool.query("SELECT 1 FROM shop_memberships WHERE user_id=$1 AND shop_id=$2 AND status='ACTIVE'", [actorId, shopId])).rowCount) {
      throw new DomainError("RESOURCE_NOT_FOUND", 404, "Shop not found");
    }
    const ids = await this.pool.query<{ id: string; buyer_id: string }>(
      "SELECT o.id,o.buyer_id FROM orders o JOIN sub_orders s ON s.order_id=o.id WHERE s.shop_id=$1 ORDER BY o.created_at DESC", [shopId]
    );
    return Promise.all(ids.rows.map((row) => this.getOrderWithClient(this.pool, row.buyer_id, row.id)));
  }

  async expireReservations(limit = 50): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const rows = await client.query<{ id: string; shop_id: string; listing_id: string; return_package_id: string; amount_vnd: string }>(
        `SELECT o.id,so.shop_id,i.listing_id,i.return_package_id,h.amount_vnd FROM orders o
         JOIN sub_orders so ON so.order_id=o.id JOIN sub_order_items i ON i.sub_order_id=so.id JOIN fund_holds h ON h.order_id=o.id
         WHERE o.status='RESERVED' AND o.expires_at<=now() ORDER BY o.expires_at FOR UPDATE OF o,h SKIP LOCKED LIMIT $1`, [limit]
      );
      for (const row of rows.rows) {
        await this.post(client, "HOLD_RELEASE", row.id, [
          [`shop:${row.shop_id}:order_locked`, -Number(row.amount_vnd)], [`shop:${row.shop_id}:available`, Number(row.amount_vnd)]
        ]);
        await client.query("UPDATE fund_holds SET status='RELEASED',updated_at=now() WHERE order_id=$1 AND status='HELD'", [row.id]);
        await client.query("UPDATE orders SET status='EXPIRED',updated_at=now() WHERE id=$1 AND status='RESERVED'", [row.id]);
        await client.query("UPDATE sub_orders SET status='EXPIRED' WHERE order_id=$1", [row.id]);
        await client.query("UPDATE listings SET status='ACTIVE' WHERE id=$1 AND status='RESERVED'", [row.listing_id]);
        await client.query("UPDATE return_packages SET inventory_status='AVAILABLE',reserved_until=NULL WHERE id=$1 AND inventory_status='RESERVED'", [row.return_package_id]);
        await this.addOrderEvent(client, row.id, "RESERVED", "EXPIRED", `expiry:${row.id}`);
      }
      await client.query("COMMIT"); return rows.rowCount ?? 0;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  async financeProjection(actorId: string, shopId: string): Promise<SellerFinanceProjection> {
    if (!(await this.pool.query("SELECT 1 FROM shop_memberships WHERE user_id=$1 AND shop_id=$2 AND status='ACTIVE'", [actorId, shopId])).rowCount) {
      throw new DomainError("RESOURCE_NOT_FOUND", 404, "Shop not found");
    }
    return {
      availableVnd: await this.accountBalance(this.pool, `shop:${shopId}:available`),
      orderLockedVnd: await this.accountBalance(this.pool, `shop:${shopId}:order_locked`),
      withdrawalPendingVnd: 0, unmatchedReserveVnd: 0, debtVnd: 0, simulated: true
    };
  }

  async reconcileFundCoverage(shopId: string): Promise<{ hidden: number; active: number }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`wallet:${shopId}`]);
      const available = await this.accountBalance(client, `shop:${shopId}:available`);
      const hidden = await client.query(
        `UPDATE listings SET status='HIDDEN_BY_FUND' WHERE shop_id=$1 AND status='ACTIVE' AND ceil(price*0.1)>$2 RETURNING id`,
        [shopId, available]
      );
      const active = await client.query(
        `UPDATE listings SET status='ACTIVE' WHERE shop_id=$1 AND status='HIDDEN_BY_FUND' AND ceil(price*0.1)<=$2 RETURNING id`,
        [shopId, available]
      );
      await client.query("COMMIT"); return { hidden: hidden.rowCount ?? 0, active: active.rowCount ?? 0 };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }

  private async getOrderWithClient(client: Pick<Pool, "query"> | Pick<PoolClient, "query">, actorId: string, orderId: string): Promise<CommerceOrder> {
    const row = (await client.query<OrderRow>(
      `SELECT o.id,o.buyer_id,o.status,o.payment_method,o.subtotal_vnd,o.fee_vnd,o.total_vnd,o.expires_at,o.confirmed_at,o.completed_at,o.created_at,
              so.shop_id,s.display_name,i.item_snapshot
       FROM orders o JOIN sub_orders so ON so.order_id=o.id JOIN shops s ON s.id=so.shop_id JOIN sub_order_items i ON i.sub_order_id=so.id
       WHERE o.id=$1 AND o.buyer_id=$2`, [orderId, actorId]
    )).rows[0];
    if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Order not found");
    const events = await client.query<{ to_status: string; created_at: Date }>("SELECT to_status,created_at FROM order_events WHERE order_id=$1 ORDER BY created_at,id", [orderId]);
    return {
      id: row.id, buyerId: row.buyer_id, shopId: row.shop_id, shopDisplayName: row.display_name, status: row.status,
      mode: "SANDBOX", paymentMethod: row.payment_method, subtotalVnd: Number(row.subtotal_vnd), feeVnd: Number(row.fee_vnd), totalVnd: Number(row.total_vnd),
      expiresAt: row.expires_at.toISOString(), confirmedAt: row.confirmed_at?.toISOString() ?? null, completedAt: row.completed_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(), item: row.item_snapshot,
      timeline: events.rows.map((event) => ({ status: event.to_status, at: event.created_at.toISOString() }))
    };
  }

  private async endPromotionAfterSale(client: PoolClient, listingId: string, shopId: string): Promise<void> {
    const campaign = (await client.query<PromotionRow>(
      "SELECT id,listing_id,fee_vnd,starts_at,ends_at FROM listing_promotions WHERE listing_id=$1 AND status='ACTIVE' FOR UPDATE",
      [listingId]
    )).rows[0];
    if (!campaign) return;
    const remainingDays = Math.max(0, Math.floor((campaign.ends_at.getTime() - Date.now()) / 86_400_000));
    const refundVnd = Math.floor(Number(campaign.fee_vnd) * remainingDays / 7);
    await client.query(
      "UPDATE listing_promotions SET status='ENDED',ended_at=now(),refunded_vnd=$2 WHERE id=$1",
      [campaign.id, refundVnd]
    );
    if (refundVnd) await this.post(client, "PROMOTION_REFUND", campaign.id, [
      [`shop:${shopId}:promotion_credit`, refundVnd], ["platform:promotion_revenue", -refundVnd]
    ]);
  }

  private async requirePromotionManager(client: Pick<Pool, "query"> | Pick<PoolClient, "query">, actorId: string, shopId: string): Promise<void> {
    if (!(await client.query(
      "SELECT 1 FROM shop_memberships WHERE user_id=$1 AND shop_id=$2 AND status='ACTIVE' AND role IN ('OWNER','MANAGER')",
      [actorId, shopId]
    )).rowCount) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Shop not found");
  }

  private async post(client: PoolClient, kind: string, referenceId: string, postings: Array<[string, number]>): Promise<void> {
    const existing = await client.query("SELECT 1 FROM ledger_transactions WHERE kind=$1 AND reference_id=$2", [kind, referenceId]);
    if (existing.rowCount) return;
    if (postings.reduce((sum, [, amount]) => sum + amount, 0) !== 0) throw new Error("Unbalanced ledger transaction");
    const id = `RBX-LTX-${ulid()}`;
    await client.query("INSERT INTO ledger_transactions(id,kind,reference_id) VALUES($1,$2,$3)", [id, kind, referenceId]);
    for (const [account, amount] of postings) {
      await client.query("INSERT INTO ledger_postings(id,transaction_id,account_key,amount_vnd) VALUES($1,$2,$3,$4)", [`RBX-LP-${ulid()}`, id, account, amount]);
    }
    await client.query("UPDATE ledger_transactions SET status='POSTED' WHERE id=$1", [id]);
  }

  private async accountBalance(client: Pick<Pool, "query"> | Pick<PoolClient, "query">, key: string): Promise<number> {
    return Number((await client.query<{ balance: string }>(
      `SELECT coalesce(sum(p.amount_vnd),0)::text AS balance FROM ledger_postings p
       JOIN ledger_transactions t ON t.id=p.transaction_id WHERE p.account_key=$1 AND t.status='POSTED'`, [key]
    )).rows[0]!.balance);
  }

  private async lockIdempotency(client: PoolClient, actorId: string, scope: string, key: string, requestHash: string): Promise<unknown | null> {
    if (!key || key.length > 200) throw new DomainError("VALIDATION_FAILED", 422, "Idempotency-Key is required");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`idem:${actorId}:${scope}:${key}`]);
    const row = (await client.query<{ request_hash: string; response: unknown }>(
      "SELECT request_hash,response FROM idempotency_records WHERE actor_id=$1 AND scope=$2 AND idempotency_key=$3", [actorId, scope, key]
    )).rows[0];
    if (row?.request_hash !== undefined && row.request_hash !== requestHash) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "Idempotency key payload differs");
    if (!row) await client.query(
      "INSERT INTO idempotency_records(actor_id,scope,idempotency_key,request_hash) VALUES($1,$2,$3,$4)", [actorId, scope, key, requestHash]
    );
    return row?.response ?? null;
  }

  private async saveIdempotency(client: PoolClient, actorId: string, scope: string, key: string, response: unknown): Promise<void> {
    await client.query("UPDATE idempotency_records SET response=$4::jsonb WHERE actor_id=$1 AND scope=$2 AND idempotency_key=$3", [actorId, scope, key, JSON.stringify(response)]);
  }

  private async addOrderEvent(client: PoolClient, orderId: string, from: string | null, to: string, eventKey: string): Promise<void> {
    await client.query(
      `INSERT INTO order_events(id,order_id,event_key,from_status,to_status,source) VALUES($1,$2,$3,$4,$5,'SYSTEM') ON CONFLICT(event_key) DO NOTHING`,
      [`RBX-OE-${ulid()}`, orderId, eventKey, from, to]
    );
  }

  private requireSandbox(): void {
    if (!this.sandboxEnabled) throw new DomainError("PAYMENT_METHOD_DISABLED", 409, "SANDBOX_COD is disabled");
  }
}

function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function presentPromotion(row: PromotionRow): ListingPromotion {
  return {
    id: row.id,
    listingId: row.listing_id,
    feeVnd: Number(row.fee_vnd),
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString()
  };
}
