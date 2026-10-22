import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [check("profiles_status_check", sql`${table.status} IN ('ACTIVE', 'SUSPENDED', 'DELETED')`)]
);

export const accountAddresses = pgTable(
  "account_addresses",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    recipientNameEnc: bytea("recipient_name_enc").notNull(),
    phoneEnc: bytea("phone_enc").notNull(),
    addressLineEnc: bytea("address_line_enc").notNull(),
    ward: text("ward").notNull(),
    district: text("district").notNull(),
    province: text("province").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_account_addresses_user_created").on(table.userId, table.createdAt),
    uniqueIndex("account_addresses_one_default_per_user").on(table.userId).where(sql`${table.isDefault}`)
  ]
);

export const accountPreferences = pgTable("account_preferences", {
  userId: uuid("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  orderEmail: boolean("order_email").notNull().default(true),
  promotionEmail: boolean("promotion_email").notNull().default(false),
  surveyEmail: boolean("survey_email").notNull().default(true),
  promotionSms: boolean("promotion_sms").notNull().default(false),
  promotionZalo: boolean("promotion_zalo").notNull().default(true),
  personalizedRecommendations: boolean("personalized_recommendations").notNull().default(true),
  shareUsageAnalytics: boolean("share_usage_analytics").notNull().default(false),
  publicPurchaseActivity: boolean("public_purchase_activity").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    buyerId: uuid("buyer_id").notNull().references(() => profiles.id),
    shopId: text("shop_id").references(() => shops.id),
    status: text("status").notNull().default("PENDING"),
    totalVnd: bigint("total_vnd", { mode: "number" }).notNull(),
    itemCount: integer("item_count").notNull(),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("purchase_orders_status_check", sql`${table.status} IN ('PENDING', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED')`),
    check("purchase_orders_total_check", sql`${table.totalVnd} >= 0`),
    check("purchase_orders_item_count_check", sql`${table.itemCount} > 0`),
    index("idx_purchase_orders_buyer_placed").on(table.buyerId, table.placedAt),
    index("idx_purchase_orders_buyer_shop_status").on(table.buyerId, table.shopId, table.status)
  ]
);

export const shops = pgTable(
  "shops",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    legalType: text("legal_type").notNull(),
    kycStatus: text("kyc_status").notNull().default("PENDING"),
    kycVerifiedAt: timestamp("kyc_verified_at", { withTimezone: true }),
    status: text("status").notNull().default("ONBOARDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("shops_legal_type_check", sql`${table.legalType} IN ('INDIVIDUAL', 'HOUSEHOLD', 'ENTERPRISE')`),
    check("shops_kyc_status_check", sql`${table.kycStatus} IN ('PENDING', 'PROCESSING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW')`),
    unique("shops_display_name_unique").on(table.displayName),
    check(
      "shops_status_check",
      sql`${table.status} IN ('ONBOARDING', 'ACTIVE', 'PAUSED', 'LOCKED_INSUFFICIENT_FUND', 'SUSPENDED')`
    )
  ]
);

export const shopReviews = pgTable(
  "shop_reviews",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("shop_reviews_shop_reviewer_unique").on(table.shopId, table.reviewerId),
    check("shop_reviews_rating_check", sql`${table.rating} BETWEEN 1 AND 5`),
    check("shop_reviews_content_check", sql`char_length(${table.content}) BETWEEN 3 AND 1000 AND ${table.content} = btrim(${table.content})`),
    index("idx_shop_reviews_shop_updated").on(table.shopId, table.updatedAt)
  ]
);

export const shopOnboardingProfiles = pgTable("shop_onboarding_profiles", {
  shopId: text("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  avatarRef: text("avatar_ref").notNull().default("MOCK_DEFAULT_AVATAR"),
  phoneEnc: bytea("phone_enc").notNull(),
  pickupContactEnc: bytea("pickup_contact_enc").notNull(),
  pickupAddressEnc: bytea("pickup_address_enc").notNull(),
  pickupProvince: text("pickup_province").notNull(),
  pickupDistrict: text("pickup_district").notNull(),
  pickupWard: text("pickup_ward").notNull(),
  kycMode: text("kyc_mode").notNull().default("MANUAL"),
  kycFrontRef: text("kyc_front_ref").notNull(),
  kycBackRef: text("kyc_back_ref").notNull(),
  kycFrontSha256: text("kyc_front_sha256").notNull(),
  kycBackSha256: text("kyc_back_sha256").notNull(),
  taxCodeEnc: bytea("tax_code_enc").notNull(),
  payoutBankCode: text("payout_bank_code").notNull(),
  payoutAccountEnc: bytea("payout_account_enc").notNull(),
  payoutHolderEnc: bytea("payout_holder_enc").notNull(),
  carrierCodes: jsonb("carrier_codes").$type<Array<"GHN" | "GHTK">>().notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [check("shop_onboarding_profiles_kyc_mode_check", sql`${table.kycMode} = 'MANUAL'`)]);

export const shopMemberships = pgTable(
  "shop_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id),
    role: text("role").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.shopId] }),
    check("shop_memberships_role_check", sql`${table.role} IN ('OWNER', 'MANAGER', 'WAREHOUSE', 'ACCOUNTING')`),
    check("shop_memberships_status_check", sql`${table.status} IN ('ACTIVE', 'INACTIVE')`)
  ]
);

export const sellerKyc = pgTable(
  "seller_kyc",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    citizenIdEnc: bytea("citizen_id_enc"),
    fullNameEnc: bytea("full_name_enc"),
    dobEnc: bytea("dob_enc"),
    genderEnc: bytea("gender_enc"),
    addressEnc: bytea("address_enc"),
    issuedAtEnc: bytea("issued_at_enc"),
    provider: text("provider").notNull(),
    providerReference: text("provider_reference"),
    frontRef: text("front_ref"),
    backRef: text("back_ref"),
    selfieRef: text("selfie_ref"),
    frontValid: boolean("front_valid"),
    backValid: boolean("back_valid"),
    faceMatched: boolean("face_matched"),
    faceMatchScore: doublePrecision("face_match_score"),
    livenessPassed: boolean("liveness_passed"),
    livenessScore: doublePrecision("liveness_score"),
    status: text("status").notNull().default("PENDING"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("seller_kyc_shop_unique").on(table.shopId),
    check("seller_kyc_status_check", sql`${table.status} IN ('PENDING', 'PROCESSING', 'VERIFIED', 'REJECTED', 'MANUAL_REVIEW')`),
    index("idx_seller_kyc_user_created").on(table.userId, table.createdAt)
  ]
);

export const sellerBankAccounts = pgTable(
  "seller_bank_accounts",
  {
    kycId: text("kyc_id").primaryKey().references(() => sellerKyc.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    bankCode: text("bank_code").notNull(),
    accountNumberEnc: bytea("account_number_enc").notNull(),
    accountHolderNameEnc: bytea("account_holder_name_enc"),
    nameMatchScore: doublePrecision("name_match_score"),
    verificationStatus: text("verification_status").notNull(),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [check("seller_bank_verification_status_check", sql`${table.verificationStatus} IN ('VERIFIED', 'NOT_FOUND', 'UNAVAILABLE')`)]
);

export const sellerTaxInfo = pgTable(
  "seller_tax_info",
  {
    kycId: text("kyc_id").primaryKey().references(() => sellerKyc.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    taxCodeEnc: bytea("tax_code_enc").notNull(),
    taxpayerNameEnc: bytea("taxpayer_name_enc"),
    verificationStatus: text("verification_status").notNull(),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [check("seller_tax_verification_status_check", sql`${table.verificationStatus} IN ('VERIFIED', 'NOT_FOUND', 'UNAVAILABLE')`)]
);

export type ListingImage = { key: string; width: number; height: number };

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_categories_picker").on(table.active, table.sortOrder, table.name)]
);

export const restrictedCategories = pgTable(
  "restricted_categories",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id").notNull().references(() => categories.id),
    policyLevel: text("policy_level").notNull(),
    ruleSnapshot: jsonb("rule_snapshot").$type<Record<string, unknown>>().notNull(),
    policyVersion: text("policy_version").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    approvedBy: uuid("approved_by").notNull().references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("restricted_categories_policy_level_check", sql`${table.policyLevel} IN ('BANNED', 'MANUAL_REVIEW', 'DISCLOSURE')`),
    unique("restricted_categories_category_version_unique").on(table.categoryId, table.policyVersion),
    index("idx_restricted_categories_effective").on(table.categoryId, table.effectiveFrom, table.effectiveTo)
  ]
);

export const returnImportBatches = pgTable(
  "return_import_batches",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    source: text("source").notNull(),
    fileHash: text("file_hash").notNull(),
    manifestHash: text("manifest_hash").notNull(),
    status: text("status").notNull().default("PREVIEWED"),
    canCommit: boolean("can_commit").notNull(),
    normalizedPayload: jsonb("normalized_payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key"),
    commitResult: jsonb("commit_result").$type<Record<string, unknown>>(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("return_import_batches_source_check", sql`${table.source} IN ('SPREADSHEET', 'PLATFORM_API')`),
    check("return_import_batches_status_check", sql`${table.status} IN ('PREVIEWED', 'COMMITTED')`),
    unique("return_import_batches_shop_idempotency_unique").on(table.shopId, table.idempotencyKey),
    index("idx_return_import_batches_shop_created").on(table.shopId, table.createdAt)
  ]
);

export const returnPackages = pgTable(
  "return_packages",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull().references(() => shops.id),
    sourcePlatform: text("source_platform").notNull(),
    sourceTrackingEnc: bytea("source_tracking_enc").notNull(),
    sourceTrackingHash: text("source_tracking_hash").notNull(),
    sourceOrderRef: text("source_order_ref"),
    sourceReturnRef: text("source_return_ref"),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    manifestSource: text("manifest_source").notNull(),
    manifestFetchedAt: timestamp("manifest_fetched_at", { withTimezone: true }).notNull(),
    manifestHash: text("manifest_hash").notNull(),
    manifestVersion: bigint("manifest_version", { mode: "number" }).notNull().default(1),
    ingestBatchRef: text("ingest_batch_ref").notNull().references(() => returnImportBatches.id),
    sealStatus: text("seal_status").notNull().default("UNKNOWN"),
    disclosure: text("disclosure").notNull().default("UNOPENED_UNINSPECTED"),
    packageWeightGram: integer("package_weight_gram"),
    packageDimensionsCm: jsonb("package_dimensions_cm").$type<{ length: number; width: number; height: number }>(),
    packageListingPriceVnd: bigint("package_listing_price_vnd", { mode: "number" }).notNull(),
    inventoryStatus: text("inventory_status").notNull().default("AVAILABLE"),
    reservedUntil: timestamp("reserved_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("return_packages_platform_check", sql`${table.sourcePlatform} IN ('SHOPEE', 'TIKTOK')`),
    check("return_packages_manifest_source_check", sql`${table.manifestSource} IN ('SPREADSHEET', 'PLATFORM_API')`),
    check("return_packages_seal_status_check", sql`${table.sealStatus} IN ('INTACT', 'DAMAGED', 'UNKNOWN')`),
    check("return_packages_disclosure_check", sql`${table.disclosure} = 'UNOPENED_UNINSPECTED'`),
    check("return_packages_weight_check", sql`${table.packageWeightGram} IS NULL OR (${table.packageWeightGram} > 0 AND ${table.packageWeightGram} <= 100000)`),
    check("return_packages_listing_price_check", sql`${table.packageListingPriceVnd} > 0`),
    check("return_packages_inventory_status_check", sql`${table.inventoryStatus} IN ('SOURCE_PENDING', 'AVAILABLE', 'RESERVED', 'SOLD', 'VOID')`),
    unique("return_packages_shop_platform_tracking_unique").on(
      table.shopId,
      table.sourcePlatform,
      table.sourceTrackingHash
    )
  ]
);

export const returnLines = pgTable(
  "return_lines",
  {
    id: text("id").primaryKey(),
    returnPackageId: text("return_package_id").notNull().references(() => returnPackages.id),
    sourceItemRef: text("source_item_ref").notNull(),
    sourceSku: text("source_sku"),
    sourceQuantity: integer("source_quantity").notNull(),
    productName: text("product_name").notNull(),
    variantName: text("variant_name"),
    brand: text("brand"),
    sourceCategory: text("source_category"),
    originalUnitPriceVnd: bigint("original_unit_price_vnd", { mode: "number" }),
    returnReason: text("return_reason"),
    productImageUrls: jsonb("product_image_urls").$type<string[]>().notNull().default([]),
    reboxeCategoryId: text("reboxe_category_id").notNull().references(() => categories.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("return_lines_source_quantity_check", sql`${table.sourceQuantity} > 0`),
    unique("return_lines_package_source_item_unique").on(table.returnPackageId, table.sourceItemRef)
  ]
);

export const listings = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    returnPackageId: text("return_package_id").references(() => returnPackages.id),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id),
    title: text("title").notNull(),
    description: text("description"),
    categoryId: text("category_id").notNull().references(() => categories.id),
    conditionGrade: text("condition_grade").notNull(),
    conditionNotes: text("condition_notes").notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    weightGram: integer("weight_gram").notNull(),
    images: jsonb("images").$type<ListingImage[]>().notNull().default([]),
    priceSource: text("price_source").notNull().default("SELLER_DECLARED"),
    status: text("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    appliedPolicyVersion: text("applied_policy_version"),
    appliedPolicySnapshot: jsonb("applied_policy_snapshot").$type<Record<string, unknown>>(),
    policyEvaluatedAt: timestamp("policy_evaluated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("listings_price_check", sql`${table.price} > 0`),
    check("listings_weight_check", sql`${table.weightGram} > 0 AND ${table.weightGram} <= 100000`),
    check("listings_price_source_check", sql`${table.priceSource} IN ('SELLER_DECLARED', 'VERIFIED_CSV', 'VERIFIED_PLATFORM')`),
    check(
      "listings_status_check",
      sql`${table.status} IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'HIDDEN_BY_FUND', 'RESERVED', 'SOLD', 'RELISTABLE', 'SUSPENDED', 'DELISTED')`
    ),
    index("idx_listings_public").on(table.status, table.id),
    index("idx_listings_shop_created").on(table.shopId, table.createdAt),
    uniqueIndex("listings_return_package_unique").on(table.returnPackageId).where(sql`${table.returnPackageId} IS NOT NULL`)
  ]
);

export const listingReviews = pgTable("listing_reviews", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id),
  reviewerId: uuid("reviewer_id").notNull().references(() => profiles.id),
  decision: text("decision").notNull(), reason: text("reason").notNull(),
  idempotencyKey: uuid("idempotency_key").notNull(), requestHash: text("request_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  unique("listing_reviews_listing_unique").on(table.listingId),
  unique("listing_reviews_reviewer_key_unique").on(table.reviewerId, table.idempotencyKey),
  check("listing_reviews_decision_check", sql`${table.decision} IN ('APPROVE', 'REJECT')`)
]);

export const listingPromotions = pgTable("listing_promotions", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id),
  shopId: text("shop_id").notNull().references(() => shops.id),
  status: text("status").notNull().default("ACTIVE"),
  feeVnd: bigint("fee_vnd", { mode: "number" }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  refundedVnd: bigint("refunded_vnd", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex("listing_promotions_one_active").on(table.listingId).where(sql`${table.status} = 'ACTIVE'`),
  index("listing_promotions_home").on(table.status, table.endsAt, table.startsAt)
]);

export const idempotencyRecords = pgTable("idempotency_records", {
  actorId: uuid("actor_id").notNull().references(() => profiles.id), scope: text("scope").notNull(),
  idempotencyKey: text("idempotency_key").notNull(), requestHash: text("request_hash").notNull(),
  response: jsonb("response"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.actorId, table.scope, table.idempotencyKey] })]);

export const ledgerTransactions = pgTable("ledger_transactions", {
  id: text("id").primaryKey(), kind: text("kind").notNull(), referenceId: text("reference_id").notNull(),
  status: text("status").notNull().default("DRAFT"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [unique("ledger_transactions_kind_reference_unique").on(table.kind, table.referenceId)]);

export const ledgerPostings = pgTable("ledger_postings", {
  id: text("id").primaryKey(), transactionId: text("transaction_id").notNull().references(() => ledgerTransactions.id),
  accountKey: text("account_key").notNull(), amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("idx_ledger_postings_account").on(table.accountKey, table.createdAt)]);

export const orders = pgTable("orders", {
  id: text("id").primaryKey(), buyerId: uuid("buyer_id").notNull().references(() => profiles.id),
  status: text("status").notNull().default("RESERVED"), commerceMode: text("commerce_mode").notNull().default("SANDBOX"),
  paymentMethod: text("payment_method"), subtotalVnd: bigint("subtotal_vnd", { mode: "number" }).notNull(),
  feeVnd: bigint("fee_vnd", { mode: "number" }).notNull(), totalVnd: bigint("total_vnd", { mode: "number" }).notNull(),
  addressSnapshotEnc: bytea("address_snapshot_enc").notNull(), addressHash: text("address_hash").notNull(),
  feeSnapshot: jsonb("fee_snapshot").$type<Record<string, unknown>>().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const subOrders = pgTable("sub_orders", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().unique().references(() => orders.id),
  shopId: text("shop_id").notNull().references(() => shops.id), shopSnapshot: jsonb("shop_snapshot").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("RESERVED"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const subOrderItems = pgTable("sub_order_items", {
  id: text("id").primaryKey(), subOrderId: text("sub_order_id").notNull().references(() => subOrders.id),
  listingId: text("listing_id").notNull().references(() => listings.id), returnPackageId: text("return_package_id").notNull().unique().references(() => returnPackages.id),
  itemSnapshot: jsonb("item_snapshot").$type<Record<string, unknown>>().notNull(), amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(),
  quantity: integer("quantity").notNull().default(1)
});

export const fundHolds = pgTable("fund_holds", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().unique().references(() => orders.id),
  shopId: text("shop_id").notNull().references(() => shops.id), amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(),
  status: text("status").notNull().default("HELD"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const orderEvents = pgTable("order_events", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().references(() => orders.id), eventKey: text("event_key").notNull().unique(),
  fromStatus: text("from_status"), toStatus: text("to_status").notNull(), source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const shipments = pgTable("shipments", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().unique().references(() => orders.id), provider: text("provider").notNull().default("FAKE"),
  providerKey: text("provider_key").notNull().unique(), trackingCode: text("tracking_code").notNull().unique(), status: text("status").notNull(),
  labelPayload: text("label_payload").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const carrierEvents = pgTable("carrier_events", {
  id: text("id").primaryKey(), shipmentId: text("shipment_id").notNull().references(() => shipments.id), providerEventId: text("provider_event_id").notNull().unique(),
  payloadHash: text("payload_hash").notNull(), normalizedStatus: text("normalized_status").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const processingRecords = pgTable("processing_records", {
  id: text("id").primaryKey(), actorId: uuid("actor_id").notNull().references(() => profiles.id), purpose: text("purpose").notNull(),
  targetType: text("target_type").notNull(), targetId: text("target_id").notNull(), noticeVersion: text("notice_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const disputeCases = pgTable("dispute_cases", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull().unique().references(() => orders.id), buyerId: uuid("buyer_id").notNull().references(() => profiles.id),
  shopId: text("shop_id").notNull().references(() => shops.id), status: text("status").notNull().default("OPEN"), flags: text("flags").array().notNull().default([]),
  reason: text("reason").notNull(), buyerPayableVnd: bigint("buyer_payable_vnd", { mode: "number" }).notNull(), appealUntil: timestamp("appeal_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const disputeCaseEvents = pgTable("dispute_case_events", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull().references(() => disputeCases.id), actorId: uuid("actor_id").notNull().references(() => profiles.id),
  type: text("type").notNull(), body: text("body").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const disputeEvidences = pgTable("dispute_evidences", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull().references(() => disputeCases.id), uploaderId: uuid("uploader_id").notNull().references(() => profiles.id),
  processingRecordId: text("processing_record_id").notNull().references(() => processingRecords.id), provider: text("provider").notNull().default("FAKE_METADATA"),
  objectKey: text("object_key").notNull(), objectVersion: text("object_version").notNull(), checksum: text("checksum").notNull(), originalOwner: text("original_owner").notNull(),
  storageBucket: text("storage_bucket"), storageRegion: text("storage_region"), mimeType: text("mime_type"), durationSeconds: numeric("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const evidenceDerivatives = pgTable("evidence_derivatives", {
  id: text("id").primaryKey(), evidenceId: text("evidence_id").notNull().unique().references(() => disputeEvidences.id), objectKey: text("object_key").notNull(),
  objectVersion: text("object_version").notNull(), checksum: text("checksum").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const refunds = pgTable("refunds", {
  id: text("id").primaryKey(), caseId: text("case_id").notNull().references(() => disputeCases.id), orderId: text("order_id").notNull().references(() => orders.id),
  amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(), funder: text("funder").notNull(), returnRequired: boolean("return_required").notNull(),
  status: text("status").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(), userId: uuid("user_id").notNull().references(() => profiles.id), stableKey: text("stable_key").notNull().unique(),
  kind: text("kind").notNull(), mandatory: boolean("mandatory").notNull().default(true), title: text("title").notNull(), body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }), deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("idx_notifications_user_created").on(table.userId, table.createdAt)]);

export const legalArtifacts = pgTable("legal_artifacts", {
  slug: text("slug").notNull(), version: text("version").notNull(), title: text("title").notNull(), body: text("body").notNull(),
  bodyHash: text("body_hash").notNull().unique(), effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.slug, table.version] })]);

export const legalAcceptances = pgTable("legal_acceptances", {
  id: text("id").primaryKey(), userId: uuid("user_id").notNull().references(() => profiles.id), slug: text("slug").notNull(),
  version: text("version").notNull(), source: text("source").notNull(), acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [unique("legal_acceptances_user_slug_version_unique").on(table.userId, table.slug, table.version)]);

export const supportTickets = pgTable("support_tickets", {
  id: text("id").primaryKey(), userId: uuid("user_id").notNull().references(() => profiles.id), category: text("category").notNull(),
  content: text("content").notNull(), orderId: text("order_id").references(() => orders.id), caseId: text("case_id").references(() => disputeCases.id),
  status: text("status").notNull().default("OPEN"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const supportTicketEvents = pgTable("support_ticket_events", {
  id: text("id").primaryKey(), ticketId: text("ticket_id").notNull().references(() => supportTickets.id), actorId: uuid("actor_id").notNull().references(() => profiles.id),
  body: text("body").notNull(), status: text("status"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const privacyRequests = pgTable("privacy_requests", {
  id: text("id").primaryKey(), userId: uuid("user_id").notNull().references(() => profiles.id), type: text("type").notNull(),
  status: text("status").notNull().default("RECEIVED"), receipt: jsonb("receipt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const aiTriageReports = pgTable("ai_triage_reports", {
  id: uuid("id").primaryKey(), caseId: text("case_id").notNull().references(() => disputeCases.id),
  evidenceId: text("evidence_id").notNull().references(() => disputeEvidences.id),
  evidenceVersion: text("evidence_version").notNull(), evidenceChecksum: text("evidence_checksum").notNull(),
  requestedBy: uuid("requested_by").notNull().references(() => profiles.id), modelId: text("model_id").notNull(),
  modelRevision: text("model_revision").notNull(), promptVersion: text("prompt_version").notNull(),
  report: jsonb("report").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [unique("ai_triage_reports_evidence_identity_key").on(table.evidenceId, table.evidenceVersion,
  table.evidenceChecksum, table.modelId, table.modelRevision, table.promptVersion),
  check("ai_triage_reports_check", sql`${table.report}->>'recommendation'='ADMIN_REVIEW' AND ${table.report}->>'financialAction'='NONE'`)]);

export const evidenceUploads = pgTable("evidence_uploads", {
  id: uuid("id").primaryKey(), evidenceId: text("evidence_id").notNull().unique(),
  caseId: text("case_id").notNull().references(() => disputeCases.id), actorId: uuid("actor_id").notNull().references(() => profiles.id),
  actorRole: text("actor_role").notNull(), processingRecordId: text("processing_record_id").notNull().references(() => processingRecords.id),
  bucket: text("bucket").notNull(), region: text("region").notNull(), objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(), sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(), checksum: text("checksum").notNull(),
  retainUntil: timestamp("retain_until", { withTimezone: true }).notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("UPLOADING"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [check("evidence_uploads_actor_role_check", sql`${table.actorRole} IN ('BUYER','SELLER')`),
  check("evidence_uploads_size_bytes_check", sql`${table.sizeBytes}>0 AND ${table.sizeBytes}<=20971520`),
  check("evidence_uploads_status_check", sql`${table.status} IN ('UPLOADING','READY')`)]);

export const promotionCreditTopups = pgTable("promotion_credit_topups", {
  id: uuid("id").primaryKey(), actorId: uuid("actor_id").notNull().references(() => profiles.id),
  shopId: text("shop_id").notNull().references(() => shops.id), idempotencyKey: uuid("idempotency_key").notNull(),
  merchantClientId: text("merchant_client_id").notNull(),
  orderCode: bigint("order_code", { mode: "number" }).notNull().unique().default(sql`nextval('payos_promotion_order_code_seq')`),
  amountVnd: bigint("amount_vnd", { mode: "number" }).notNull(), paymentLinkId: text("payment_link_id").unique(), checkoutUrl: text("checkout_url"),
  status: text("status").notNull().default("CREATING"), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), paidAt: timestamp("paid_at", { withTimezone: true })
}, (table) => [unique("promotion_credit_topups_actor_id_idempotency_key_key").on(table.actorId, table.idempotencyKey),
  check("promotion_credit_topups_amount_vnd_check", sql`${table.amountVnd} BETWEEN 10000 AND 10000000`),
  check("promotion_credit_topups_status_check", sql`${table.status} IN ('CREATING','UNKNOWN','PENDING','PAID','CANCELLED','EXPIRED','BLOCKED')`)]);

export const payosReceipts = pgTable("payos_receipts", {
  reference: text("reference").primaryKey(), topupId: uuid("topup_id").notNull().references(() => promotionCreditTopups.id),
  payloadHash: text("payload_hash").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export type OutboxPayload = Record<string, unknown>;

export const marketplaceAuthorizations = pgTable("marketplace_authorizations", {
  id: uuid("id").primaryKey(), shopId: text("shop_id").notNull().references(() => shops.id),
  actorId: uuid("actor_id").notNull().references(() => profiles.id), platform: text("platform").notNull(),
  stateHash: text("state_hash").notNull().unique(), noticeVersion: text("notice_version").notNull(),
  status: text("status").notNull().default("PENDING"), grantsEnc: bytea("grants_enc"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true })
}, (table) => [index("marketplace_authorizations_expiry").on(table.expiresAt),
  check("marketplace_authorizations_platform_check", sql`${table.platform} IN ('SHOPEE','TIKTOK')`),
  check("marketplace_authorizations_status_check", sql`${table.status} IN ('PENDING','EXCHANGING','SELECT_SHOP','COMPLETED','FAILED')`)]);

export const marketplaceConnections = pgTable("marketplace_connections", {
  id: uuid("id").primaryKey(), shopId: text("shop_id").notNull().references(() => shops.id),
  platform: text("platform").notNull(), externalShopId: text("external_shop_id").notNull(), shopName: text("shop_name").notNull(),
  credentialsEnc: bytea("credentials_enc"), status: text("status").notNull(),
  consentActorId: uuid("consent_actor_id").notNull().references(() => profiles.id), noticeVersion: text("notice_version").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  refreshRetryAt: timestamp("refresh_retry_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [unique("marketplace_connections_shop_id_platform_key").on(table.shopId, table.platform),
  unique("marketplace_connections_platform_external_shop_id_key").on(table.platform, table.externalShopId),
  check("marketplace_connections_platform_check", sql`${table.platform} IN ('SHOPEE','TIKTOK')`),
  check("marketplace_connections_status_check", sql`${table.status} IN ('CONNECTED','REAUTH_REQUIRED','DISCONNECTED')`),
  check("marketplace_connections_check", sql`(${table.status} = 'DISCONNECTED') = (${table.credentialsEnc} IS NULL)`)]);

export const marketplaceConnectionEvents = pgTable("marketplace_connection_events", {
  id: uuid("id").primaryKey(), shopId: text("shop_id").notNull().references(() => shops.id), platform: text("platform").notNull(),
  actorId: uuid("actor_id").notNull().references(() => profiles.id), event: text("event").notNull(), noticeVersion: text("notice_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [check("marketplace_connection_events_event_check", sql`${table.event} IN ('CONSENT','CONNECTED','DISCONNECTED','REAUTH_REQUIRED')`)]);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: text("id").primaryKey(),
    topic: text("topic").notNull(),
    aggregateId: text("aggregate_id"),
    payload: jsonb("payload").$type<OutboxPayload>().notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    status: text("status").notNull().default("PENDING"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("outbox_status_check", sql`${table.status} IN ('PENDING', 'PROCESSING', 'PROCESSED', 'DEAD')`),
    index("idx_outbox_claim").on(table.status, table.availableAt)
  ]
);

export const platformStaffRoles = pgTable("platform_staff_roles", {
  userId: uuid("user_id").notNull().references(() => profiles.id),
  role: text("role").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  primaryKey({ columns: [table.userId, table.role] }),
  check("platform_staff_roles_role_check", sql`${table.role} IN ('SUPPORT', 'MODERATOR', 'DISPUTE_ARBITRATOR', 'SUPER_ADMIN')`),
  check("platform_staff_roles_status_check", sql`${table.status} IN ('ACTIVE', 'INACTIVE')`)
]);

export const sellerKycReviews = pgTable("seller_kyc_reviews", {
  id: text("id").primaryKey(),
  kycId: text("kyc_id").notNull().references(() => sellerKyc.id),
  reviewerId: uuid("reviewer_id").notNull().references(() => profiles.id),
  decision: text("decision").notNull(),
  reason: text("reason").notNull(),
  idempotencyKey: uuid("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  unique("seller_kyc_reviews_kyc_unique").on(table.kycId),
  unique("seller_kyc_reviews_reviewer_key_unique").on(table.reviewerId, table.idempotencyKey),
  check("seller_kyc_reviews_decision_check", sql`${table.decision} IN ('APPROVE', 'REJECT')`),
  check("seller_kyc_reviews_reason_check", sql`char_length(btrim(${table.reason})) BETWEEN 1 AND 1000 AND ${table.reason} = btrim(${table.reason})`)
]);
