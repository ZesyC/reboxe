import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { AccountModule } from "../src/modules/account";
import { ClaimsModule } from "../src/modules/claims";
import { CommerceModule } from "../src/modules/commerce";
import { FakeCarrierAdapter, FulfillmentModule } from "../src/modules/fulfillment";
import { IdentityModule } from "../src/modules/identity";
import { FinanceModule } from "../src/modules/finance/finance";
import { InventoryModule, type CatalogImageObject, type CatalogImageUploadIntent, type CatalogMediaStorage } from "../src/modules/inventory";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sellerId = "10000000-0000-4000-8000-000000000001";
const shopId = "RBX-01JTESTVERIFIED0000000000";
const staffId = "10000000-0000-4000-8000-000000000003";
const piiSecret = "test-seller-pii-encryption-key-at-least-32-characters";

class Storage implements CatalogMediaStorage {
  createUploadIntent(input: { key: string }): Promise<CatalogImageUploadIntent> { return Promise.resolve({ key: input.key, uploadUrl: `https://test/${input.key}`, expiresAt: new Date(Date.now() + 1000).toISOString(), headers: {} }); }
  inspectObject(): Promise<CatalogImageObject | null> { return Promise.resolve(null); }
  readObject(): Promise<Buffer> { return Promise.resolve(Buffer.alloc(0)); }
  deleteObject(): Promise<void> { return Promise.resolve(); }
  publicUrl(key: string): string { return `https://test/${key}`; }
}

describe("synthetic marketplace critical journey", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const storage = new Storage();
  const identity = new IdentityModule(pool, piiSecret, storage, storage);
  const inventory = new InventoryModule(pool, identity, storage, {
    encryptionSecret: "test-encryption-secret-at-least-32-characters",
    hmacSecret: "test-hmac-secret-at-least-32-characters"
  });
  const account = new AccountModule(pool, piiSecret);
  const commerce = new CommerceModule(pool, piiSecret, true);
  const fulfillment = new FulfillmentModule(pool, new FakeCarrierAdapter(), true);
  const claims = new ClaimsModule(pool, true);
  const buyerIds = ["10000000-0000-4000-8000-000000000002", staffId];
  const created = { batchId: "", packageId: "", listingId: "", promotionId: "", orderId: "", caseId: "", extraPackageId: "", extraListingId: "", extraOrderId: "", releaseBatchId: "", releasePackageIds: [] as string[], releaseListingIds: [] as string[], releaseOrderIds: [] as string[] };

  beforeAll(async () => {
    await pool.query("SELECT 1");
    await pool.query("DELETE FROM account_addresses WHERE user_id=ANY($1::uuid[])", [buyerIds]);
    await Promise.all(buyerIds.map(async (buyerId, index) => {
      await account.createAddress(buyerId, {
        label: `Sandbox ${index}`, recipientName: "Synthetic Buyer", phone: `090123456${index}`,
        addressLine: "123 Duong Synthetic", ward: "Phuong Test", district: "Quan Test", province: "Ha Noi", isDefault: true
      });
    }));
  });

  afterAll(async () => {
    if (created.caseId) {
      await pool.query("DELETE FROM refunds WHERE case_id=$1", [created.caseId]);
      await pool.query("DELETE FROM evidence_derivatives WHERE evidence_id IN (SELECT id FROM dispute_evidences WHERE case_id=$1)", [created.caseId]);
      await pool.query("DELETE FROM dispute_evidences WHERE case_id=$1", [created.caseId]);
      await pool.query("DELETE FROM dispute_case_events WHERE case_id=$1", [created.caseId]);
      await pool.query("DELETE FROM dispute_cases WHERE id=$1", [created.caseId]);
    }
    await pool.query("DELETE FROM processing_records WHERE actor_id=ANY($1::uuid[])", [buyerIds]);
    if (created.orderId) {
      await pool.query("DELETE FROM carrier_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id=$1)", [created.orderId]);
      await pool.query("DELETE FROM shipments WHERE order_id=$1", [created.orderId]);
      await pool.query("DELETE FROM order_events WHERE order_id=$1", [created.orderId]);
      await pool.query("DELETE FROM fund_holds WHERE order_id=$1", [created.orderId]);
      await pool.query("DELETE FROM sub_order_items WHERE sub_order_id IN (SELECT id FROM sub_orders WHERE order_id=$1)", [created.orderId]);
      await pool.query("DELETE FROM sub_orders WHERE order_id=$1", [created.orderId]);
      await pool.query("DELETE FROM orders WHERE id=$1", [created.orderId]);
    }
    if (created.extraOrderId) {
      await pool.query("DELETE FROM order_events WHERE order_id=$1", [created.extraOrderId]);
      await pool.query("DELETE FROM fund_holds WHERE order_id=$1", [created.extraOrderId]);
      await pool.query("DELETE FROM sub_order_items WHERE sub_order_id IN (SELECT id FROM sub_orders WHERE order_id=$1)", [created.extraOrderId]);
      await pool.query("DELETE FROM sub_orders WHERE order_id=$1", [created.extraOrderId]);
      await pool.query("DELETE FROM orders WHERE id=$1", [created.extraOrderId]);
    }
    await pool.query("DELETE FROM idempotency_records WHERE actor_id=ANY($1::uuid[])", [buyerIds]);
    if (created.releaseOrderIds.length) {
      await pool.query("DELETE FROM carrier_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id=ANY($1::text[]))", [created.releaseOrderIds]);
      await pool.query("DELETE FROM shipments WHERE order_id=ANY($1::text[])", [created.releaseOrderIds]);
      await pool.query("DELETE FROM order_events WHERE order_id=ANY($1::text[])", [created.releaseOrderIds]);
      await pool.query("DELETE FROM fund_holds WHERE order_id=ANY($1::text[])", [created.releaseOrderIds]);
      await pool.query("DELETE FROM sub_order_items WHERE sub_order_id IN (SELECT id FROM sub_orders WHERE order_id=ANY($1::text[]))", [created.releaseOrderIds]);
      await pool.query("DELETE FROM sub_orders WHERE order_id=ANY($1::text[])", [created.releaseOrderIds]);
      await pool.query("DELETE FROM orders WHERE id=ANY($1::text[])", [created.releaseOrderIds]);
    }
    if (created.releaseListingIds.length) await pool.query("DELETE FROM listings WHERE id=ANY($1::text[])", [created.releaseListingIds]);
    if (created.releasePackageIds.length) {
      await pool.query("DELETE FROM return_lines WHERE return_package_id=ANY($1::text[])", [created.releasePackageIds]);
      await pool.query("DELETE FROM return_packages WHERE id=ANY($1::text[])", [created.releasePackageIds]);
    }
    if (created.releaseBatchId) await pool.query("DELETE FROM return_import_batches WHERE id=$1", [created.releaseBatchId]);
    if (created.promotionId) await pool.query("DELETE FROM listing_promotions WHERE id=$1", [created.promotionId]);
    if (created.listingId) await pool.query("DELETE FROM listings WHERE id=$1", [created.listingId]);
    if (created.extraListingId) await pool.query("DELETE FROM listings WHERE id=$1", [created.extraListingId]);
    if (created.packageId) {
      await pool.query("DELETE FROM return_lines WHERE return_package_id=$1", [created.packageId]);
      await pool.query("DELETE FROM return_packages WHERE id=$1", [created.packageId]);
    }
    if (created.extraPackageId) {
      await pool.query("DELETE FROM return_lines WHERE return_package_id=$1", [created.extraPackageId]);
      await pool.query("DELETE FROM return_packages WHERE id=$1", [created.extraPackageId]);
    }
    if (created.batchId) {
      await pool.query("DELETE FROM listings WHERE return_package_id IN (SELECT id FROM return_packages WHERE ingest_batch_ref=$1)", [created.batchId]);
      await pool.query("DELETE FROM return_lines WHERE return_package_id IN (SELECT id FROM return_packages WHERE ingest_batch_ref=$1)", [created.batchId]);
      await pool.query("DELETE FROM return_packages WHERE ingest_batch_ref=$1", [created.batchId]);
      await pool.query("DELETE FROM return_import_batches WHERE id=$1", [created.batchId]);
    }
    await pool.query("DELETE FROM account_addresses WHERE user_id=ANY($1::uuid[])", [buyerIds]);
    await pool.end();
  });

  it("imports, scans, sells, fulfills and disputes one package without duplicate side effects", async () => {
    const tracking = `TRACK-${randomUUID()}`.toUpperCase();
    const tracking2 = `TRACK-${randomUUID()}`.toUpperCase();
    const csv = Buffer.from([
      "source_platform,source_order_ref,source_return_ref,source_tracking_no,source_item_ref,source_sku,source_quantity,product_name,variant_name,brand,source_category,original_unit_price_vnd,return_reason_raw,return_reason,returned_at,package_weight_gram,package_length_cm,package_width_cm,package_height_cm,product_image_urls,reboxe_category_id,package_disclosure,outer_package_notes,package_listing_price_vnd",
      `SHOPEE,ORDER-${randomUUID()},RETURN-${randomUUID()},${tracking},LINE-1,SKU-1,1,Sản phẩm synthetic,Mẫu test,REBOXE,Danh mục,100000,Đổi ý,CHANGE_MIND,2026-09-07T00:00:00Z,500,20,20,10,https://example.test/item.jpg,fashion,UNOPENED_UNINSPECTED,Seal nguyên,100000`,
      `SHOPEE,ORDER-${randomUUID()},RETURN-${randomUUID()},${tracking2},LINE-1,SKU-2,1,Sản phẩm cạnh tranh,Mẫu test,REBOXE,Danh mục,100000,Đổi ý,CHANGE_MIND,2026-09-07T00:00:00Z,500,20,20,10,https://example.test/item2.jpg,fashion,UNOPENED_UNINSPECTED,Seal nguyên,100000`
    ].join("\n"));
    const preview = await inventory.previewReturnManifest(sellerId, shopId, "synthetic.csv", csv);
    created.batchId = preview.batchId;
    const committed = await inventory.commitReturnManifest(sellerId, shopId, preview.batchId, randomUUID());
    expect(committed.packageIds).toHaveLength(2);

    const [first, retry] = await Promise.all([
      inventory.scanReturnPackage(sellerId, shopId, { scannedCode: tracking.toLowerCase(), codeType: "TRACKING_NO", platformHint: "SHOPEE" }),
      inventory.scanReturnPackage(sellerId, shopId, { scannedCode: ` ${tracking} `, codeType: "UNKNOWN", platformHint: null })
    ]);
    created.listingId = first.listing.id;
    created.packageId = first.packageId;
    expect(retry.listing.id).toBe(first.listing.id);
    await inventory.publish(sellerId, shopId, first.listing.id);
    const promotionCredit = (await commerce.seedPromotionCredit(sellerId, shopId, randomUUID())).creditVnd;
    const promotion = await commerce.sponsorListing(sellerId, shopId, first.listing.id, randomUUID());
    created.promotionId = promotion.id;
    expect((await inventory.listPublicListings({ sort: "newest" })).sponsored.map((item) => item.id)).toContain(first.listing.id);
    const publicJson = JSON.stringify(await inventory.getPublicListing(first.listing.id));
    expect(publicJson).toContain("UNOPENED_UNINSPECTED");
    expect(publicJson).not.toMatch(/tracking|sourceOrder|sourceReturn|returnPackageId/i);

    const addresses = await Promise.all(buyerIds.map((id) => account.listAddresses(id)));
    const attempts = await Promise.allSettled(buyerIds.map((buyerId, index) => commerce.initCheckout(
      buyerId, { items: [{ listingId: first.listing.id, quantity: 1 }], addressId: addresses[index]![0]!.id }, randomUUID()
    )));
    const successes = attempts.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof commerce.initCheckout>>> => result.status === "fulfilled");
    expect(successes).toHaveLength(1);
    const order = successes[0]!.value;
    created.orderId = order.id;
    const buyerId = order.buyerId;
    const paid = await commerce.payCheckout(buyerId, order.id, randomUUID());
    expect(paid).toMatchObject({ status: "CONFIRMED", paymentMethod: "SANDBOX_COD", mode: "SANDBOX" });
    expect(await commerce.getPromotionOverview(sellerId, shopId)).toMatchObject({ creditVnd: promotionCredit - 2_858, campaigns: [] });
    const ledger = await pool.query<{ total: string }>(
      "SELECT sum(p.amount_vnd)::text AS total FROM ledger_postings p JOIN ledger_transactions t ON t.id=p.transaction_id WHERE t.reference_id=$1 GROUP BY t.id", [order.id]
    );
    expect(ledger.rows.every((row) => row.total === "0")).toBe(true);

    const shipment = await fulfillment.createShipment(sellerId, shopId, order.id);
    expect(shipment.label).toContain("SYNTHETIC — NOT FOR SHIPPING");
    await fulfillment.applyEvent("pickup-1", order.id, "PICKED_UP");
    expect(await fulfillment.applyEvent("pickup-1", order.id, "PICKED_UP")).toMatchObject({ duplicate: true });
    await fulfillment.applyEvent("transit-1", order.id, "IN_TRANSIT");
    await fulfillment.applyEvent("delivered-1", order.id, "DELIVERED");
    await fulfillment.completeDelivery(order.id);
    expect(await inventory.getShopReviewEligibility(buyerId, shopId)).toMatchObject({ eligible: true });

    const dispute = await claims.openDispute(buyerId, order.id, "Kiện synthetic không đúng mô tả đã công bố");
    created.caseId = String(dispute.id);
    const record = await claims.createProcessingRecord(buyerId, { purpose: "DISPUTE_EVIDENCE", targetType: "DISPUTE", targetId: created.caseId, noticeVersion: "2026-09-07" });
    await claims.addEvidence(buyerId, created.caseId, { processingRecordId: record.id, fileName: "proof.txt", sizeBytes: 10, checksum: "a".repeat(64) });
    expect(await claims.listEvidence(sellerId, created.caseId)).toEqual([expect.objectContaining({ view: "DERIVATIVE" })]);
    const resolution = await claims.resolve({ id: staffId, aal: "aal2" }, created.caseId, {
      decision: "BUYER_REFUND", reason: "Hoàn tiền synthetic vì bản kê không khớp mô tả công khai.", refundAmountVnd: 50_000, returnRequired: true
    });
    expect(resolution).toMatchObject({ payoutCompleted: false });
    expect((await pool.query("SELECT status,return_required FROM refunds WHERE case_id=$1", [created.caseId])).rows[0]).toMatchObject({ status: "PAYOUT_READY", return_required: false });

    const extra = await inventory.scanReturnPackage(sellerId, shopId, { scannedCode: tracking2, codeType: "TRACKING_NO", platformHint: "SHOPEE" });
    created.extraPackageId = extra.packageId; created.extraListingId = extra.listing.id;
    await inventory.publish(sellerId, shopId, extra.listing.id);
    const addressId = (await account.listAddresses(buyerIds[0]!))[0]!.id;
    const race = await Promise.allSettled(Array.from({ length: 50 }, () => commerce.initCheckout(
      buyerIds[0]!, { items: [{ listingId: extra.listing.id, quantity: 1 }], addressId }, randomUUID()
    )));
    const winner = race.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof commerce.initCheckout>>> => result.status === "fulfilled");
    expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    created.extraOrderId = winner!.value.id;
    await pool.query("UPDATE orders SET expires_at=now()-interval '1 minute' WHERE id=$1", [created.extraOrderId]);
    expect(await commerce.expireReservations()).toBe(1);
    expect((await pool.query("SELECT inventory_status FROM return_packages WHERE id=$1", [created.extraPackageId])).rows[0]!.inventory_status).toBe("AVAILABLE");
    expect((await pool.query("SELECT status FROM fund_holds WHERE order_id=$1", [created.extraOrderId])).rows[0]!.status).toBe("RELEASED");
  });

  it("keeps posted ledger immutable and confirmed orders immune to expiry", async () => {
    const transaction = (await pool.query<{ id: string }>("SELECT id FROM ledger_transactions WHERE reference_id=$1 AND status='POSTED' LIMIT 1", [created.orderId])).rows[0]!;
    await expect(pool.query("UPDATE ledger_transactions SET reference_id='tampered' WHERE id=$1", [transaction.id])).rejects.toThrow(/POSTED_LEDGER_IMMUTABLE/);
    await expect(pool.query("INSERT INTO ledger_postings(id,transaction_id,account_key,amount_vnd) VALUES($1,$2,'tampered',1)", [randomUUID(), transaction.id]))
      .rejects.toThrow(/POSTED_LEDGER_IMMUTABLE/);
    await pool.query("UPDATE orders SET expires_at=now()-interval '1 minute' WHERE id=$1", [created.orderId]);
    expect(await commerce.expireReservations()).toBe(0);
    expect((await pool.query<{ status: string }>("SELECT status FROM fund_holds WHERE order_id=$1", [created.orderId])).rows[0]!.status).toBe("CAPTURED_SIMULATED");
    await expect(fulfillment.applyEvent("pickup-1", created.orderId, "IN_TRANSIT")).rejects.toMatchObject({ code: "EVENT_ID_CONFLICT" });
    await pool.query("UPDATE listings SET status='ACTIVE' WHERE id=$1", [created.listingId]);
    expect((await inventory.getPublicListing(created.listingId)).availableQuantity).toBe(0);
    await pool.query("UPDATE listings SET status='SOLD' WHERE id=$1", [created.listingId]);
    await expect(pool.query(
      "INSERT INTO refunds(id,case_id,order_id,amount_vnd,funder,return_required,status) VALUES('invalid-paid',$1,$2,1,'SELLER',false,'PAID')",
      [created.caseId, created.orderId]
    )).rejects.toThrow();
  });

  it("fake carrier is deterministic and supports injected failure", async () => {
    const adapter = new FakeCarrierAdapter();
    expect(await adapter.createOrder("same-order")).toEqual(await adapter.createOrder("same-order"));
    await expect(new FakeCarrierAdapter(true).quote("failure")).rejects.toThrow("FAKE_CARRIER_INJECTED_FAILURE");
  });

  it("builds finance from posted ledger and completed orders instead of the stale demo snapshot", async () => {
    const report = await new FinanceModule(pool, identity).getSnapshot(sellerId, shopId);
    const ledger = (await pool.query(`SELECT coalesce(sum(p.amount_vnd),0)::text AS amount FROM ledger_postings p
      JOIN ledger_transactions t ON t.id=p.transaction_id WHERE t.status='POSTED' AND p.account_key=$1`, [`shop:${shopId}:available`])).rows[0];
    expect(report.availableBalanceVnd).toBe(Number(ledger.amount));
    expect(report.unpricedOrderCount).toBeGreaterThanOrEqual(1);
    expect(report.productRevenue).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Sản phẩm synthetic" })]));
  });

  it("completes 20 synthetic release-candidate orders with balanced ledgers", async () => {
    const rows = Array.from({ length: 20 }, (_, index) => {
      const tracking = `RC-${index}-${randomUUID()}`.toUpperCase();
      return {
        tracking,
        csv: `SHOPEE,ORDER-${randomUUID()},RETURN-${randomUUID()},${tracking},LINE-${index},SKU-${index},1,Release candidate ${index},Mẫu test,REBOXE,Danh mục,100000,Đổi ý,CHANGE_MIND,2026-09-07T00:00:00Z,500,20,20,10,https://example.test/rc.jpg,fashion,UNOPENED_UNINSPECTED,Seal nguyên,100000`
      };
    });
    const csv = Buffer.from([
      "source_platform,source_order_ref,source_return_ref,source_tracking_no,source_item_ref,source_sku,source_quantity,product_name,variant_name,brand,source_category,original_unit_price_vnd,return_reason_raw,return_reason,returned_at,package_weight_gram,package_length_cm,package_width_cm,package_height_cm,product_image_urls,reboxe_category_id,package_disclosure,outer_package_notes,package_listing_price_vnd",
      ...rows.map((row) => row.csv)
    ].join("\n"));
    const preview = await inventory.previewReturnManifest(sellerId, shopId, "release-candidate.csv", csv);
    created.releaseBatchId = preview.batchId;
    const committed = await inventory.commitReturnManifest(sellerId, shopId, preview.batchId, randomUUID());
    created.releasePackageIds = committed.packageIds;
    const addressId = (await account.listAddresses(buyerIds[0]!))[0]!.id;
    for (const [index, row] of rows.entries()) {
      const draft = await inventory.scanReturnPackage(sellerId, shopId, { scannedCode: row.tracking, codeType: "TRACKING_NO", platformHint: "SHOPEE" });
      created.releaseListingIds.push(draft.listing.id);
      await inventory.publish(sellerId, shopId, draft.listing.id);
      const order = await commerce.initCheckout(buyerIds[0]!, { items: [{ listingId: draft.listing.id, quantity: 1 }], addressId }, randomUUID());
      created.releaseOrderIds.push(order.id);
      await commerce.payCheckout(buyerIds[0]!, order.id, randomUUID());
      await fulfillment.createShipment(sellerId, shopId, order.id);
      await fulfillment.applyEvent(`rc-${index}-pickup`, order.id, "PICKED_UP");
      await fulfillment.applyEvent(`rc-${index}-transit`, order.id, "IN_TRANSIT");
      await fulfillment.applyEvent(`rc-${index}-delivered`, order.id, "DELIVERED");
      await fulfillment.completeDelivery(order.id);
    }
    expect((await pool.query("SELECT count(*)::int AS count FROM orders WHERE id=ANY($1::text[]) AND status='COMPLETED'", [created.releaseOrderIds])).rows[0]!.count).toBe(20);
    expect((await pool.query(
      `SELECT count(*)::int AS count FROM (
         SELECT t.id FROM ledger_transactions t JOIN ledger_postings p ON p.transaction_id=t.id
         WHERE t.reference_id=ANY($1::text[]) GROUP BY t.id HAVING sum(p.amount_vnd)<>0
       ) unbalanced`, [created.releaseOrderIds]
    )).rows[0]!.count).toBe(0);
    expect(new Set(created.releasePackageIds).size).toBe(20);
  });
});
