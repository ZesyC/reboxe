import { z } from "zod";

export const listingConditionSchema = z.enum([
  "NEW_SEALED",
  "LIKE_NEW_99",
  "GOOD",
  "FAIR",
  "DEFECT"
]);

export const createListingSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(5_000).optional(),
  categoryId: z.string().trim().min(1).max(80),
  conditionGrade: listingConditionSchema,
  conditionNotes: z.string().trim().min(3).max(2_000),
  price: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  weightGram: z.number().int().positive().max(100_000)
});
export type CreateListingInput = z.infer<typeof createListingSchema>;

export const updateListingDraftSchema = createListingSchema.strict();
export type UpdateListingDraftInput = z.infer<typeof updateListingDraftSchema>;

export const maxQuickListingMessages = 10;
export const maxQuickListingMessageLength = 1200;

export const quickListingConversationSchema = z.object({
  turns: z.array(z.object({
    message: z.string().trim().min(1).max(maxQuickListingMessageLength),
    question: z.string().trim().min(1).max(500).optional()
  }).strict()).min(1).max(maxQuickListingMessages)
}).strict();
export type QuickListingConversation = z.infer<typeof quickListingConversationSchema>;

export const quickListingDraftSchema = createListingSchema.partial().strict();
export type QuickListingSuggestion = {
  draft: z.infer<typeof quickListingDraftSchema>;
  question: string | null;
};

export const categorySchema = z.object({
  id: z.string(),
  name: z.string()
});
export type Category = z.infer<typeof categorySchema>;

export const listingPolicyLevelSchema = z.enum(["BANNED", "MANUAL_REVIEW", "DISCLOSURE"]);
export type ListingPolicyLevel = z.infer<typeof listingPolicyLevelSchema>;

export const catalogImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxCatalogImageBytes = 5 * 1024 * 1024;
export const maxCatalogImages = 6;

export const createCatalogImageUploadSchema = z.object({
  mimeType: z.enum(catalogImageMimeTypes),
  sizeBytes: z.number().int().positive().max(maxCatalogImageBytes)
}).strict();
export type CreateCatalogImageUploadInput = z.infer<typeof createCatalogImageUploadSchema>;

export const completeCatalogImageUploadSchema = z.object({ key: z.string().min(1).max(500) }).strict();
export type CompleteCatalogImageUploadInput = z.infer<typeof completeCatalogImageUploadSchema>;

export const catalogImageUploadIntentSchema = z.object({
  key: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  headers: z.record(z.string(), z.string())
});
export type CatalogImageUploadIntent = z.infer<typeof catalogImageUploadIntentSchema>;

export const listingImageSchema = z.object({
  key: z.string(),
  url: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});
export type ListingImage = z.infer<typeof listingImageSchema>;

export const listingSchema = createListingSchema.extend({
  id: z.string(),
  shopId: z.string(),
  shopDisplayName: z.string(),
  images: z.array(listingImageSchema).max(maxCatalogImages),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "ACTIVE", "HIDDEN_BY_FUND", "RESERVED", "SOLD", "RELISTABLE", "SUSPENDED", "DELISTED"]),
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  returnPackageId: z.string().nullable().optional()
});
export type Listing = z.infer<typeof listingSchema>;

export const listingPolicyResultSchema = z.object({
  outcome: z.enum(["ACTIVE", "PENDING_REVIEW"]),
  policyLevel: listingPolicyLevelSchema.nullable(),
  policyVersion: z.string().nullable(),
  message: z.string()
});
export type ListingPolicyResult = z.infer<typeof listingPolicyResultSchema>;

export const publishListingResultSchema = z.object({
  listing: listingSchema,
  policy: listingPolicyResultSchema
});
export type PublishListingResult = z.infer<typeof publishListingResultSchema>;

export const publicListingSchema = listingSchema.omit({ status: true, weightGram: true, returnPackageId: true }).extend({
  availableQuantity: z.union([z.literal(0), z.literal(1)]).optional(),
  package: z.object({
    disclosure: z.literal("UNOPENED_UNINSPECTED"),
    sealStatus: z.enum(["INTACT", "DAMAGED", "UNKNOWN"]),
    manifestSummary: z.object({ lineCount: z.number().int().positive(), unitCount: z.number().int().positive() }),
    lines: z.array(z.object({
      productName: z.string(),
      variantName: z.string().nullable(),
      brand: z.string().nullable(),
      quantity: z.number().int().positive(),
      categoryId: z.string(),
      originalUnitPriceVnd: z.number().int().positive().nullable()
    }))
  }).optional()
});
export type PublicListing = z.infer<typeof publicListingSchema>;

const optionalQueryText = (maxLength: number) =>
  z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(1).max(maxLength).optional());

export const publicListingsQuerySchema = z.object({
  cursor: optionalQueryText(512),
  q: optionalQueryText(180),
  category: optionalQueryText(80),
  shopId: optionalQueryText(80),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest")
}).strict();
export type PublicListingsQuery = z.infer<typeof publicListingsQuerySchema>;

export const publicListingPageSchema = z.object({
  sponsored: z.array(publicListingSchema),
  items: z.array(publicListingSchema),
  nextCursor: z.string().nullable()
});
export type PublicListingPage = z.infer<typeof publicListingPageSchema>;

export const publicShopSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  verified: z.boolean(),
  activeListingCount: z.number().int().nonnegative(),
  averageRating: z.number().min(1).max(5).nullable(),
  reviewCount: z.number().int().nonnegative(),
  location: z.string().nullable(),
  createdAt: z.string().datetime()
});
export type PublicShop = z.infer<typeof publicShopSchema>;

export const upsertShopReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().min(3).max(1_000)
}).strict();
export type UpsertShopReviewInput = z.infer<typeof upsertShopReviewSchema>;

export const shopReviewSchema = upsertShopReviewSchema.extend({
  id: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type ShopReview = z.infer<typeof shopReviewSchema>;

export const shopReviewEligibilitySchema = z.object({
  eligible: z.boolean(),
  reason: z.enum(["COMPLETED_ORDER_REQUIRED", "SHOP_MEMBER"]).nullable()
});
export type ShopReviewEligibility = z.infer<typeof shopReviewEligibilitySchema>;

export const manifestImportSourceSchema = z.enum(["SPREADSHEET", "PLATFORM_API"]);
export type ManifestImportSource = z.infer<typeof manifestImportSourceSchema>;

export const returnManifestLineDraftSchema = z.object({
  sourceItemRef: z.string().trim().min(1).max(200),
  sourceSku: z.string().trim().min(1).max(200).optional(),
  sourceQuantity: z.number().int().positive().max(100_000),
  productName: z.string().trim().min(1).max(500),
  variantName: z.string().trim().min(1).max(500).optional(),
  brand: z.string().trim().min(1).max(200).optional(),
  sourceCategory: z.string().trim().min(1).max(500).optional(),
  originalUnitPriceVnd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  returnReason: z.string().trim().min(1).max(200).optional(),
  productImageUrls: z.array(z.string().url()).max(20),
  reboxeCategoryId: z.string().trim().min(1).max(80)
}).strict();

export const returnManifestDraftSchema = z.object({
  source: manifestImportSourceSchema,
  sourcePlatform: z.enum(["SHOPEE", "TIKTOK"]),
  sourceTrackingNo: z.string().trim().min(1).max(200),
  sourceOrderRef: z.string().trim().min(1).max(200).optional(),
  sourceReturnRef: z.string().trim().min(1).max(200).optional(),
  returnedAt: z.string().datetime().optional(),
  packageWeightGram: z.number().int().positive().max(100_000).optional(),
  packageDimensionsCm: z.object({
    length: z.number().positive().max(1_000),
    width: z.number().positive().max(1_000),
    height: z.number().positive().max(1_000)
  }).strict().optional(),
  packageListingPriceVnd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  lines: z.array(returnManifestLineDraftSchema).min(1).max(5_000)
}).strict();
export type ReturnManifestDraft = z.infer<typeof returnManifestDraftSchema>;

export const returnManifestIssueCodeSchema = z.enum([
  "INVALID_FIELD",
  "INVALID_CATEGORY",
  "PACKAGE_FIELD_CONFLICT",
  "DUPLICATE_SOURCE_ITEM_REF"
]);
export type ReturnManifestIssueCode = z.infer<typeof returnManifestIssueCodeSchema>;

export const returnManifestPreviewRowSchema = z.object({
  rowIndex: z.number().int().positive(),
  packageGroup: z.string(),
  warningCodes: z.array(returnManifestIssueCodeSchema),
  errorCodes: z.array(returnManifestIssueCodeSchema)
});
export type ReturnManifestPreviewRow = z.infer<typeof returnManifestPreviewRowSchema>;

export const returnManifestPreviewSchema = z.object({
  batchId: z.string(),
  rows: z.array(returnManifestPreviewRowSchema),
  drafts: z.array(returnManifestDraftSchema),
  canCommit: z.boolean()
});
export type ReturnManifestPreview = z.infer<typeof returnManifestPreviewSchema>;

export const commitReturnManifestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200)
}).strict();
export type CommitReturnManifestInput = z.infer<typeof commitReturnManifestSchema>;

export const commitReturnManifestResultSchema = z.object({
  batchId: z.string(),
  packageIds: z.array(z.string()),
  lineCount: z.number().int().nonnegative()
});
export type CommitReturnManifestResult = z.infer<typeof commitReturnManifestResultSchema>;

export const sellerInventoryPackageSchema = z.object({
  id: z.string(),
  sourcePlatform: z.enum(["SHOPEE", "TIKTOK"]),
  sourceOrderRef: z.string().nullable(),
  title: z.string(),
  variantName: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  lineCount: z.number().int().positive(),
  unitCount: z.number().int().positive(),
  price: z.number().int().positive(),
  status: z.enum(["SOURCE_PENDING", "AVAILABLE", "RESERVED", "SOLD", "VOID"]),
  createdAt: z.string().datetime()
});
export type SellerInventoryPackage = z.infer<typeof sellerInventoryPackageSchema>;

export const scanReturnPackageSchema = z.object({
  scannedCode: z.string().trim().min(1).max(200),
  codeType: z.enum(["ORDER_SN", "TRACKING_NO", "UNKNOWN"]),
  platformHint: z.enum(["SHOPEE", "TIKTOK"]).nullable()
}).strict();
export type ScanReturnPackageInput = z.infer<typeof scanReturnPackageSchema>;

export const packageListingManifestLineSchema = z.object({
  productName: z.string(), variantName: z.string().nullable(), brand: z.string().nullable(),
  quantity: z.number().int().positive(), categoryId: z.string(), originalUnitPriceVnd: z.number().int().positive().nullable()
});
export const packageListingDraftResultSchema = z.object({
  packageId: z.string(), listing: listingSchema,
  disclosure: z.literal("UNOPENED_UNINSPECTED"), sealStatus: z.enum(["INTACT", "DAMAGED", "UNKNOWN"]),
  manifestLines: z.array(packageListingManifestLineSchema)
});
export type PackageListingDraftResult = z.infer<typeof packageListingDraftResultSchema>;

export const batchCreatePackageListingsSchema = z.object({ packageIds: z.array(z.string()).min(1).max(100) }).strict();
export type BatchCreatePackageListingsInput = z.infer<typeof batchCreatePackageListingsSchema>;
export type BatchCreatePackageListingsResult = Array<{
  packageId: string; listing?: Listing; error?: { code: string; message: string };
}>;

export const listingReviewDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]), reason: z.string().trim().min(1).max(1000)
}).strict();
export type ListingReviewDecisionInput = z.infer<typeof listingReviewDecisionSchema>;

export const maxReturnManifestFileBytes = 5 * 1024 * 1024;
