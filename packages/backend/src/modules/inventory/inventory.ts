import type {
  CatalogImageUploadIntent,
  Category,
  CommitReturnManifestResult,
  CreateCatalogImageUploadInput,
  CreateListingInput,
  Listing,
  ListingImage,
  ListingPolicyLevel,
  PublicListing,
  PublicListingPage,
  PublicListingsQuery,
  PublicShop,
  PackageListingDraftResult,
  ScanReturnPackageInput,
  BatchCreatePackageListingsResult,
  ListingReviewDecisionInput,
  ShopReview,
  ShopReviewEligibility,
  PublishListingResult,
  ReturnManifestDraft,
  ReturnManifestPreview,
  SellerInventoryPackage,
  UpsertShopReviewInput,
  UpdateListingDraftInput
} from "@reboxe/shared";
import { catalogImageMimeTypes, maxCatalogImageBytes, maxCatalogImages } from "@reboxe/shared";
import { createCipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { ulid } from "ulid";
import { DomainError } from "../../errors";
import type { IdentityModule } from "../identity";
import type { CatalogMediaStorage } from "./catalog-media-storage";
import { packageGroupOfDraft, parseReturnManifestSpreadsheet } from "./return-manifest-spreadsheet";

type StoredListingImage = Omit<ListingImage, "url">;

type ListingRow = {
  id: string;
  shop_id: string;
  shop_display_name: string;
  title: string;
  description: string | null;
  category_id: string;
  condition_grade: Listing["conditionGrade"];
  condition_notes: string;
  price: string;
  weight_gram: number;
  images: StoredListingImage[];
  status: Listing["status"];
  published_at: Date | null;
  created_at: Date;
  return_package_id: string | null;
  package_status: "SOURCE_PENDING" | "AVAILABLE" | "RESERVED" | "SOLD" | "VOID" | null;
  disclosure: "UNOPENED_UNINSPECTED" | null;
  seal_status: "INTACT" | "DAMAGED" | "UNKNOWN" | null;
  manifest_lines: Array<{
    productName: string; variantName: string | null; brand: string | null; quantity: number;
    categoryId: string; originalUnitPriceVnd: number | null;
  }> | null;
};

type CatalogCursor = { sort: PublicListingsQuery["sort"]; value: string; id: string };

type PublicShopRow = {
  id: string;
  display_name: string;
  kyc_status: string;
  created_at: Date;
  description: string | null;
  avatar_ref: string | null;
  pickup_province: string | null;
  pickup_district: string | null;
  active_listing_count: string;
  average_rating: string | null;
  review_count: string;
};

type ShopReviewRow = {
  id: string;
  rating: number;
  content: string;
  created_at: Date;
  updated_at: Date;
};

type PublishListingRow = {
  status: Listing["status"];
  category_id: string;
  category_active: boolean | null;
  condition_notes: string;
  price_source: string;
  image_count: number;
};

type PolicyRow = {
  id: string;
  policy_level: ListingPolicyLevel;
  policy_version: string;
  rule_snapshot: Record<string, unknown>;
  effective_from: Date;
  effective_to: Date | null;
};

export type ReturnTrackingSecrets = {
  encryptionSecret: string;
  hmacSecret: string;
};

type StoredManifestDraft = Omit<ReturnManifestDraft, "sourceTrackingNo"> & {
  sourceTrackingEnc: string;
  sourceTrackingHash: string;
  manifestHash: string;
};

type StoredManifestPayload = { drafts: StoredManifestDraft[] };

type ImportBatchRow = {
  id: string;
  manifest_hash: string;
  status: "PREVIEWED" | "COMMITTED";
  can_commit: boolean;
  normalized_payload: StoredManifestPayload;
  commit_result: CommitReturnManifestResult | null;
};

type SellerInventoryPackageRow = {
  id: string;
  source_platform: SellerInventoryPackage["sourcePlatform"];
  source_order_ref: string | null;
  product_name: string;
  variant_name: string | null;
  image_url: string | null;
  line_count: string;
  unit_count: string;
  package_listing_price_vnd: string;
  inventory_status: SellerInventoryPackage["status"];
  created_at: Date;
};

const publicListingPageSize = 24;

const listingSelect = `
  SELECT l.id, l.shop_id, s.display_name AS shop_display_name,
         l.title, l.description, l.category_id, l.condition_grade,
         l.condition_notes, l.price, l.weight_gram, l.images,
         l.status, l.published_at, l.created_at, l.return_package_id,
         p.inventory_status AS package_status, p.disclosure, p.seal_status,
         manifest.lines AS manifest_lines
  FROM listings l
  JOIN shops s ON s.id = l.shop_id
  LEFT JOIN return_packages p ON p.id = l.return_package_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'productName', rl.product_name, 'variantName', rl.variant_name, 'brand', rl.brand,
      'quantity', rl.source_quantity, 'categoryId', rl.reboxe_category_id,
      'originalUnitPriceVnd', rl.original_unit_price_vnd
    ) ORDER BY rl.source_item_ref, rl.id) AS lines
    FROM return_lines rl WHERE rl.return_package_id = p.id
  ) manifest ON true`;

function presentImages(row: ListingRow, storage: CatalogMediaStorage): ListingImage[] {
  return row.images.map((image) => ({ ...image, url: storage.publicUrl(image.key) }));
}

function presentPublicListing(row: ListingRow, storage: CatalogMediaStorage): PublicListing {
  const listing: PublicListing = {
    id: row.id,
    shopId: row.shop_id,
    shopDisplayName: row.shop_display_name,
    title: row.title,
    categoryId: row.category_id,
    conditionGrade: row.condition_grade,
    conditionNotes: row.condition_notes,
    price: Number(row.price),
    images: presentImages(row, storage),
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString()
  };
  if (row.description !== null) {
    listing.description = row.description;
  }
  if (row.return_package_id && row.package_status && row.disclosure && row.seal_status && row.manifest_lines) {
    const unitCount = row.manifest_lines.reduce((total, line) => total + line.quantity, 0);
    listing.availableQuantity = row.package_status === "AVAILABLE" ? 1 : 0;
    listing.package = {
      disclosure: row.disclosure,
      sealStatus: row.seal_status,
      manifestSummary: { lineCount: row.manifest_lines.length, unitCount },
      lines: row.manifest_lines.map((line) => ({
        ...line,
        originalUnitPriceVnd: line.originalUnitPriceVnd === null ? null : Number(line.originalUnitPriceVnd)
      }))
    };
  }
  return listing;
}

function presentListing(row: ListingRow, storage: CatalogMediaStorage): Listing {
  return {
    ...presentPublicListing(row, storage),
    weightGram: row.weight_gram,
    status: row.status,
    returnPackageId: row.return_package_id
  };
}

function presentShopReview(row: ShopReviewRow): ShopReview {
  return {
    id: row.id,
    rating: row.rating,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function decodeCatalogCursor(encoded: string, sort: PublicListingsQuery["sort"]): CatalogCursor {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== sort
      || typeof parsed[1] !== "string" || typeof parsed[2] !== "string"
      || (sort === "newest" ? Number.isNaN(Date.parse(parsed[1])) : !/^\d+$/.test(parsed[1]))) {
      throw new Error("Invalid cursor");
    }
    return { sort, value: parsed[1], id: parsed[2] };
  } catch {
    throw new DomainError("VALIDATION_FAILED", 422, "Invalid catalog cursor");
  }
}

function encodeCatalogCursor(row: ListingRow, sort: PublicListingsQuery["sort"]): string {
  const value = sort === "newest" ? row.created_at.toISOString() : row.price;
  return Buffer.from(JSON.stringify([sort, value, row.id])).toString("base64url");
}

export class InventoryModule {
  private readonly trackingEncryptionKey: Buffer;

  constructor(
    private readonly pool: Pool,
    private readonly identity: IdentityModule,
    private readonly mediaStorage: CatalogMediaStorage,
    private readonly trackingSecrets: ReturnTrackingSecrets
  ) {
    if (trackingSecrets.encryptionSecret.length < 32 || trackingSecrets.hmacSecret.length < 32) {
      throw new Error("Return tracking secrets must contain at least 32 characters");
    }
    this.trackingEncryptionKey = createHash("sha256").update(trackingSecrets.encryptionSecret).digest();
  }

  async previewReturnManifest(
    actorId: string,
    shopId: string,
    fileName: string,
    file: Buffer
  ): Promise<ReturnManifestPreview> {
    const accessClient = await this.pool.connect();
    try {
      await this.identity.requireShopCapability(accessClient, actorId, shopId, "CREATE_LISTING");
    } finally {
      accessClient.release();
    }

    const parsed = await parseReturnManifestSpreadsheet(fileName, file);
    if (parsed.rows.length === 0) {
      throw new DomainError("SPREADSHEET_FORMAT_INVALID", 422, "The spreadsheet does not contain any manifest rows");
    }

    const allowedCategories = new Set((await this.listCategories()).map((category) => category.id));
    const invalidGroups = new Set(parsed.drafts
      .filter((draft) => draft.lines.some((line) => !allowedCategories.has(line.reboxeCategoryId)))
      .map(packageGroupOfDraft));
    for (const row of parsed.rows) {
      if (invalidGroups.has(row.packageGroup) && !row.errorCodes.includes("INVALID_CATEGORY")) {
        row.errorCodes.push("INVALID_CATEGORY");
      }
    }
    const drafts = parsed.drafts.filter((draft) => !invalidGroups.has(packageGroupOfDraft(draft)));
    const canCommit = drafts.length > 0
      && parsed.rows.every((row) => row.errorCodes.length === 0)
      && drafts.reduce((count, draft) => count + draft.lines.length, 0) === parsed.rows.length;
    const batchId = `RBX-${ulid()}`;
    const manifestHash = hashJson(canonicalManifest(drafts));
    const payload: StoredManifestPayload = {
      drafts: drafts.map((draft) => {
        const { sourceTrackingNo, ...allowlisted } = draft;
        const protectedTracking = this.protectTracking(sourceTrackingNo);
        return {
          ...allowlisted,
          ...protectedTracking,
          manifestHash: hashJson(canonicalManifest([draft])[0])
        };
      })
    };

    await this.pool.query(
      `INSERT INTO return_import_batches (
         id, shop_id, source, file_hash, manifest_hash, status, can_commit, normalized_payload
       ) VALUES ($1, $2, 'SPREADSHEET', $3, $4, 'PREVIEWED', $5, $6::jsonb)`,
      [batchId, shopId, createHash("sha256").update(file).digest("hex"), manifestHash, canCommit, JSON.stringify(payload)]
    );

    return { batchId, rows: parsed.rows, drafts, canCommit };
  }

  async commitReturnManifest(
    actorId: string,
    shopId: string,
    batchId: string,
    idempotencyKey: string
  ): Promise<CommitReturnManifestResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      const batchResult = await client.query<ImportBatchRow>(
        `SELECT id, manifest_hash, status, can_commit, normalized_payload, commit_result
         FROM return_import_batches WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
        [batchId, shopId]
      );
      const batch = batchResult.rows[0];
      if (!batch) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Return import batch not found");
      if (batch.status === "COMMITTED" && batch.commit_result) {
        await client.query("COMMIT");
        return batch.commit_result;
      }
      if (!batch.can_commit) {
        throw new DomainError("MANIFEST_PREVIEW_NOT_COMMITTABLE", 409, "The return manifest preview contains errors");
      }

      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${shopId}:${idempotencyKey}`]);
      const priorResult = await client.query<ImportBatchRow>(
        `SELECT id, manifest_hash, status, can_commit, normalized_payload, commit_result
         FROM return_import_batches
         WHERE shop_id = $1 AND idempotency_key = $2 AND id <> $3`,
        [shopId, idempotencyKey, batchId]
      );
      const prior = priorResult.rows[0];
      if (prior) {
        if (prior.manifest_hash !== batch.manifest_hash) {
          throw new DomainError("MANIFEST_IDEMPOTENCY_CONFLICT", 409, "The idempotency key was used with a different manifest");
        }
        if (prior.status === "COMMITTED" && prior.commit_result) {
          await client.query("COMMIT");
          return prior.commit_result;
        }
      }

      await client.query(
        "UPDATE return_import_batches SET idempotency_key = $3 WHERE id = $1 AND shop_id = $2",
        [batchId, shopId, idempotencyKey]
      );
      const packageIds: string[] = [];
      let lineCount = 0;
      const drafts = [...batch.normalized_payload.drafts]
        .sort((left, right) => left.sourceTrackingHash.localeCompare(right.sourceTrackingHash));

      for (const draft of drafts) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `${shopId}:${draft.sourcePlatform}:${draft.sourceTrackingHash}`
        ]);
        const existingResult = await client.query<{ id: string; manifest_hash: string }>(
          `SELECT id, manifest_hash FROM return_packages
           WHERE shop_id = $1 AND source_platform = $2 AND source_tracking_hash = $3
           FOR UPDATE`,
          [shopId, draft.sourcePlatform, draft.sourceTrackingHash]
        );
        const existing = existingResult.rows[0];
        if (existing && existing.manifest_hash !== draft.manifestHash) {
          throw new DomainError("MANIFEST_PACKAGE_CONFLICT", 409, "A return package already exists with a different manifest");
        }

        const packageId = existing?.id ?? `RBX-${ulid()}`;
        if (!existing) {
          await this.insertReturnPackage(client, packageId, shopId, batchId, draft);
          for (const line of draft.lines) {
            await client.query(
              `INSERT INTO return_lines (
                 id, return_package_id, source_item_ref, source_sku, source_quantity,
                 product_name, variant_name, brand, source_category, original_unit_price_vnd,
                 return_reason, product_image_urls, reboxe_category_id
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)`,
              [
                `RBX-${ulid()}`,
                packageId,
                line.sourceItemRef,
                line.sourceSku ?? null,
                line.sourceQuantity,
                line.productName,
                line.variantName ?? null,
                line.brand ?? null,
                line.sourceCategory ?? null,
                line.originalUnitPriceVnd ?? null,
                line.returnReason ?? null,
                JSON.stringify(line.productImageUrls),
                line.reboxeCategoryId
              ]
            );
          }
        }
        packageIds.push(packageId);
        lineCount += draft.lines.length;
      }

      const result = { batchId, packageIds, lineCount };
      await client.query(
        `UPDATE return_import_batches
         SET status = 'COMMITTED', commit_result = $3::jsonb, committed_at = now()
         WHERE id = $1 AND shop_id = $2`,
        [batchId, shopId, JSON.stringify(result)]
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async scanReturnPackage(
    actorId: string,
    shopId: string,
    input: ScanReturnPackageInput,
    idempotencyKey?: string
  ): Promise<PackageListingDraftResult> {
    const requestHash = hashJson({ shopId, input });
    if (idempotencyKey) {
      const idem = await this.pool.connect();
      try {
        await idem.query("BEGIN");
        await this.identity.requireShopCapability(idem, actorId, shopId, "CREATE_LISTING");
        await idem.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`scan:${actorId}:${idempotencyKey}`]);
        const prior = (await idem.query<{ request_hash: string; response: PackageListingDraftResult | null }>(
          "SELECT request_hash,response FROM idempotency_records WHERE actor_id=$1 AND scope='inventory.scan' AND idempotency_key=$2",
          [actorId, idempotencyKey]
        )).rows[0];
        if (prior?.request_hash !== undefined && prior.request_hash !== requestHash) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "Idempotency key payload differs");
        if (prior?.response) { await idem.query("COMMIT"); return prior.response; }
        if (!prior) await idem.query(
          "INSERT INTO idempotency_records(actor_id,scope,idempotency_key,request_hash) VALUES($1,'inventory.scan',$2,$3)",
          [actorId, idempotencyKey, requestHash]
        );
        await idem.query("COMMIT");
      } catch (error) { await idem.query("ROLLBACK"); throw error; } finally { idem.release(); }
    }
    const normalized = normalizeScannedCode(input.scannedCode);
    const trackingHash = createHmac("sha256", this.trackingSecrets.hmacSecret).update(normalized).digest("hex");
    const found = await this.pool.query<{ id: string }>(
      `SELECT id FROM return_packages
       WHERE shop_id = $1 AND source_tracking_hash = $2
         AND ($3::text IS NULL OR source_platform = $3)
       LIMIT 1`,
      [shopId, trackingHash, input.platformHint]
    );
    const packageId = found.rows[0]?.id;
    if (!packageId) throw new DomainError("SOURCE_MANIFEST_NOT_FOUND", 404, "No imported return package matches this code");
    const result = await this.createPackageListingDraft(actorId, shopId, packageId);
    if (idempotencyKey) await this.pool.query(
      "UPDATE idempotency_records SET response=$3::jsonb WHERE actor_id=$1 AND scope='inventory.scan' AND idempotency_key=$2",
      [actorId, idempotencyKey, JSON.stringify(result)]
    );
    return result;
  }

  async createPackageListingDraft(
    actorId: string,
    shopId: string,
    packageId: string
  ): Promise<PackageListingDraftResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const access = await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`package-listing:${packageId}`]);
      const packageResult = await client.query<{
        id: string; inventory_status: string; disclosure: "UNOPENED_UNINSPECTED";
        seal_status: "INTACT" | "DAMAGED" | "UNKNOWN"; package_weight_gram: number | null;
        package_listing_price_vnd: string;
      }>(
        `SELECT id, inventory_status, disclosure, seal_status, package_weight_gram, package_listing_price_vnd
         FROM return_packages WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
        [packageId, shopId]
      );
      const pkg = packageResult.rows[0];
      if (!pkg) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Return package not found");

      const existing = (await client.query<ListingRow>(`${listingSelect} WHERE l.return_package_id = $1`, [packageId])).rows[0];
      if (existing) {
        await client.query("COMMIT");
        return this.packageDraftResult(existing, access.displayName);
      }
      if (pkg.inventory_status !== "AVAILABLE") {
        throw new DomainError("PACKAGE_STATE_CONFLICT", 409, "Only an available package can become a listing");
      }
      const firstLine = (await client.query<{
        product_name: string; reboxe_category_id: string;
      }>(
        `SELECT product_name, reboxe_category_id FROM return_lines
         WHERE return_package_id = $1 ORDER BY source_item_ref, id LIMIT 1`,
        [packageId]
      )).rows[0];
      if (!firstLine) throw new DomainError("SOURCE_MANIFEST_NOT_FOUND", 404, "The return package has no manifest lines");

      const listingId = `RBX-${ulid()}`;
      await client.query(
        `INSERT INTO listings (
           id, return_package_id, shop_id, title, category_id, condition_grade,
           condition_notes, price, weight_gram, images, price_source, status
         ) VALUES ($1, $2, $3, $4, $5, 'NEW_SEALED', $6, $7, $8, '[]'::jsonb, 'VERIFIED_CSV', 'DRAFT')`,
        [listingId, packageId, shopId, firstLine.product_name, firstLine.reboxe_category_id,
          "Kiện chưa mở kiểm tra; chỉ mô tả tình trạng bên ngoài.", Number(pkg.package_listing_price_vnd), pkg.package_weight_gram ?? 1]
      );
      const row = await this.selectOwnedListingRow(client, listingId, shopId);
      await client.query("COMMIT");
      return this.packageDraftResult(row, access.displayName);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async batchCreatePackageListings(
    actorId: string,
    shopId: string,
    packageIds: string[]
  ): Promise<BatchCreatePackageListingsResult> {
    const results: BatchCreatePackageListingsResult = [];
    for (const packageId of [...new Set(packageIds)]) {
      try {
        results.push({ packageId, listing: (await this.createPackageListingDraft(actorId, shopId, packageId)).listing });
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        results.push({ packageId, error: { code: error.code, message: error.message } });
      }
    }
    return results;
  }

  async listPendingListingReviews(actor: { id: string; aal?: "aal1" | "aal2" }): Promise<Listing[]> {
    await this.requireListingModerator(actor);
    const result = await this.pool.query<ListingRow>(
      `${listingSelect} WHERE l.status = 'PENDING_REVIEW' ORDER BY l.created_at`,
    );
    return result.rows.map((row) => presentListing(row, this.mediaStorage));
  }

  async decideListingReview(
    actor: { id: string; aal?: "aal1" | "aal2" },
    listingId: string,
    input: ListingReviewDecisionInput,
    idempotencyKey: string
  ): Promise<Listing> {
    if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) throw new DomainError("VALIDATION_FAILED", 422, "A UUID idempotency key is required");
    await this.requireListingModerator(actor);
    const requestHash = hashJson({ listingId, ...input });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`listing-review:${actor.id}:${idempotencyKey}`]);
      const prior = (await client.query<{ listing_id: string; request_hash: string }>(
        "SELECT listing_id, request_hash FROM listing_reviews WHERE reviewer_id = $1 AND idempotency_key = $2",
        [actor.id, idempotencyKey]
      )).rows[0];
      if (prior && prior.request_hash !== requestHash) throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "Idempotency key payload differs");
      if (!prior) {
        const updated = await client.query(
          `UPDATE listings SET status = $2, published_at = CASE WHEN $2 = 'ACTIVE' THEN now() ELSE NULL END
           WHERE id = $1 AND status = 'PENDING_REVIEW' RETURNING id`,
          [listingId, input.decision === "APPROVE" ? "ACTIVE" : "DELISTED"]
        );
        if (!updated.rowCount) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Pending listing not found");
        await client.query(
          `INSERT INTO listing_reviews (id, listing_id, reviewer_id, decision, reason, idempotency_key, request_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [`RBX-LR-${ulid()}`, listingId, actor.id, input.decision, input.reason, idempotencyKey, requestHash]
        );
        await client.query(
          `INSERT INTO outbox_events (id, topic, aggregate_id, payload)
           VALUES ($1, 'listing.reviewed', $2, $3::jsonb)`,
          [`RBX-${ulid()}`, listingId, JSON.stringify({ listingId, decision: input.decision })]
        );
      }
      const row = await this.selectOwnedListingRow(client, listingId);
      await client.query("COMMIT");
      return presentListing(row, this.mediaStorage);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createDraft(actorId: string, shopId: string, input: CreateListingInput, idempotencyKey?: string): Promise<Listing> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const access = await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      const requestHash = idempotencyKey && createHash("sha256").update(JSON.stringify({ shopId, input })).digest("hex");
      if (idempotencyKey) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`listing-draft:${actorId}:${idempotencyKey}`]);
        const previous = await client.query<{ request_hash: string; response: { listingId: string } }>(
          `SELECT request_hash, response FROM idempotency_records
           WHERE actor_id = $1 AND scope = 'inventory.create-draft' AND idempotency_key = $2`,
          [actorId, idempotencyKey]
        );
        const record = previous.rows[0];
        if (record) {
          if (record.request_hash !== requestHash) {
            throw new DomainError("IDEMPOTENCY_CONFLICT", 409, "The key was used for another draft");
          }
          const listing = await this.selectOwnedListing(client, record.response.listingId, shopId);
          await client.query("COMMIT");
          return listing;
        }
      }
      await this.requireActiveCategory(client, input.categoryId);
      const listingId = `RBX-${ulid()}`;
      await client.query(
        `INSERT INTO listings (
           id, shop_id, title, description, category_id, condition_grade,
           condition_notes, price, weight_gram, images, price_source, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '[]'::jsonb, 'SELLER_DECLARED', 'DRAFT')`,
        [
          listingId,
          shopId,
          input.title,
          input.description ?? null,
          input.categoryId,
          input.conditionGrade,
          input.conditionNotes,
          input.price,
          input.weightGram
        ]
      );
      const listing = await this.selectOwnedListing(client, listingId, shopId);
      if (idempotencyKey) {
        await client.query(
          `INSERT INTO idempotency_records (actor_id, scope, idempotency_key, request_hash, response)
           VALUES ($1, 'inventory.create-draft', $2, $3, $4::jsonb)`,
          [actorId, idempotencyKey, requestHash, JSON.stringify({ listingId })]
        );
      }
      await client.query("COMMIT");
      return { ...listing, shopDisplayName: access.displayName };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listShopListings(actorId: string, shopId: string): Promise<Listing[]> {
    const client = await this.pool.connect();
    try {
      await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      const result = await client.query<ListingRow>(
        `${listingSelect}
         WHERE l.shop_id = $1
         ORDER BY l.created_at DESC`,
        [shopId]
      );
      return result.rows.map((row) => presentListing(row, this.mediaStorage));
    } finally {
      client.release();
    }
  }

  async listSellerInventoryPackages(actorId: string, shopId: string): Promise<SellerInventoryPackage[]> {
    const client = await this.pool.connect();
    try {
      await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      const result = await client.query<SellerInventoryPackageRow>(
        `SELECT p.id, p.source_platform, p.source_order_ref,
                first_line.product_name, first_line.variant_name, first_line.image_url,
                totals.line_count::text, totals.unit_count::text,
                p.package_listing_price_vnd, p.inventory_status, p.created_at
         FROM return_packages p
         JOIN LATERAL (
           SELECT l.product_name, l.variant_name, l.product_image_urls->>0 AS image_url
           FROM return_lines l
           WHERE l.return_package_id = p.id
           ORDER BY l.source_item_ref, l.id
           LIMIT 1
         ) first_line ON true
         JOIN LATERAL (
           SELECT count(*) AS line_count, sum(l.source_quantity) AS unit_count
           FROM return_lines l
           WHERE l.return_package_id = p.id
         ) totals ON true
         WHERE p.shop_id = $1
         ORDER BY p.created_at DESC, p.id DESC`,
        [shopId]
      );
      return result.rows.map((row) => ({
        id: row.id,
        sourcePlatform: row.source_platform,
        sourceOrderRef: row.source_order_ref,
        title: row.product_name,
        variantName: row.variant_name,
        imageUrl: row.image_url,
        lineCount: Number(row.line_count),
        unitCount: Number(row.unit_count),
        price: Number(row.package_listing_price_vnd),
        status: row.inventory_status,
        createdAt: row.created_at.toISOString()
      }));
    } finally {
      client.release();
    }
  }

  async listListingCategoriesForShop(actorId: string, shopId: string): Promise<Category[]> {
    const client = await this.pool.connect();
    try {
      await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      return await this.listCategories(client);
    } finally {
      client.release();
    }
  }

  async listCategories(database: Pool | PoolClient = this.pool): Promise<Category[]> {
    const result = await database.query<Category>(
      `SELECT c.id, c.name
       FROM categories c
       WHERE c.active
         AND NOT EXISTS (
           SELECT 1 FROM restricted_categories p
           WHERE p.category_id = c.id AND p.policy_level = 'BANNED'
             AND p.effective_from <= now()
             AND (p.effective_to IS NULL OR p.effective_to > now())
         )
       ORDER BY c.sort_order, c.name`
    );
    return result.rows;
  }

  async updateDraft(
    actorId: string,
    shopId: string,
    listingId: string,
    input: UpdateListingDraftInput
  ): Promise<Listing> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      await this.requireActiveCategory(client, input.categoryId);
      const updated = await client.query(
        `UPDATE listings
         SET title = $3, description = $4, category_id = $5,
             condition_grade = $6, condition_notes = $7, price = $8, weight_gram = $9
         WHERE id = $1 AND shop_id = $2 AND status = 'DRAFT'
         RETURNING id`,
        [
          listingId,
          shopId,
          input.title,
          input.description ?? null,
          input.categoryId,
          input.conditionGrade,
          input.conditionNotes,
          input.price,
          input.weightGram
        ]
      );
      if (updated.rowCount === 0) {
        const current = await client.query<{ status: string }>(
          "SELECT status FROM listings WHERE id = $1 AND shop_id = $2",
          [listingId, shopId]
        );
        if (!current.rows[0]) {
          throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
        }
        throw new DomainError("INVALID_LISTING_STATE", 409, "Only a draft listing can be updated");
      }

      const listing = await this.selectOwnedListing(client, listingId, shopId);
      await client.query("COMMIT");
      return listing;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async publish(actorId: string, shopId: string, listingId: string): Promise<PublishListingResult> {
    const client = await this.pool.connect();
    let rejection: DomainError | undefined;
    let result: PublishListingResult | undefined;
    try {
      await client.query("BEGIN");
      const access = await this.identity.requireShopCapability(client, actorId, shopId, "PUBLISH_LISTING");
      if (access.kycStatus !== "VERIFIED") {
        throw new DomainError("SHOP_NOT_VERIFIED", 409, "Shop verification is required");
      }
      if (access.shopStatus !== "ACTIVE") {
        throw new DomainError("SHOP_NOT_ACTIVE", 409, "Shop is not active");
      }

      const currentResult = await client.query<PublishListingRow>(
        `SELECT l.status, l.category_id, c.active AS category_active, l.condition_notes,
                l.price_source, jsonb_array_length(l.images)::int AS image_count
         FROM listings l
         LEFT JOIN categories c ON c.id = l.category_id
         WHERE l.id = $1 AND l.shop_id = $2
         FOR UPDATE OF l`,
        [listingId, shopId]
      );
      const current = currentResult.rows[0];
      if (!current) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
      if (current.status !== "DRAFT") {
        throw new DomainError("INVALID_LISTING_STATE", 409, "Only a draft listing can be published");
      }
      if (!current.category_active) {
        throw new DomainError("INVALID_CATEGORY", 422, "Category is not active");
      }

      const policyResult = await client.query<PolicyRow>(
        `SELECT id, policy_level, policy_version, rule_snapshot, effective_from, effective_to
         FROM restricted_categories
         WHERE category_id = $1 AND effective_from <= now()
           AND (effective_to IS NULL OR effective_to > now())
         ORDER BY effective_from DESC
         LIMIT 1`,
        [current.category_id]
      );
      const policy = policyResult.rows[0];
      const policySnapshot = policy ? JSON.stringify({
        id: policy.id,
        categoryId: current.category_id,
        policyLevel: policy.policy_level,
        effectiveFrom: policy.effective_from.toISOString(),
        effectiveTo: policy.effective_to?.toISOString() ?? null,
        rules: policy.rule_snapshot
      }) : null;

      if (policy?.policy_level === "BANNED") {
        rejection = new DomainError("LISTING_CATEGORY_BANNED", 422, "This category is prohibited on REBOXE");
      } else if (policy?.policy_level === "DISCLOSURE") {
        const configuredMinimum = policy.rule_snapshot.minimumConditionNotesLength;
        const minimum = typeof configuredMinimum === "number" && Number.isInteger(configuredMinimum)
          ? Math.max(3, configuredMinimum)
          : 20;
        if (current.condition_notes.trim().length < minimum) {
          rejection = new DomainError(
            "LISTING_DISCLOSURE_REQUIRED",
            422,
            `Condition notes must contain at least ${minimum} characters for this category`
          );
        }
      }

      if (rejection) {
        await client.query(
          `UPDATE listings
           SET applied_policy_version = $3, applied_policy_snapshot = $4::jsonb, policy_evaluated_at = now()
           WHERE id = $1 AND shop_id = $2`,
          [listingId, shopId, policy?.policy_version ?? null, policySnapshot]
        );
      } else {
        if (current.price_source === "SELLER_DECLARED" && current.image_count === 0) {
          throw new DomainError("LISTING_IMAGE_REQUIRED", 409, "At least one catalog image is required");
        }

        const nextStatus = policy?.policy_level === "MANUAL_REVIEW" ? "PENDING_REVIEW" : "ACTIVE";
        await client.query(
          `UPDATE listings
           SET status = $3, published_at = CASE WHEN $3 = 'ACTIVE' THEN now() ELSE NULL END,
               applied_policy_version = $4, applied_policy_snapshot = $5::jsonb, policy_evaluated_at = now()
           WHERE id = $1 AND shop_id = $2`,
          [listingId, shopId, nextStatus, policy?.policy_version ?? null, policySnapshot]
        );

        const topic = nextStatus === "ACTIVE" ? "listing.published" : "listing.pending_review";
        await client.query(
          `INSERT INTO outbox_events (id, topic, aggregate_id, payload)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [`RBX-${ulid()}`, topic, listingId, JSON.stringify({
            listingId,
            shopId,
            status: nextStatus,
            policyVersion: policy?.policy_version ?? null
          })]
        );
        result = {
          listing: await this.selectOwnedListing(client, listingId, shopId),
          policy: {
            outcome: nextStatus,
            policyLevel: policy?.policy_level ?? null,
            policyVersion: policy?.policy_version ?? null,
            message: nextStatus === "ACTIVE" ? "Listing is active" : "Listing is pending manual review"
          }
        };
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    if (rejection) throw rejection;
    if (!result) throw new DomainError("INTERNAL_ERROR", 500, "Publish result is missing");
    return result;
  }

  async createImageUploadIntent(
    actorId: string,
    shopId: string,
    listingId: string,
    input: CreateCatalogImageUploadInput
  ): Promise<CatalogImageUploadIntent> {
    this.validateImageMetadata(input);
    const imageCount = await this.requireOwnedDraft(actorId, shopId, listingId);
    if (imageCount >= maxCatalogImages) {
      throw new DomainError("CATALOG_IMAGE_LIMIT", 409, `A listing can have at most ${maxCatalogImages} images`);
    }

    const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.slice("image/".length);
    const key = `catalog/${shopId}/${listingId}/${ulid()}.${extension}`;
    return this.mediaStorage.createUploadIntent({ key, ...input });
  }

  async completeImageUpload(
    actorId: string,
    shopId: string,
    listingId: string,
    key: string
  ): Promise<Listing> {
    await this.requireOwnedDraft(actorId, shopId, listingId);
    if (!key.startsWith(`catalog/${shopId}/${listingId}/`)) {
      throw new DomainError("RESOURCE_NOT_FOUND", 404, "Catalog image not found");
    }

    const object = await this.mediaStorage.inspectObject(key);
    if (!object || object.key !== key) {
      throw new DomainError("RESOURCE_NOT_FOUND", 404, "Catalog image not found");
    }
    this.validateImageMetadata(object);
    if (!Number.isInteger(object.width) || object.width <= 0 || !Number.isInteger(object.height) || object.height <= 0) {
      throw new DomainError("VALIDATION_FAILED", 422, "Uploaded object is not a readable image");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      const image = JSON.stringify([{ key, width: object.width, height: object.height }]);
      const updated = await client.query(
        `UPDATE listings
         SET images = images || $4::jsonb
         WHERE id = $1 AND shop_id = $2 AND status = 'DRAFT'
           AND jsonb_array_length(images) < $3
           AND NOT images @> $4::jsonb
         RETURNING id`,
        [listingId, shopId, maxCatalogImages, image]
      );
      if (updated.rowCount === 0) {
        const current = await client.query<{ status: string; image_count: number; attached: boolean }>(
          `SELECT status, jsonb_array_length(images)::int AS image_count,
                  images @> $3::jsonb AS attached
           FROM listings WHERE id = $1 AND shop_id = $2`,
          [listingId, shopId, image]
        );
        const row = current.rows[0];
        if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
        if (row.status !== "DRAFT") {
          throw new DomainError("INVALID_LISTING_STATE", 409, "Only a draft listing can be updated");
        }
        if (!row.attached && row.image_count >= maxCatalogImages) {
          throw new DomainError("CATALOG_IMAGE_LIMIT", 409, `A listing can have at most ${maxCatalogImages} images`);
        }
      }

      const listing = await this.selectOwnedListing(client, listingId, shopId);
      await client.query("COMMIT");
      return listing;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getPublicListing(listingId: string): Promise<PublicListing> {
    const result = await this.pool.query<ListingRow>(
      `${listingSelect}
       WHERE l.id = $1 AND l.status = 'ACTIVE' AND s.status = 'ACTIVE'`,
      [listingId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
    }
    return presentPublicListing(row, this.mediaStorage);
  }

  async getPublicShop(shopId: string): Promise<PublicShop> {
    const result = await this.pool.query<PublicShopRow>(
      `SELECT s.id, s.display_name, s.kyc_status, s.created_at,
              p.description, p.avatar_ref, p.pickup_province, p.pickup_district,
              count(DISTINCT l.id) FILTER (WHERE l.status = 'ACTIVE')::text AS active_listing_count,
              avg(r.rating)::text AS average_rating, count(DISTINCT r.id)::text AS review_count
       FROM shops s
       LEFT JOIN shop_onboarding_profiles p ON p.shop_id = s.id
       LEFT JOIN listings l ON l.shop_id = s.id
       LEFT JOIN shop_reviews r ON r.shop_id = s.id
       WHERE s.id = $1 AND s.status = 'ACTIVE'
       GROUP BY s.id, p.description, p.avatar_ref, p.pickup_province, p.pickup_district`,
      [shopId]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Shop not found");
    const location = [row.pickup_district, row.pickup_province].filter(Boolean).join(", ");
    return {
      id: row.id,
      displayName: row.display_name,
      description: row.description,
      avatarUrl: row.avatar_ref ? this.mediaStorage.publicUrl(row.avatar_ref) : null,
      verified: row.kyc_status === "VERIFIED",
      activeListingCount: Number(row.active_listing_count),
      averageRating: row.average_rating === null ? null : Number(row.average_rating),
      reviewCount: Number(row.review_count),
      location: location || null,
      createdAt: row.created_at.toISOString()
    };
  }

  async listShopReviews(shopId: string): Promise<ShopReview[]> {
    await this.requirePublicShop(shopId);
    // ponytail: recent 50 reviews; add cursor pagination when a shop can exceed this visibly.
    const result = await this.pool.query<ShopReviewRow>(
      `SELECT id, rating, content, created_at, updated_at
       FROM shop_reviews WHERE shop_id = $1 ORDER BY updated_at DESC LIMIT 50`,
      [shopId]
    );
    return result.rows.map(presentShopReview);
  }

  async getMyShopReview(actorId: string, shopId: string): Promise<ShopReview | null> {
    await this.requirePublicShop(shopId);
    const row = (await this.pool.query<ShopReviewRow>(
      `SELECT id, rating, content, created_at, updated_at
       FROM shop_reviews WHERE shop_id = $1 AND reviewer_id = $2`,
      [shopId, actorId]
    )).rows[0];
    return row ? presentShopReview(row) : null;
  }

  async getShopReviewEligibility(actorId: string, shopId: string): Promise<ShopReviewEligibility> {
    await this.requirePublicShop(shopId);
    if ((await this.pool.query(
      "SELECT 1 FROM shop_memberships WHERE shop_id = $1 AND user_id = $2 AND status = 'ACTIVE'",
      [shopId, actorId]
    )).rowCount) {
      return { eligible: false, reason: "SHOP_MEMBER" };
    }
    const eligible = (await this.pool.query<{ eligible: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM orders o JOIN sub_orders so ON so.order_id = o.id
         WHERE o.buyer_id = $1 AND so.shop_id = $2 AND o.status = 'COMPLETED'
       ) AS eligible`,
      [actorId, shopId]
    )).rows[0]!.eligible;
    return { eligible, reason: eligible ? null : "COMPLETED_ORDER_REQUIRED" };
  }

  async upsertShopReview(actorId: string, shopId: string, input: UpsertShopReviewInput): Promise<ShopReview> {
    const eligibility = await this.getShopReviewEligibility(actorId, shopId);
    if (eligibility.reason === "SHOP_MEMBER") {
      throw new DomainError("FORBIDDEN", 403, "Shop members cannot review their own shop");
    }
    if (!eligibility.eligible) {
      throw new DomainError("REVIEW_NOT_ELIGIBLE", 403, "Only buyers with a completed order can review this shop");
    }
    const row = (await this.pool.query<ShopReviewRow>(
      `INSERT INTO shop_reviews (id, shop_id, reviewer_id, rating, content)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (shop_id, reviewer_id) DO UPDATE
       SET rating = EXCLUDED.rating, content = EXCLUDED.content, updated_at = now()
       RETURNING id, rating, content, created_at, updated_at`,
      [`RBXREV-${ulid()}`, shopId, actorId, input.rating, input.content]
    )).rows[0]!;
    return presentShopReview(row);
  }

  async listPublicListings(input: PublicListingsQuery, shopping?: { maxPriceVnd: number | undefined }): Promise<PublicListingPage> {
    const values: unknown[] = [];
    const conditions = ["l.status = 'ACTIVE'", "s.status = 'ACTIVE'"];
    const parameter = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    if (shopping?.maxPriceVnd !== undefined) conditions.push(`l.price <= ${parameter(shopping.maxPriceVnd)}`);
    if (input.q) {
      const query = parameter(input.q);
      const listingMatch = `to_tsvector(
        'simple'::regconfig,
        reboxe_unaccent(l.title || ' ' || coalesce(l.description, '') || ' ' || l.condition_notes)
      ) @@ plainto_tsquery('simple'::regconfig, reboxe_unaccent(${query}))`;
      conditions.push(shopping ? `(${listingMatch} OR EXISTS (
        SELECT 1 FROM return_lines rl WHERE rl.return_package_id = p.id
          AND to_tsvector('simple'::regconfig, reboxe_unaccent(concat_ws(' ', rl.product_name, rl.variant_name, rl.brand)))
            @@ plainto_tsquery('simple'::regconfig, reboxe_unaccent(${query}))
      ))` : listingMatch);
    }
    if (input.category) {
      conditions.push(`l.category_id = ${parameter(input.category)}`);
    }
    if (input.shopId) {
      conditions.push(`l.shop_id = ${parameter(input.shopId)}`);
    }
    if (input.cursor) {
      const cursor = decodeCatalogCursor(input.cursor, input.sort);
      const value = parameter(cursor.value);
      const id = parameter(cursor.id);
      conditions.push(input.sort === "newest"
        ? `(l.created_at, l.id) < (${value}::timestamptz, ${id})`
        : `(l.price, l.id) ${input.sort === "price_asc" ? ">" : "<"} (${value}::bigint, ${id})`);
    }

    const orderBy = input.sort === "newest"
      ? "l.created_at DESC, l.id DESC"
      : `l.price ${input.sort === "price_asc" ? "ASC" : "DESC"}, l.id ${input.sort === "price_asc" ? "ASC" : "DESC"}`;
    const homepage = !shopping && !input.cursor && !input.q && !input.category && !input.shopId && input.sort === "newest";
    const sponsoredRows = homepage
      ? (await this.pool.query<ListingRow>(
        `${listingSelect}
         JOIN listing_promotions promo ON promo.listing_id=l.id
           AND promo.status='ACTIVE' AND promo.starts_at<=now() AND promo.ends_at>now()
         WHERE ${conditions.join(" AND ")}
         ORDER BY promo.starts_at, promo.id
         LIMIT 6`, values
      )).rows
      : [];
    if (sponsoredRows.length) {
      conditions.push(`l.id <> ALL(${parameter(sponsoredRows.map((row) => row.id))}::text[])`);
    }
    const result = await this.pool.query<ListingRow>(
      `${listingSelect}
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${orderBy}
       LIMIT ${publicListingPageSize + 1}`,
      values
    );
    const pageRows = result.rows.slice(0, publicListingPageSize);
    const last = pageRows.at(-1);
    return {
      sponsored: sponsoredRows.map((row) => presentPublicListing(row, this.mediaStorage)),
      items: pageRows.map((row) => presentPublicListing(row, this.mediaStorage)),
      nextCursor: result.rows.length > publicListingPageSize && last
        ? encodeCatalogCursor(last, input.sort)
        : null
    };
  }

  private async selectOwnedListing(client: PoolClient, listingId: string, shopId: string): Promise<Listing> {
    return presentListing(await this.selectOwnedListingRow(client, listingId, shopId), this.mediaStorage);
  }

  private async selectOwnedListingRow(client: PoolClient, listingId: string, shopId?: string): Promise<ListingRow> {
    const result = await client.query<ListingRow>(
      `${listingSelect}
       WHERE l.id = $1 ${shopId ? "AND l.shop_id = $2" : ""}`,
      shopId ? [listingId, shopId] : [listingId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
    }
    return row;
  }

  private packageDraftResult(row: ListingRow, shopDisplayName: string): PackageListingDraftResult {
    if (!row.return_package_id || !row.disclosure || !row.seal_status || !row.manifest_lines) {
      throw new DomainError("INTERNAL_ERROR", 500, "Package listing projection is incomplete");
    }
    return {
      packageId: row.return_package_id,
      listing: { ...presentListing(row, this.mediaStorage), shopDisplayName },
      disclosure: row.disclosure,
      sealStatus: row.seal_status,
      manifestLines: row.manifest_lines.map((line) => ({ ...line, originalUnitPriceVnd: line.originalUnitPriceVnd === null ? null : Number(line.originalUnitPriceVnd) }))
    };
  }

  private async requireListingModerator(actor: { id: string; aal?: "aal1" | "aal2" }): Promise<void> {
    if (actor.aal !== "aal2") throw new DomainError("MFA_REQUIRED", 403, "AAL2 is required");
    const allowed = await this.pool.query(
      `SELECT 1 FROM platform_staff_roles
       WHERE user_id = $1 AND status = 'ACTIVE' AND role IN ('MODERATOR', 'SUPER_ADMIN')`,
      [actor.id]
    );
    if (!allowed.rowCount) throw new DomainError("FORBIDDEN", 403, "Listing moderation capability denied");
  }

  private async requirePublicShop(shopId: string): Promise<void> {
    if (!(await this.pool.query("SELECT 1 FROM shops WHERE id = $1 AND status = 'ACTIVE'", [shopId])).rowCount) {
      throw new DomainError("RESOURCE_NOT_FOUND", 404, "Shop not found");
    }
  }

  private async requireActiveCategory(client: PoolClient, categoryId: string): Promise<void> {
    const result = await client.query("SELECT 1 FROM categories WHERE id = $1 AND active", [categoryId]);
    if (result.rowCount === 0) {
      throw new DomainError("INVALID_CATEGORY", 422, "Category is not active");
    }
  }

  private async requireOwnedDraft(actorId: string, shopId: string, listingId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      await this.identity.requireShopCapability(client, actorId, shopId, "CREATE_LISTING");
      const result = await client.query<{ status: string; image_count: number }>(
        "SELECT status, jsonb_array_length(images)::int AS image_count FROM listings WHERE id = $1 AND shop_id = $2",
        [listingId, shopId]
      );
      const row = result.rows[0];
      if (!row) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
      if (row.status !== "DRAFT") {
        throw new DomainError("INVALID_LISTING_STATE", 409, "Only a draft listing can be updated");
      }
      return row.image_count;
    } finally {
      client.release();
    }
  }

  private validateImageMetadata(input: { mimeType: string; sizeBytes: number }): void {
    if (!(catalogImageMimeTypes as readonly string[]).includes(input.mimeType)
      || !Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > maxCatalogImageBytes) {
      throw new DomainError("VALIDATION_FAILED", 422, "Catalog image must be JPEG, PNG or WebP and at most 5 MiB");
    }
  }

  private protectTracking(sourceTrackingNo: string): {
    sourceTrackingEnc: string;
    sourceTrackingHash: string;
  } {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.trackingEncryptionKey, nonce);
    const encrypted = Buffer.concat([cipher.update(sourceTrackingNo, "utf8"), cipher.final()]);
    return {
      sourceTrackingEnc: Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64"),
      sourceTrackingHash: createHmac("sha256", this.trackingSecrets.hmacSecret)
        .update(normalizeScannedCode(sourceTrackingNo))
        .digest("hex")
    };
  }

  private async insertReturnPackage(
    client: PoolClient,
    packageId: string,
    shopId: string,
    batchId: string,
    draft: StoredManifestDraft
  ): Promise<void> {
    await client.query(
      `INSERT INTO return_packages (
         id, shop_id, source_platform, source_tracking_enc, source_tracking_hash,
         source_order_ref, source_return_ref, returned_at, manifest_source,
         manifest_fetched_at, manifest_hash, manifest_version, ingest_batch_ref,
         package_weight_gram, package_dimensions_cm, package_listing_price_vnd,
         inventory_status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, 'SPREADSHEET',
         now(), $9, 1, $10, $11, $12::jsonb, $13, 'AVAILABLE'
       )`,
      [
        packageId,
        shopId,
        draft.sourcePlatform,
        Buffer.from(draft.sourceTrackingEnc, "base64"),
        draft.sourceTrackingHash,
        draft.sourceOrderRef ?? null,
        draft.sourceReturnRef ?? null,
        draft.returnedAt ?? null,
        draft.manifestHash,
        batchId,
        draft.packageWeightGram ?? null,
        draft.packageDimensionsCm ? JSON.stringify(draft.packageDimensionsCm) : null,
        draft.packageListingPriceVnd
      ]
    );
  }
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeScannedCode(value: string): string {
  return value.trim().toUpperCase();
}

function canonicalManifest(drafts: ReturnManifestDraft[]): ReturnManifestDraft[] {
  return drafts
    .map((draft) => ({ ...draft, lines: [...draft.lines].sort((left, right) => left.sourceItemRef.localeCompare(right.sourceItemRef)) }))
    .sort((left, right) => packageGroupOfDraft(left).localeCompare(packageGroupOfDraft(right)));
}
