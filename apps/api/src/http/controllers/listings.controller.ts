import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DomainError, type InventoryModule } from "@reboxe/backend";
import {
  completeCatalogImageUploadSchema,
  commitReturnManifestSchema,
  createCatalogImageUploadSchema,
  createListingSchema,
  type CatalogImageUploadIntent,
  type Category,
  type CommitReturnManifestResult,
  type Listing,
  type PublicListing,
  type PublicListingPage,
  type PublicShop,
  type ShopReview,
  type ShopReviewEligibility,
  type PublishListingResult,
  type ReturnManifestPreview,
  type SellerInventoryPackage,
  maxReturnManifestFileBytes,
  publicListingsQuerySchema,
  quickListingConversationSchema,
  type QuickListingSuggestion,
  shoppingConversationSchema,
  type ShoppingSuggestions,
  upsertShopReviewSchema,
  updateListingDraftSchema,
  scanReturnPackageSchema,
  batchCreatePackageListingsSchema,
  listingReviewDecisionSchema,
  type PackageListingDraftResult,
  type BatchCreatePackageListingsResult
} from "@reboxe/shared";
import { INVENTORY } from "../../backend.providers";
import { suggestQuickListing } from "../../platform/ai/quick-listing";
import { suggestShoppingListings } from "../../platform/ai/shopping-assistant";
import { maxShoppingAudioBytes, transcribeShoppingAudio, type ShoppingAudioFile } from "../../platform/ai/shopping-transcription";
import { CurrentActor } from "../decorators/current-actor";
import { Public } from "../decorators/public";
import type { Actor } from "../types/authenticated-request";

type UploadedManifestFile = {
  originalname: string;
  buffer: Buffer;
};

@Controller("v1")
export class ListingsController {
  constructor(@Inject(INVENTORY) private readonly inventory: InventoryModule) {}

  @Public()
  @Get("categories")
  listCategories(): Promise<Category[]> {
    return this.inventory.listCategories();
  }

  @Post("shops/:shopId/listings")
  createDraft(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string
  ): Promise<Listing> {
    const parsed = createListingSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", 422, parsed.error.issues[0]?.message ?? "Invalid listing");
    }
    if (key !== undefined && !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(key)) {
      throw new DomainError("VALIDATION_FAILED", 422, "A UUID idempotency key is required");
    }
    return this.inventory.createDraft(actor.id, shopId, parsed.data, key);
  }

  @Post("shops/:shopId/quick-listing")
  async suggestListing(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Body() body: unknown
  ): Promise<QuickListingSuggestion> {
    const parsed = quickListingConversationSchema.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid listing conversation");
    const categories = await this.inventory.listListingCategoriesForShop(actor.id, shopId);
    if (!categories.length) throw new DomainError("INVALID_CATEGORY", 422, "No listing categories are available");
    return suggestQuickListing(parsed.data, categories);
  }

  @Post("shops/:shopId/return-imports/preview")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: maxReturnManifestFileBytes, files: 1 } }))
  previewReturnManifest(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @UploadedFile() file?: UploadedManifestFile
  ): Promise<ReturnManifestPreview> {
    if (!file) throw new DomainError("SPREADSHEET_FORMAT_INVALID", 422, "A CSV or XLSX file is required");
    return this.inventory.previewReturnManifest(actor.id, shopId, file.originalname, file.buffer);
  }

  @Post("shops/:shopId/return-imports/:batchId/commit")
  commitReturnManifest(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Param("batchId") batchId: string,
    @Body() body: unknown
  ): Promise<CommitReturnManifestResult> {
    const parsed = commitReturnManifestSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", 422, parsed.error.issues[0]?.message ?? "Invalid commit request");
    }
    return this.inventory.commitReturnManifest(actor.id, shopId, batchId, parsed.data.idempotencyKey);
  }

  @Post("shops/:shopId/return-packages/scan")
  scanReturnPackage(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string
  ): Promise<PackageListingDraftResult> {
    if (!key) throw new DomainError("VALIDATION_FAILED", 422, "Idempotency-Key is required");
    const parsed = scanReturnPackageSchema.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid scanned package code");
    return this.inventory.scanReturnPackage(actor.id, shopId, parsed.data, key);
  }

  @Post("shops/:shopId/return-packages/listings/batch")
  batchCreatePackageListings(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Body() body: unknown
  ): Promise<BatchCreatePackageListingsResult> {
    const parsed = batchCreatePackageListingsSchema.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid package batch");
    return this.inventory.batchCreatePackageListings(actor.id, shopId, parsed.data.packageIds);
  }

  @Get("admin/listings/reviews")
  listPendingReviews(@CurrentActor() actor: Actor): Promise<Listing[]> {
    return this.inventory.listPendingListingReviews(actor);
  }

  @Post("admin/listings/:listingId/decision")
  decideListingReview(
    @CurrentActor() actor: Actor,
    @Param("listingId") listingId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key: string
  ): Promise<Listing> {
    const parsed = listingReviewDecisionSchema.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid listing review decision");
    return this.inventory.decideListingReview(actor, listingId, parsed.data, key);
  }

  @Get("shops/:shopId/listings")
  listShopListings(@CurrentActor() actor: Actor, @Param("shopId") shopId: string): Promise<Listing[]> {
    return this.inventory.listShopListings(actor.id, shopId);
  }

  @Get("shops/:shopId/return-packages")
  listSellerInventoryPackages(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string
  ): Promise<SellerInventoryPackage[]> {
    return this.inventory.listSellerInventoryPackages(actor.id, shopId);
  }

  @Patch("shops/:shopId/listings/:listingId")
  updateDraft(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Param("listingId") listingId: string,
    @Body() body: unknown
  ): Promise<Listing> {
    const parsed = updateListingDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", 422, parsed.error.issues[0]?.message ?? "Invalid listing");
    }
    return this.inventory.updateDraft(actor.id, shopId, listingId, parsed.data);
  }

  @Post("shops/:shopId/listings/:listingId/images/init")
  createImageUploadIntent(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Param("listingId") listingId: string,
    @Body() body: unknown
  ): Promise<CatalogImageUploadIntent> {
    const parsed = createCatalogImageUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", 422, parsed.error.issues[0]?.message ?? "Invalid catalog image");
    }
    return this.inventory.createImageUploadIntent(actor.id, shopId, listingId, parsed.data);
  }

  @Post("shops/:shopId/listings/:listingId/images/complete")
  completeImageUpload(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Param("listingId") listingId: string,
    @Body() body: unknown
  ): Promise<Listing> {
    const parsed = completeCatalogImageUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", 422, parsed.error.issues[0]?.message ?? "Invalid catalog image");
    }
    return this.inventory.completeImageUpload(actor.id, shopId, listingId, parsed.data.key);
  }

  @Post("shops/:shopId/listings/:listingId/publish")
  publish(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Param("listingId") listingId: string
  ): Promise<PublishListingResult> {
    return this.inventory.publish(actor.id, shopId, listingId);
  }

  @Public()
  @Get("shops/:shopId")
  getPublicShop(@Param("shopId") shopId: string): Promise<PublicShop> {
    return this.inventory.getPublicShop(shopId);
  }

  @Public()
  @Get("shops/:shopId/reviews")
  listShopReviews(@Param("shopId") shopId: string): Promise<ShopReview[]> {
    return this.inventory.listShopReviews(shopId);
  }

  @Get("shops/:shopId/reviews/mine")
  getMyShopReview(@CurrentActor() actor: Actor, @Param("shopId") shopId: string): Promise<ShopReview | null> {
    return this.inventory.getMyShopReview(actor.id, shopId);
  }

  @Get("shops/:shopId/reviews/eligibility")
  getShopReviewEligibility(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string
  ): Promise<ShopReviewEligibility> {
    return this.inventory.getShopReviewEligibility(actor.id, shopId);
  }

  @Put("shops/:shopId/reviews/mine")
  upsertShopReview(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Body() body: unknown
  ): Promise<ShopReview> {
    const parsed = upsertShopReviewSchema.safeParse(body);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", 422, parsed.error.issues[0]?.message ?? "Invalid shop review");
    }
    return this.inventory.upsertShopReview(actor.id, shopId, parsed.data);
  }

  @Public()
  @Post("shopping-assistant/suggestions")
  suggestShopping(@Body() body: unknown): Promise<ShoppingSuggestions> {
    const parsed = shoppingConversationSchema.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid shopping conversation");
    return suggestShoppingListings(parsed.data, this.inventory);
  }

  @Public()
  @Post("shopping-assistant/transcription")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: maxShoppingAudioBytes, files: 1, fields: 0 } }))
  transcribeShopping(@UploadedFile() file?: ShoppingAudioFile): Promise<{ text: string }> {
    return transcribeShoppingAudio(file);
  }

  @Public()
  @Get("listings")
  listPublicListings(@Query() query: unknown): Promise<PublicListingPage> {
    const parsed = publicListingsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new DomainError("VALIDATION_FAILED", 422, parsed.error.issues[0]?.message ?? "Invalid catalog query");
    }
    return this.inventory.listPublicListings(parsed.data);
  }

  @Public()
  @Get("listings/:listingId")
  getPublicListing(@Param("listingId") listingId: string): Promise<PublicListing> {
    return this.inventory.getPublicListing(listingId);
  }
}
