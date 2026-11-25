import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { DomainError } from "../src/errors";
import { IdentityModule } from "../src/modules/identity";
import {
  InventoryModule,
  type CatalogImageObject,
  type CatalogImageUploadIntent,
  type CatalogMediaStorage
} from "../src/modules/inventory";
import { OutboxModule } from "../src/platform/outbox";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const verifiedActor = "10000000-0000-4000-8000-000000000001";
const pendingActor = "10000000-0000-4000-8000-000000000002";
const verifiedShop = "RBX-01JTESTVERIFIED0000000000";
const pendingShop = "RBX-01JTESTPENDING00000000000";

class FakeCatalogMediaStorage implements CatalogMediaStorage {
  readonly objects = new Map<string, CatalogImageObject>();

  async createUploadIntent(input: { key: string; mimeType: string; sizeBytes: number }): Promise<CatalogImageUploadIntent> {
    return {
      key: input.key,
      uploadUrl: `https://storage.test/${input.key}`,
      expiresAt: "2026-09-04T12:00:00.000Z",
      headers: { "content-type": input.mimeType }
    };
  }

  async inspectObject(key: string): Promise<CatalogImageObject | null> {
    return this.objects.get(key) ?? null;
  }

  async readObject(key: string): Promise<Buffer> {
    if (!this.objects.has(key)) throw new Error("Object not found");
    return Buffer.from(key);
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  publicUrl(key: string): string {
    return `https://storage.test/public/${key}`;
  }
}

function imageObject(key: string, hashCharacter = "a"): CatalogImageObject {
  return {
    key,
    mimeType: "image/png",
    sizeBytes: 1024,
    width: 800,
    height: 500,
    sha256: hashCharacter.repeat(64)
  };
}

describe("Sprint 1 PostgreSQL vertical slice", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const mediaStorage = new FakeCatalogMediaStorage();
  const kycStorage = new FakeCatalogMediaStorage();
  const identity = new IdentityModule(
    pool,
    "test-seller-pii-encryption-key-at-least-32-characters",
    mediaStorage,
    kycStorage
  );
  const inventory = new InventoryModule(pool, identity, mediaStorage, {
    encryptionSecret: "test-encryption-secret-at-least-32-characters",
    hmacSecret: "test-hmac-secret-at-least-32-characters"
  });
  const outbox = new OutboxModule(pool);

  async function addPurchaseOrder(id: string, buyerId: string, shopId: string, status: string) {
    const canonicalStatus = ({ PENDING: "RESERVED", CONFIRMED: "CONFIRMED", SHIPPING: "IN_TRANSIT", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED_BY_SELLER" } as Record<string, string>)[status] ?? status;
    await pool.query(
      `INSERT INTO orders(id,buyer_id,status,subtotal_vnd,fee_vnd,total_vnd,address_snapshot_enc,address_hash,fee_snapshot,expires_at,completed_at)
       VALUES($1,$2,$3,100000,0,100000,$4,'test','{}'::jsonb,now()+interval '30 minutes',CASE WHEN $3='COMPLETED' THEN now() END)`,
      [id, buyerId, canonicalStatus, Buffer.from("synthetic")]
    );
    await pool.query("INSERT INTO sub_orders(id,order_id,shop_id,shop_snapshot,status) VALUES($1,$2,$3,'{}'::jsonb,$4)", [`${id}-SUB`, id, shopId, canonicalStatus]);
  }

  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM shop_reviews WHERE reviewer_id IN ($1, $2)", [verifiedActor, pendingActor]);
    await pool.query("DELETE FROM purchase_orders WHERE id LIKE 'RBX-REVIEW-TEST-%'");
    await pool.query("DELETE FROM refunds");
    await pool.query("DELETE FROM evidence_derivatives");
    await pool.query("DELETE FROM dispute_evidences");
    await pool.query("DELETE FROM dispute_case_events");
    await pool.query("DELETE FROM dispute_cases");
    await pool.query("DELETE FROM processing_records WHERE purpose<>'KYC'");
    await pool.query("DELETE FROM carrier_events");
    await pool.query("DELETE FROM shipments");
    await pool.query("DELETE FROM order_events");
    await pool.query("DELETE FROM fund_holds");
    await pool.query("DELETE FROM sub_order_items");
    await pool.query("DELETE FROM sub_orders WHERE order_id LIKE 'RBX-REVIEW-TEST-%'");
    await pool.query("DELETE FROM sub_orders");
    await pool.query("DELETE FROM orders");
    await pool.query("DELETE FROM listings WHERE id NOT LIKE 'RBX-01JTEST%'");
    await pool.query("DELETE FROM return_lines");
    await pool.query("DELETE FROM return_packages");
    await pool.query("DELETE FROM return_import_batches");
    await pool.query("TRUNCATE outbox_events");
    mediaStorage.objects.clear();
    kycStorage.objects.clear();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("publishes a verified shop listing and commits one outbox event", async () => {
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Verified item"));
    await attachValidImage(draft.id);
    const published = await inventory.publish(verifiedActor, verifiedShop, draft.id);
    const publicListing = await inventory.getPublicListing(draft.id);
    const events = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM outbox_events WHERE aggregate_id = $1",
      [draft.id]
    );

    expect(published.listing.status).toBe("ACTIVE");
    expect(published.policy).toMatchObject({ outcome: "ACTIVE", policyLevel: null });
    expect(publicListing.id).toBe(draft.id);
    expect(events.rows[0]?.count).toBe("1");
  });

  it("reuses a draft after concurrent retries and preserves its current status", async () => {
    const key = randomUUID();
    const input = listingInput("Tin đăng nhanh");
    try {
      const [first, retry] = await Promise.all([
        inventory.createDraft(verifiedActor, verifiedShop, input, key),
        inventory.createDraft(verifiedActor, verifiedShop, input, key)
      ]);
      expect(retry.id).toBe(first.id);
      await expect(inventory.createDraft(verifiedActor, verifiedShop, { ...input, price: input.price + 1 }, key))
        .rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

      await attachValidImage(first.id);
      await inventory.publish(verifiedActor, verifiedShop, first.id);
      const published = await inventory.createDraft(verifiedActor, verifiedShop, input, key);
      expect(published).toMatchObject({ id: first.id, status: "ACTIVE" });
      expect(published.images).toHaveLength(1);
    } finally {
      await pool.query("DELETE FROM idempotency_records WHERE actor_id = $1 AND scope = 'inventory.create-draft' AND idempotency_key = $2", [verifiedActor, key]);
    }
  });

  it("blocks a pending shop without leaking a public listing", async () => {
    const draft = await inventory.createDraft(pendingActor, pendingShop, listingInput("Pending item"));

    await expect(inventory.publish(pendingActor, pendingShop, draft.id)).rejects.toMatchObject<Partial<DomainError>>({
      code: "SHOP_NOT_VERIFIED",
      status: 409
    });
    await expect(inventory.getPublicListing(draft.id)).rejects.toMatchObject<Partial<DomainError>>({
      code: "RESOURCE_NOT_FOUND"
    });
    const state = await pool.query<{ status: string }>("SELECT status FROM listings WHERE id = $1", [draft.id]);
    expect(state.rows[0]?.status).toBe("DRAFT");
  });

  it.each(["PROCESSING", "MANUAL_REVIEW", "REJECTED"])("blocks publish while KYC is %s", async (status) => {
    await pool.query("UPDATE shops SET kyc_status = $2 WHERE id = $1", [pendingShop, status]);
    try {
      const draft = await inventory.createDraft(pendingActor, pendingShop, listingInput("Unverified KYC"));
      await expect(inventory.publish(pendingActor, pendingShop, draft.id)).rejects.toMatchObject({ code: "SHOP_NOT_VERIFIED" });
    } finally { await pool.query("UPDATE shops SET kyc_status = 'PENDING' WHERE id = $1", [pendingShop]); }
  });

  it("creates a pending seller only after the complete mock onboarding payload", async () => {
    const displayName = `Synthetic onboarding ${randomUUID()}`;
    const input = {
      displayName,
      legalType: "INDIVIDUAL" as const,
      description: "Synthetic seller onboarding profile",
      phone: "0901234567",
      pickupAddress: {
        contactName: "Nguyen Van Test",
        addressLine: "123 Duong Test",
        province: "Ha Noi",
        district: "Cau Giay",
        ward: "Dich Vong"
      },
      kyc: {
        taxCode: "MOCK-TAX-001",
        bankCode: "MOCK-BANK",
        bankAccount: "0000000000",
        accountHolder: "NGUYEN VAN TEST"
      },
      documents: {
        avatarKey: `seller-onboarding/${pendingActor}/avatar/avatar.png`,
        cccdFrontKey: `seller-onboarding/${pendingActor}/cccd/front.png`,
        cccdBackKey: `seller-onboarding/${pendingActor}/cccd/back.png`
      },
      carrierCodes: ["GHN", "GHTK"] as const
    };
    let shopId: string | undefined;

    try {
      mediaStorage.objects.set(input.documents.avatarKey, imageObject(input.documents.avatarKey));
      kycStorage.objects.set(input.documents.cccdFrontKey, imageObject(input.documents.cccdFrontKey, "b"));
      kycStorage.objects.set(input.documents.cccdBackKey, imageObject(input.documents.cccdBackKey, "c"));
      const created = await identity.onboardShop(pendingActor, input);
      shopId = created.shopId;
      expect(created).toMatchObject({ displayName, role: "OWNER", kycStatus: "PENDING", shopStatus: "ONBOARDING" });

      const stored = await pool.query<{ phone_enc: Buffer; kyc_mode: string; carrier_codes: string[] }>(
        "SELECT phone_enc, kyc_mode, carrier_codes FROM shop_onboarding_profiles WHERE shop_id = $1",
        [shopId]
      );
      expect(stored.rows[0]?.phone_enc.equals(Buffer.from(input.phone))).toBe(false);
      expect(stored.rows[0]).toMatchObject({ kyc_mode: "MANUAL", carrier_codes: ["GHN", "GHTK"] });

      await expect(identity.onboardShop(pendingActor, input))
        .rejects.toMatchObject<Partial<DomainError>>({ code: "SHOP_NAME_TAKEN", status: 409 });
    } finally {
      if (shopId) {
        await pool.query("DELETE FROM shop_memberships WHERE shop_id = $1", [shopId]);
        await pool.query("DELETE FROM shops WHERE id = $1", [shopId]);
      }
    }
  });

  it("does not expose another shop through an ownership probe", async () => {
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Private draft"));
    await expect(inventory.publish(pendingActor, verifiedShop, draft.id)).rejects.toMatchObject<Partial<DomainError>>({
      code: "RESOURCE_NOT_FOUND",
      status: 404
    });
  });

  it("updates an owned draft and persists every editable field", async () => {
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Original title"));
    const input = {
      ...listingInput("Updated title"),
      description: "Updated description",
      categoryId: "accessories",
      conditionGrade: "LIKE_NEW_99" as const,
      conditionNotes: "Updated condition notes",
      price: 135_000,
      weightGram: 650
    };

    const updated = await inventory.updateDraft(verifiedActor, verifiedShop, draft.id, input);
    const persisted = await inventory.listShopListings(verifiedActor, verifiedShop);

    expect(updated).toMatchObject(input);
    expect(persisted.find((listing) => listing.id === draft.id)).toMatchObject(input);
  });

  it("rejects updating a listing after it leaves draft state", async () => {
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Published item"));
    await attachValidImage(draft.id);
    await inventory.publish(verifiedActor, verifiedShop, draft.id);

    await expect(
      inventory.updateDraft(verifiedActor, verifiedShop, draft.id, listingInput("Forbidden update"))
    ).rejects.toMatchObject<Partial<DomainError>>({
      code: "INVALID_LISTING_STATE",
      status: 409
    });
  });

  it("does not allow another shop actor to update a draft by listing ID", async () => {
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Owned draft"));

    await expect(
      inventory.updateDraft(pendingActor, pendingShop, draft.id, listingInput("IDOR update"))
    ).rejects.toMatchObject<Partial<DomainError>>({
      code: "RESOURCE_NOT_FOUND",
      status: 404
    });
  });

  it("rejects an unknown category on create and update", async () => {
    await expect(inventory.createDraft(
      verifiedActor,
      verifiedShop,
      { ...listingInput("Unknown category"), categoryId: "does-not-exist" }
    )).rejects.toMatchObject<Partial<DomainError>>({ code: "INVALID_CATEGORY", status: 422 });

    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Known category"));
    await expect(inventory.updateDraft(
      verifiedActor,
      verifiedShop,
      draft.id,
      { ...listingInput("Unknown category update"), categoryId: "does-not-exist" }
    )).rejects.toMatchObject<Partial<DomainError>>({ code: "INVALID_CATEGORY", status: 422 });
  });

  it("keeps a banned category in draft and stores the policy snapshot", async () => {
    const draft = await inventory.createDraft(
      verifiedActor,
      verifiedShop,
      { ...listingInput("Banned item"), categoryId: "banned-weapons-explosives" }
    );

    await expect(inventory.publish(verifiedActor, verifiedShop, draft.id))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "LISTING_CATEGORY_BANNED", status: 422 });
    const state = await pool.query<{
      status: string;
      applied_policy_version: string;
      applied_policy_snapshot: { policyLevel: string };
    }>(
      "SELECT status, applied_policy_version, applied_policy_snapshot FROM listings WHERE id = $1",
      [draft.id]
    );
    expect(state.rows[0]).toMatchObject({
      status: "DRAFT",
      applied_policy_version: "2026-08-25-dev",
      applied_policy_snapshot: { policyLevel: "BANNED" }
    });
    expect((await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM outbox_events WHERE aggregate_id = $1",
      [draft.id]
    )).rows[0]?.count).toBe("0");
  });

  it("moves a manual-review category to pending review without a published event", async () => {
    const draft = await inventory.createDraft(
      verifiedActor,
      verifiedShop,
      { ...listingInput("Cosmetic item"), categoryId: "cosmetics" }
    );
    await attachValidImage(draft.id);

    const published = await inventory.publish(verifiedActor, verifiedShop, draft.id);
    const events = await pool.query<{ topic: string }>(
      "SELECT topic FROM outbox_events WHERE aggregate_id = $1",
      [draft.id]
    );

    expect(published.listing.status).toBe("PENDING_REVIEW");
    expect(published.policy).toMatchObject({ outcome: "PENDING_REVIEW", policyLevel: "MANUAL_REVIEW" });
    expect(events.rows.map((event) => event.topic)).toEqual(["listing.pending_review"]);
    await expect(inventory.getPublicListing(draft.id))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "RESOURCE_NOT_FOUND" });
  });

  it("requires detailed notes for a disclosure category and keeps the draft", async () => {
    const draft = await inventory.createDraft(
      verifiedActor,
      verifiedShop,
      { ...listingInput("Disclosure item"), categoryId: "used-electronics", conditionNotes: "Mới" }
    );
    await attachValidImage(draft.id);

    await expect(inventory.publish(verifiedActor, verifiedShop, draft.id))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "LISTING_DISCLOSURE_REQUIRED", status: 422 });
    expect((await inventory.listShopListings(verifiedActor, verifiedShop))
      .find((listing) => listing.id === draft.id)?.status).toBe("DRAFT");
  });

  it("ignores an expired category policy", async () => {
    await pool.query(
      `INSERT INTO categories (id, name, active) VALUES ('expired-policy-category', 'Expired policy', true)
       ON CONFLICT (id) DO UPDATE SET active = true`
    );
    await pool.query(
      `INSERT INTO restricted_categories (
         id, category_id, policy_level, rule_snapshot, policy_version, effective_from, effective_to, approved_by
       ) VALUES (
         'RP-expired-test', 'expired-policy-category', 'BANNED', '{}'::jsonb, 'expired-test',
         '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z', $1
       ) ON CONFLICT (category_id, policy_version) DO UPDATE SET effective_to = EXCLUDED.effective_to`,
      [verifiedActor]
    );
    const draft = await inventory.createDraft(
      verifiedActor,
      verifiedShop,
      { ...listingInput("Expired policy item"), categoryId: "expired-policy-category" }
    );
    await attachValidImage(draft.id);

    const published = await inventory.publish(verifiedActor, verifiedShop, draft.id);

    expect(published.listing.status).toBe("ACTIVE");
    expect(published.policy.policyLevel).toBeNull();
  });

  it("returns only active, non-banned categories for the picker", async () => {
    await pool.query(
      `INSERT INTO categories (id, name, active) VALUES ('inactive-test-category', 'Inactive', false)
       ON CONFLICT (id) DO UPDATE SET active = false`
    );

    const categories = await inventory.listCategories();

    expect(categories.map((category) => category.id)).toContain("home");
    expect(categories.map((category) => category.id)).not.toContain("inactive-test-category");
    expect(categories.map((category) => category.id)).not.toContain("banned-weapons-explosives");
  });

  it("searches public listings without accents and hides non-public inventory", async () => {
    const active = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Váy lụa dáng dài"));
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Váy lụa còn nháp"));
    const inactiveShopListing = await inventory.createDraft(pendingActor, pendingShop, listingInput("Váy lụa shop khóa"));
    await attachValidImage(active.id);
    await inventory.publish(verifiedActor, verifiedShop, active.id);
    await pool.query("UPDATE listings SET status = 'ACTIVE', published_at = now() WHERE id = $1", [inactiveShopListing.id]);

    const page = await inventory.listPublicListings({ q: "vay lua", sort: "newest" });

    expect(page.items.map((listing) => listing.id)).toContain(active.id);
    expect(page.items.map((listing) => listing.id)).not.toContain(draft.id);
    expect(page.items.map((listing) => listing.id)).not.toContain(inactiveShopListing.id);
    expect(page.items.find((listing) => listing.id === active.id)).not.toHaveProperty("weightGram");

    const shoppingPage = await inventory.listPublicListings({ q: "vay lua", sort: "newest" }, { maxPriceVnd: undefined });
    const shoppingIds = shoppingPage.items.map((listing) => listing.id);
    expect(shoppingIds).toContain(active.id);
    expect(shoppingIds).not.toContain(draft.id);
    expect(shoppingIds).not.toContain(inactiveShopListing.id);
  });

  it("rejects a malformed or wrong-sort catalog cursor", async () => {
    await expect(inventory.listPublicListings({ cursor: "not-a-cursor", sort: "newest" }))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "VALIDATION_FAILED", status: 422 });
  });

  it("filters the public catalog by shop", async () => {
    const page = await inventory.listPublicListings({ shopId: verifiedShop, sort: "newest" });

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((listing) => listing.shopId === verifiedShop)).toBe(true);
  });

  it("returns a public shop profile backed by the active shop", async () => {
    const shop = await inventory.getPublicShop(verifiedShop);
    const activeListings = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM listings WHERE shop_id = $1 AND status = 'ACTIVE'",
      [verifiedShop]
    );

    expect(shop).toMatchObject({ id: verifiedShop, verified: true });
    expect(shop.activeListingCount).toBe(Number(activeListings.rows[0]?.count));
    await expect(inventory.getPublicShop(pendingShop))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "RESOURCE_NOT_FOUND", status: 404 });
  });

  it("creates one editable review per actor and aggregates the shop rating", async () => {
    await addPurchaseOrder("RBX-REVIEW-TEST-COMPLETED", pendingActor, verifiedShop, "COMPLETED");
    await expect(inventory.getShopReviewEligibility(pendingActor, verifiedShop))
      .resolves.toEqual({ eligible: true, reason: null });
    const created = await inventory.upsertShopReview(pendingActor, verifiedShop, {
      rating: 4,
      content: "Shop đóng gói cẩn thận"
    });
    const updated = await inventory.upsertShopReview(pendingActor, verifiedShop, {
      rating: 5,
      content: "Shop hỗ trợ rất tốt"
    });

    expect(updated.id).toBe(created.id);
    expect(await inventory.getMyShopReview(pendingActor, verifiedShop)).toMatchObject({ rating: 5 });
    expect(await inventory.listShopReviews(verifiedShop)).toEqual([expect.objectContaining({ rating: 5 })]);
    expect(await inventory.getPublicShop(verifiedShop)).toMatchObject({ averageRating: 5, reviewCount: 1 });
    await addPurchaseOrder("RBX-REVIEW-TEST-MEMBER", verifiedActor, verifiedShop, "COMPLETED");
    await expect(inventory.upsertShopReview(verifiedActor, verifiedShop, { rating: 5, content: "Tự đánh giá" }))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "FORBIDDEN", status: 403 });
  });

  it("blocks a buyer without an order", async () => {
    await expect(inventory.getShopReviewEligibility(pendingActor, verifiedShop))
      .resolves.toEqual({ eligible: false, reason: "COMPLETED_ORDER_REQUIRED" });
    await expect(inventory.upsertShopReview(pendingActor, verifiedShop, { rating: 5, content: "Chưa mua hàng" }))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "REVIEW_NOT_ELIGIBLE", status: 403 });
  });

  it.each(["PENDING", "CONFIRMED", "SHIPPING", "CANCELLED"])("blocks a buyer whose order is %s", async (status) => {
    await addPurchaseOrder(`RBX-REVIEW-TEST-${status}`, pendingActor, verifiedShop, status);

    await expect(inventory.upsertShopReview(pendingActor, verifiedShop, { rating: 4, content: "Đơn chưa hoàn thành" }))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "REVIEW_NOT_ELIGIBLE", status: 403 });
  });

  it("does not accept another buyer's completed order or one from another shop", async () => {
    await addPurchaseOrder("RBX-REVIEW-TEST-OTHER-BUYER", verifiedActor, verifiedShop, "COMPLETED");
    await addPurchaseOrder("RBX-REVIEW-TEST-OTHER-SHOP", pendingActor, pendingShop, "COMPLETED");

    await expect(inventory.upsertShopReview(pendingActor, verifiedShop, { rating: 4, content: "Sai đơn hàng" }))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "REVIEW_NOT_ELIGIBLE", status: 403 });
  });

  it("claims an event once across concurrent workers and remains idempotent", async () => {
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Outbox item"));
    await attachValidImage(draft.id);
    await inventory.publish(verifiedActor, verifiedShop, draft.id);

    const claimed = await Promise.all([outbox.processBatch(1), outbox.processBatch(1)]);
    expect(claimed.sort()).toEqual([0, 1]);
    expect(await outbox.processBatch(1)).toBe(0);
    const event = await pool.query<{ status: string; attempts: number }>(
      "SELECT status, attempts FROM outbox_events WHERE aggregate_id = $1",
      [draft.id]
    );
    expect(event.rows[0]).toMatchObject({ status: "PROCESSED", attempts: 1 });
  });

  it("denies direct table access to the authenticated browser role", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE authenticated");
      await expect(client.query("SELECT * FROM listings")).rejects.toThrow(/permission denied/i);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("verifies storage metadata before attaching an image to an owned draft", async () => {
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Image metadata item"));
    const intent = await inventory.createImageUploadIntent(
      verifiedActor,
      verifiedShop,
      draft.id,
      { mimeType: "image/webp", sizeBytes: 42_000 }
    );
    mediaStorage.objects.set(intent.key, {
      key: intent.key,
      mimeType: "image/webp",
      sizeBytes: 42_000,
      width: 1200,
      height: 900,
      sha256: "a".repeat(64)
    });

    const completed = await inventory.completeImageUpload(verifiedActor, verifiedShop, draft.id, intent.key);

    expect(completed.images).toEqual([{
      key: intent.key,
      url: `https://storage.test/public/${intent.key}`,
      width: 1200,
      height: 900
    }]);
  });

  it("rejects invalid authoritative metadata and another shop's image path", async () => {
    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Invalid image item"));
    const intent = await inventory.createImageUploadIntent(
      verifiedActor,
      verifiedShop,
      draft.id,
      { mimeType: "image/png", sizeBytes: 100 }
    );
    mediaStorage.objects.set(intent.key, {
      key: intent.key,
      mimeType: "text/html",
      sizeBytes: 100,
      width: 1,
      height: 1,
      sha256: "a".repeat(64)
    });

    await expect(inventory.completeImageUpload(verifiedActor, verifiedShop, draft.id, intent.key))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "VALIDATION_FAILED", status: 422 });
    await expect(inventory.completeImageUpload(pendingActor, pendingShop, draft.id, intent.key))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "RESOURCE_NOT_FOUND", status: 404 });
  });

  it("enforces six images atomically and blocks publishing a draft without an image", async () => {
    const emptyDraft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("No image item"));
    await expect(inventory.publish(verifiedActor, verifiedShop, emptyDraft.id))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "LISTING_IMAGE_REQUIRED", status: 409 });

    const draft = await inventory.createDraft(verifiedActor, verifiedShop, listingInput("Six image item"));
    const intents = await Promise.all(Array.from({ length: 7 }, () => inventory.createImageUploadIntent(
      verifiedActor,
      verifiedShop,
      draft.id,
      { mimeType: "image/jpeg", sizeBytes: 1_000 }
    )));
    for (const intent of intents) {
      mediaStorage.objects.set(intent.key, {
        key: intent.key,
        mimeType: "image/jpeg",
        sizeBytes: 1_000,
        width: 800,
        height: 600,
        sha256: "a".repeat(64)
      });
    }

    const results = await Promise.allSettled(intents.map((intent) =>
      inventory.completeImageUpload(verifiedActor, verifiedShop, draft.id, intent.key)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(6);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await inventory.listShopListings(verifiedActor, verifiedShop))
      .find((listing) => listing.id === draft.id)?.images).toHaveLength(6);
  });

  it("commits a manifest once across 100 retries and never stores plaintext tracking", async () => {
    const file = await returnManifestFixture();
    const preview = await inventory.previewReturnManifest(verifiedActor, verifiedShop, "manifest.csv", file);

    const results = await Promise.all(Array.from({ length: 100 }, () =>
      inventory.commitReturnManifest(verifiedActor, verifiedShop, preview.batchId, "retry-manifest-100-times")));
    const counts = await pool.query<{ packages: string; lines: string }>(
      `SELECT (SELECT count(*) FROM return_packages)::text AS packages,
              (SELECT count(*) FROM return_lines)::text AS lines`
    );
    const stored = await pool.query<{ tracking: string; payload: string }>(
      `SELECT encode(p.source_tracking_enc, 'base64') AS tracking, b.normalized_payload::text AS payload
       FROM return_packages p JOIN return_import_batches b ON b.id = p.ingest_batch_ref LIMIT 1`
    );

    expect(results).toEqual(Array.from({ length: 100 }, () => results[0]));
    expect(counts.rows[0]).toEqual({ packages: "2", lines: "3" });
    expect(stored.rows[0]?.tracking).not.toContain("TRACK-001");
    expect(stored.rows[0]?.payload).not.toMatch(/TRACK-00[12]|Khách đổi ý/);

    const inventoryPackages = await inventory.listSellerInventoryPackages(verifiedActor, verifiedShop);
    expect(inventoryPackages).toHaveLength(2);
    expect(inventoryPackages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceOrderRef: "SHP-ORDER-0001",
        title: "Áo thun cotton",
        lineCount: 2,
        unitCount: 4,
        price: 600_000,
        status: "AVAILABLE"
      })
    ]));
    expect(JSON.stringify(inventoryPackages)).not.toContain("TRACK-001");
  });

  it("returns the first result for the same key and payload but rejects a changed payload", async () => {
    const fixture = await returnManifestFixture();
    const [first, same] = await Promise.all([
      inventory.previewReturnManifest(verifiedActor, verifiedShop, "first.csv", fixture),
      inventory.previewReturnManifest(verifiedActor, verifiedShop, "same.csv", fixture)
    ]);
    const committed = await inventory.commitReturnManifest(
      verifiedActor,
      verifiedShop,
      first.batchId,
      "same-key-and-payload"
    );
    expect(await inventory.commitReturnManifest(
      verifiedActor,
      verifiedShop,
      same.batchId,
      "same-key-and-payload"
    )).toEqual(committed);

    const changedFile = Buffer.from(fixture.toString("utf8").replaceAll(",600000", ",610000"));
    const changed = await inventory.previewReturnManifest(verifiedActor, verifiedShop, "changed.csv", changedFile);
    await expect(inventory.commitReturnManifest(
      verifiedActor,
      verifiedShop,
      changed.batchId,
      "same-key-and-payload"
    )).rejects.toMatchObject<Partial<DomainError>>({ code: "MANIFEST_IDEMPOTENCY_CONFLICT", status: 409 });
  });

  it("keeps tracking uniqueness scoped to the shop and rejects a changed package manifest", async () => {
    const fixture = await returnManifestFixture();
    const verifiedPreview = await inventory.previewReturnManifest(verifiedActor, verifiedShop, "verified.csv", fixture);
    const pendingPreview = await inventory.previewReturnManifest(pendingActor, pendingShop, "pending.csv", fixture);
    await inventory.commitReturnManifest(verifiedActor, verifiedShop, verifiedPreview.batchId, "verified-shop-import");
    await inventory.commitReturnManifest(pendingActor, pendingShop, pendingPreview.batchId, "pending-shop-import");

    expect((await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM return_packages"
    )).rows[0]?.count).toBe("4");

    const changed = await inventory.previewReturnManifest(
      verifiedActor,
      verifiedShop,
      "changed.csv",
      Buffer.from(fixture.toString("utf8").replaceAll(",600000", ",610000"))
    );
    await expect(inventory.commitReturnManifest(
      verifiedActor,
      verifiedShop,
      changed.batchId,
      "changed-package-manifest"
    )).rejects.toMatchObject<Partial<DomainError>>({ code: "MANIFEST_PACKAGE_CONFLICT", status: 409 });
  });

  it("rolls back packages and lines when a later line insert fails", async () => {
    const preview = await inventory.previewReturnManifest(
      verifiedActor,
      verifiedShop,
      "rollback.csv",
      await returnManifestFixture()
    );
    const stored = await pool.query<{ normalized_payload: { drafts: Array<{ lines: Array<{ reboxeCategoryId: string }> }> } }>(
      "SELECT normalized_payload FROM return_import_batches WHERE id = $1",
      [preview.batchId]
    );
    const payload = stored.rows[0]!.normalized_payload;
    payload.drafts[1]!.lines[0]!.reboxeCategoryId = "missing-category";
    await pool.query("UPDATE return_import_batches SET normalized_payload = $2::jsonb WHERE id = $1", [
      preview.batchId,
      JSON.stringify(payload)
    ]);

    await expect(inventory.commitReturnManifest(
      verifiedActor,
      verifiedShop,
      preview.batchId,
      "rollback-on-line-error"
    )).rejects.toThrow();
    expect((await pool.query<{ packages: string; lines: string }>(
      `SELECT (SELECT count(*) FROM return_packages)::text AS packages,
              (SELECT count(*) FROM return_lines)::text AS lines`
    )).rows[0]).toEqual({ packages: "0", lines: "0" });
  });

  it("rejects a PII header without persisting a preview batch", async () => {
    const fixture = await returnManifestFixture();
    const withPii = Buffer.from(fixture.toString("utf8").replace("source_platform,", "recipient_address,source_platform,"));

    await expect(inventory.previewReturnManifest(verifiedActor, verifiedShop, "pii.csv", withPii))
      .rejects.toMatchObject<Partial<DomainError>>({ code: "PII_COLUMN_FORBIDDEN", status: 422 });
    expect((await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM return_import_batches"
    )).rows[0]?.count).toBe("0");
  });

  async function attachValidImage(listingId: string): Promise<void> {
    const intent = await inventory.createImageUploadIntent(
      verifiedActor,
      verifiedShop,
      listingId,
      { mimeType: "image/jpeg", sizeBytes: 1_000 }
    );
    mediaStorage.objects.set(intent.key, {
      key: intent.key,
      mimeType: "image/jpeg",
      sizeBytes: 1_000,
      width: 800,
      height: 600,
      sha256: "a".repeat(64)
    });
    await inventory.completeImageUpload(verifiedActor, verifiedShop, listingId, intent.key);
  }
});

function returnManifestFixture(): Promise<Buffer> {
  return readFile(resolve(process.cwd(), "docs/fixtures/return-import/reboxe-return-import-sample.csv"));
}

function listingInput(title: string) {
  return {
    title,
    categoryId: "home",
    conditionGrade: "GOOD" as const,
    conditionNotes: "Synthetic fixture in good condition",
    price: 120_000,
    weightGram: 500
  };
}
