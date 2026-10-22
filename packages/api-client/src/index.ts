import type {
  AccountAddress,
  AccountPaymentOverview,
  AdminKycQueue, AdminKycDetail, KycDecisionInput, KycDecisionResult,
  ActorContext,
  CatalogImageUploadIntent,
  Category,
  ChangePasswordInput,
  CommitReturnManifestResult,
  CreateListingInput,
  CreateAccountAddressInput,
  CreateShopInput,
  ErrorResponse,
  Listing,
  NotificationPreferences,
  KycStatusResponse,
  PublicListing,
  PublicListingPage,
  PublicListingsQuery,
  PublicShop,
  ShopReview,
  ShopReviewEligibility,
  PrivacyPreferences,
  PublishListingResult,
  ReturnManifestPreview,
  SellerInventoryPackage,
  SellerFinanceSnapshot,
  SellerDocumentKind,
  PurchaseOrderSummary,
  UpdateListingDraftInput,
  UpsertShopReviewInput,
  CommerceOrder,
  CheckoutInitInput,
  PackageListingDraftResult,
  ScanReturnPackageInput,
  BatchCreatePackageListingsResult,
  SellerFinanceProjection,
  ListingPromotion,
  PromotionOverview,
  Marketplace, MarketplaceAvailability, MarketplaceConnection, MarketplaceShopChoice, CheckoutQuote,
  AiReport, EvidenceUploadInput, EvidenceUploadIntent, PromotionTopup, CarrierLocation, CarrierQuote
} from "@reboxe/shared";

export type { paths } from "./generated";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
};

export function createApiClient(options: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await options.getAccessToken?.();
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    headers.set("x-request-id", crypto.randomUUID());
    if (init.body && !(init.body instanceof FormData)) {
      headers.set("content-type", "application/json");
    }
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${options.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ErrorResponse | null;
      throw new ApiClientError(
        response.status,
        body?.error.code ?? "HTTP_ERROR",
        body?.error.message ?? `Request failed with status ${response.status}`,
        body?.error.requestId
      );
    }
    return (await response.json()) as T;
  }

  return {
    getCarrierLocations: (kind: "provinces" | "districts" | "wards", parentId?: string) => request<CarrierLocation[]>(
      `/v1/shipping/ghn/${kind}${parentId ? `?${kind === "districts" ? "provinceId" : "districtId"}=${encodeURIComponent(parentId)}` : ""}`),
    quoteShipping: (shopId: string, listingId: string, districtId: number, wardCode: string) => request<CarrierQuote>(
      `/v1/shops/${encodeURIComponent(shopId)}/shipping/quote`, { method: "POST", body: JSON.stringify({ listingId, districtId, wardCode }) }),
    getPaymentOptions: () => request<{ payosPromotionPayments: boolean; sandboxPromotions: boolean }>("/v1/payment-options"),
    createPromotionTopup: (shopId: string, amountVnd: number, idempotencyKey: string) => request<PromotionTopup>(
      `/v1/shops/${encodeURIComponent(shopId)}/promotion-topups`, { method: "POST", body: JSON.stringify({ amountVnd, idempotencyKey }) }),
    getPromotionTopup: (shopId: string, id: string) => request<PromotionTopup>(`/v1/shops/${encodeURIComponent(shopId)}/promotion-topups/${encodeURIComponent(id)}`, { cache: "no-store" }),
    uploadEvidence: async (caseId: string, processingRecordId: string, file: File) => {
      const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
        .map((value) => value.toString(16).padStart(2, "0")).join("");
      const input = { processingRecordId, mimeType: file.type, sizeBytes: file.size, checksum } as EvidenceUploadInput;
      const intent = await request<EvidenceUploadIntent>(`/v1/disputes/${encodeURIComponent(caseId)}/evidence-uploads`, { method: "POST", body: JSON.stringify(input) });
      const response = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.headers, body: file });
      if (!response.ok) throw new ApiClientError(response.status, "VALIDATION_FAILED", "Không thể tải file vào kho bằng chứng.");
      return { uploadId: intent.id };
    },
    completeEvidenceUpload: (caseId: string, uploadId: string) => request<{ id: string; status: "READY" }>(
      `/v1/disputes/${encodeURIComponent(caseId)}/evidence-uploads/${encodeURIComponent(uploadId)}/complete`, { method: "POST" }),
    listAiReports: (caseId: string) => request<Array<{ id: string; evidenceId: string; report: AiReport; createdAt: string }>>(
      `/v1/admin/disputes/${encodeURIComponent(caseId)}/ai-reports`, { cache: "no-store" }),
    listAiEvidence: (caseId: string) => request<Array<{ id: string; stored: boolean; mimeType: string | null }>>(
      `/v1/admin/disputes/${encodeURIComponent(caseId)}/ai-reports/evidences`, { cache: "no-store" }),
    analyzeStoredEvidence: (caseId: string, evidenceId: string) => request<Array<{ id: string; evidenceId: string; report: AiReport; createdAt: string }>>(
      `/v1/admin/disputes/${encodeURIComponent(caseId)}/ai-reports/${encodeURIComponent(evidenceId)}/stored`, { method: "POST" }),
    analyzeEvidence: (caseId: string, evidenceId: string, file: File) => {
      const form = new FormData(); form.set("file", file);
      return request<Array<{ id: string; evidenceId: string; report: AiReport; createdAt: string }>>(
        `/v1/admin/disputes/${encodeURIComponent(caseId)}/ai-reports/${encodeURIComponent(evidenceId)}`, { method: "POST", body: form });
    },
    quoteCheckout: (input: CheckoutInitInput) => request<CheckoutQuote>("/v1/checkout/quote", { method: "POST", body: JSON.stringify(input) }),
    listMarketplaceConnections: (shopId: string) => request<{ connections: MarketplaceConnection[]; availability: MarketplaceAvailability[] }>(
      `/v1/shops/${encodeURIComponent(shopId)}/marketplaces`, { cache: "no-store" }),
    beginMarketplaceAuthorization: (shopId: string, platform: Marketplace, noticeVersion: string) => request<{ authorizationUrl: string }>(
      `/v1/shops/${encodeURIComponent(shopId)}/marketplaces/authorize`, {
        method: "POST", body: JSON.stringify({ platform, consent: true, noticeVersion })
      }),
    completeMarketplaceAuthorization: (shopId: string, input: { state: string; code: string; externalShopId?: string }) =>
      request<{ sessionId: string; shops: MarketplaceShopChoice[] }>(`/v1/shops/${encodeURIComponent(shopId)}/marketplaces/complete`, {
        method: "POST", body: JSON.stringify(input)
      }),
    confirmMarketplaceShop: (shopId: string, sessionId: string, externalShopId: string) => request<MarketplaceConnection[]>(
      `/v1/shops/${encodeURIComponent(shopId)}/marketplaces/confirm`, { method: "POST", body: JSON.stringify({ sessionId, externalShopId }) }),
    disconnectMarketplace: (shopId: string, platform: Marketplace) => request<{ disconnected: true }>(
      `/v1/shops/${encodeURIComponent(shopId)}/marketplaces/${platform}`, { method: "DELETE" }),
    listAccountAddresses: () => request<AccountAddress[]>("/v1/account/addresses", { cache: "no-store" }),
    createAccountAddress: (input: CreateAccountAddressInput) => request<AccountAddress>("/v1/account/addresses", {
      method: "POST", body: JSON.stringify(input)
    }),
    deleteAccountAddress: (id: string) => request<{ deleted: true }>(`/v1/account/addresses/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }),
    getNotificationPreferences: () => request<NotificationPreferences>("/v1/account/notifications", { cache: "no-store" }),
    updateNotificationPreferences: (input: NotificationPreferences) => request<NotificationPreferences>("/v1/account/notifications", {
      method: "PUT", body: JSON.stringify(input)
    }),
    getPrivacyPreferences: () => request<PrivacyPreferences>("/v1/account/privacy", { cache: "no-store" }),
    updatePrivacyPreferences: (input: PrivacyPreferences) => request<PrivacyPreferences>("/v1/account/privacy", {
      method: "PUT", body: JSON.stringify(input)
    }),
    getAccountPaymentOverview: () => request<AccountPaymentOverview>("/v1/account/payment-methods", { cache: "no-store" }),
    listPurchaseOrders: () => request<PurchaseOrderSummary[]>("/v1/account/orders", { cache: "no-store" }),
    changePassword: (input: ChangePasswordInput) => request<{ changed: true }>("/v1/account/change-password", {
      method: "POST", body: JSON.stringify(input)
    }),
    listCategories: () => request<Category[]>("/v1/categories", { cache: "no-store" }),
    getMe: () => request<ActorContext>("/v1/me", { cache: "no-store" }),
    getSellerFinance: (shopId: string) => request<SellerFinanceSnapshot>(
      `/v1/shops/${encodeURIComponent(shopId)}/finance`, { cache: "no-store" }),
    listKycReviews: (cursor?: string) => request<AdminKycQueue>(
      `/v1/admin/kyc?status=MANUAL_REVIEW${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" }),
    getKycReview: (id: string) => request<AdminKycDetail>(`/v1/admin/kyc/${encodeURIComponent(id)}`, { cache: "no-store" }),
    decideKycReview: (id: string, input: KycDecisionInput, key: string) => request<KycDecisionResult>(
      `/v1/admin/kyc/${encodeURIComponent(id)}/decision`, {
        method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(input)
      }),
    createShop: (input: CreateShopInput) =>
      request<{ shopId: string }>("/v1/shops", { method: "POST", body: JSON.stringify(input) }),
    startKyc: (shopId: string) =>
      request<KycStatusResponse & { id: string }>("/v1/kyc/start", {
        method: "POST", body: JSON.stringify({ shopId })
      }),
    submitKycDocument: (side: "front" | "back", kycId: string, objectKey: string) =>
      request<KycStatusResponse>(`/v1/kyc/document/${side}`, {
        method: "POST", body: JSON.stringify({ kycId, objectKey })
      }),
    submitKycSelfie: (kycId: string, objectKey: string) =>
      request<KycStatusResponse>("/v1/kyc/selfie", {
        method: "POST", body: JSON.stringify({ kycId, objectKey })
      }),
    submitKycTax: (kycId: string, taxCode: string) =>
      request<KycStatusResponse>("/v1/kyc/tax", {
        method: "POST", body: JSON.stringify({ kycId, taxCode })
      }),
    submitKycBank: (kycId: string, bankCode: string, accountNumber: string) =>
      request<KycStatusResponse>("/v1/kyc/bank", {
        method: "POST", body: JSON.stringify({ kycId, bankCode, accountNumber })
      }),
    getKycStatus: (kycId: string) =>
      request<KycStatusResponse>(`/v1/kyc/${encodeURIComponent(kycId)}/status`, { cache: "no-store" }),
    uploadSellerDocument: async (kind: SellerDocumentKind, file: Blob) => {
      const intent = await request<CatalogImageUploadIntent>("/v1/seller-onboarding/uploads", {
        method: "POST",
        body: JSON.stringify({ kind, mimeType: file.type, sizeBytes: file.size })
      });
      const upload = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.headers, body: file });
      if (!upload.ok) {
        throw new ApiClientError(upload.status, "SELLER_DOCUMENT_UPLOAD_FAILED", "Seller document upload failed");
      }
      return intent.key;
    },
    listShopListings: (shopId: string) => request<Listing[]>(`/v1/shops/${encodeURIComponent(shopId)}/listings`),
    listSellerInventoryPackages: (shopId: string) => request<SellerInventoryPackage[]>(
      `/v1/shops/${encodeURIComponent(shopId)}/return-packages`, { cache: "no-store" }),
    scanReturnPackage: (shopId: string, input: ScanReturnPackageInput, key: string) =>
      request<PackageListingDraftResult>(`/v1/shops/${encodeURIComponent(shopId)}/return-packages/scan`, {
        method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(input)
      }),
    batchCreatePackageListings: (shopId: string, packageIds: string[]) =>
      request<BatchCreatePackageListingsResult>(`/v1/shops/${encodeURIComponent(shopId)}/return-packages/listings/batch`, {
        method: "POST", body: JSON.stringify({ packageIds })
      }),
    createListing: (shopId: string, input: CreateListingInput) =>
      request<Listing>(`/v1/shops/${encodeURIComponent(shopId)}/listings`, {
        method: "POST",
        body: JSON.stringify(input)
      }),
    previewReturnManifest: (shopId: string, file: File) => {
      const body = new FormData();
      body.set("file", file);
      return request<ReturnManifestPreview>(
        `/v1/shops/${encodeURIComponent(shopId)}/return-imports/preview`,
        { method: "POST", body }
      );
    },
    commitReturnManifest: (shopId: string, batchId: string, idempotencyKey: string) =>
      request<CommitReturnManifestResult>(
        `/v1/shops/${encodeURIComponent(shopId)}/return-imports/${encodeURIComponent(batchId)}/commit`,
        { method: "POST", body: JSON.stringify({ idempotencyKey }) }
      ),
    updateListingDraft: (shopId: string, listingId: string, input: UpdateListingDraftInput) =>
      request<Listing>(
        `/v1/shops/${encodeURIComponent(shopId)}/listings/${encodeURIComponent(listingId)}`,
        { method: "PATCH", body: JSON.stringify(input) }
      ),
    createCatalogImageUploadIntent: (shopId: string, listingId: string, file: Blob) =>
      request<CatalogImageUploadIntent>(
        `/v1/shops/${encodeURIComponent(shopId)}/listings/${encodeURIComponent(listingId)}/images/init`,
        { method: "POST", body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }) }
      ),
    completeCatalogImageUpload: (shopId: string, listingId: string, key: string) =>
      request<Listing>(
        `/v1/shops/${encodeURIComponent(shopId)}/listings/${encodeURIComponent(listingId)}/images/complete`,
        { method: "POST", body: JSON.stringify({ key }) }
      ),
    uploadCatalogImage: async (shopId: string, listingId: string, file: Blob) => {
      const path = `/v1/shops/${encodeURIComponent(shopId)}/listings/${encodeURIComponent(listingId)}`;
      const intent = await request<CatalogImageUploadIntent>(`${path}/images/init`, {
        method: "POST",
        body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size })
      });
      const upload = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.headers, body: file });
      if (!upload.ok) {
        throw new ApiClientError(upload.status, "CATALOG_UPLOAD_FAILED", "Catalog image upload failed");
      }
      return request<Listing>(`${path}/images/complete`, {
        method: "POST",
        body: JSON.stringify({ key: intent.key })
      });
    },
    publishListing: (shopId: string, listingId: string) =>
      request<PublishListingResult>(
        `/v1/shops/${encodeURIComponent(shopId)}/listings/${encodeURIComponent(listingId)}/publish`,
        { method: "POST" }
      ),
    getPublicShop: (shopId: string) =>
      request<PublicShop>(`/v1/shops/${encodeURIComponent(shopId)}`, { cache: "no-store" }),
    listShopReviews: (shopId: string) =>
      request<ShopReview[]>(`/v1/shops/${encodeURIComponent(shopId)}/reviews`, { cache: "no-store" }),
    getMyShopReview: (shopId: string) =>
      request<ShopReview | null>(`/v1/shops/${encodeURIComponent(shopId)}/reviews/mine`, { cache: "no-store" }),
    getShopReviewEligibility: (shopId: string) =>
      request<ShopReviewEligibility>(`/v1/shops/${encodeURIComponent(shopId)}/reviews/eligibility`, { cache: "no-store" }),
    upsertShopReview: (shopId: string, input: UpsertShopReviewInput) =>
      request<ShopReview>(`/v1/shops/${encodeURIComponent(shopId)}/reviews/mine`, {
        method: "PUT", body: JSON.stringify(input)
      }),
    listPublicListings: (query: Partial<PublicListingsQuery> = {}) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value) search.set(key, value);
      }
      const suffix = search.size ? `?${search}` : "";
      return request<PublicListingPage>(`/v1/listings${suffix}`, { cache: "no-store" });
    },
    getPublicListing: (listingId: string) => request<PublicListing>(`/v1/listings/${encodeURIComponent(listingId)}`),
    initCheckout: (input: CheckoutInitInput, key: string) => request<CommerceOrder>("/v1/checkout/init", {
      method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(input)
    }),
    payCheckout: (orderId: string, key: string) => request<CommerceOrder>(`/v1/checkout/${encodeURIComponent(orderId)}/pay`, {
      method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ method: "SANDBOX_COD" })
    }),
    listCommerceOrders: () => request<CommerceOrder[]>("/v1/orders", { cache: "no-store" }),
    getCommerceOrder: (orderId: string) => request<CommerceOrder>(`/v1/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" }),
    listSellerOrders: (shopId: string) => request<CommerceOrder[]>(`/v1/shops/${encodeURIComponent(shopId)}/orders`, { cache: "no-store" }),
    listSellerDisputes: (shopId: string) => request<Array<{ id: string; orderId: string; productTitle: string; status: string; reason: string; createdAt: string }>>(`/v1/shops/${encodeURIComponent(shopId)}/disputes`, { cache: "no-store" }),
    getSellerFinanceProjection: (shopId: string) => request<SellerFinanceProjection>(`/v1/shops/${encodeURIComponent(shopId)}/finance/projection`, { cache: "no-store" }),
    getPromotionOverview: (shopId: string) => request<PromotionOverview>(`/v1/shops/${encodeURIComponent(shopId)}/promotions`, { cache: "no-store" }),
    seedPromotionCredit: (shopId: string, key: string) => request<PromotionOverview>(`/v1/shops/${encodeURIComponent(shopId)}/promotions/credit`, {
      method: "POST", headers: { "Idempotency-Key": key }
    }),
    sponsorListing: (shopId: string, listingId: string, key: string) => request<ListingPromotion>(
      `/v1/shops/${encodeURIComponent(shopId)}/listings/${encodeURIComponent(listingId)}/promotions`, {
        method: "POST", headers: { "Idempotency-Key": key }
      }),
    createFakeShipment: (shopId: string, orderId: string) => request<{ id: string; trackingCode: string; status: string; label: string }>(`/v1/shops/${encodeURIComponent(shopId)}/orders/${encodeURIComponent(orderId)}/shipment`, { method: "POST" }),
    openDispute: (orderId: string, reason: string) => request<{ id: string; status: string }>(`/v1/orders/${encodeURIComponent(orderId)}/disputes`, { method: "POST", body: JSON.stringify({ reason }) }),
    createProcessingRecord: (input: { purpose: "DISPUTE_EVIDENCE" | "SELLER_EVIDENCE"; targetType: string; targetId: string; noticeVersion: string }) =>
      request<{ id: string }>("/v1/processing-records", { method: "POST", body: JSON.stringify(input) }),
    addDisputeEvidence: (caseId: string, input: { processingRecordId: string; fileName: string; sizeBytes: number; checksum: string }) =>
      request<{ id: string; provider: string }>(`/v1/disputes/${encodeURIComponent(caseId)}/evidence`, { method: "POST", body: JSON.stringify(input) }),
    listDisputeEvidence: (caseId: string) => request<Array<{ id: string; view: string; objectKey: string; objectVersion: string; checksum: string }>>(
      `/v1/disputes/${encodeURIComponent(caseId)}/evidence`, { cache: "no-store" }),
    replyDispute: (caseId: string, body: string) => request<{ accepted: true }>(`/v1/disputes/${encodeURIComponent(caseId)}/replies`, {
      method: "POST", body: JSON.stringify({ body })
    }),
    appealDispute: (caseId: string, body: string) => request<{ id: string; status: string }>(`/v1/disputes/${encodeURIComponent(caseId)}/appeal`, {
      method: "POST", body: JSON.stringify({ body })
    }),
    listPendingListingReviews: () => request<Listing[]>("/v1/admin/listings/reviews", { cache: "no-store" }),
    decideListingReview: (listingId: string, decision: "APPROVE" | "REJECT", reason: string) => request<Listing>(`/v1/admin/listings/${encodeURIComponent(listingId)}/decision`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ decision, reason }) }),
    listAdminDisputes: () => request<Array<{ id: string; orderId: string; status: string; reason: string; buyerPayableVnd: number }>>("/v1/admin/disputes", { cache: "no-store" }),
    decideDispute: (caseId: string, input: { decision: "BUYER_REFUND" | "SELLER_WIN"; reason: string; refundAmountVnd: number; returnRequired: boolean }) =>
      request<{ id: string; status: string; payoutCompleted: false }>(`/v1/admin/disputes/${encodeURIComponent(caseId)}/decision`, {
        method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(input)
      }),
    getLegalArtifact: (slug: string) => request<{ title: string; body: string; version: string; effectiveAt: string }>(`/v1/legal/${encodeURIComponent(slug)}`, { cache: "no-store" }),
    acceptLegalArtifact: (slug: string, version: string, source: string) => request<{ acceptedAt: string }>(`/v1/legal/${encodeURIComponent(slug)}/accept`, {
      method: "POST", body: JSON.stringify({ version, source })
    }),
    listNotifications: () => request<Array<{ id: string; kind: string; title: string; body: string; readAt: string | null; createdAt: string }>>("/v1/notifications", { cache: "no-store" }),
    markNotificationRead: (id: string) => request<{ id: string; read: true }>(`/v1/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }),
    createSupportTicket: (input: { category: "ORDER" | "DISPUTE" | "ACCOUNT" | "OTHER"; content: string; orderId?: string; caseId?: string }) =>
      request<{ id: string; status: string }>("/v1/support/tickets", { method: "POST", body: JSON.stringify(input) }),
    listSupportQueue: () => request<Array<{ id: string; category: string; status: string; created_at: string }>>("/v1/admin/support/tickets", { cache: "no-store" }),
    replySupportTicket: (id: string, body: string, status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED") =>
      request<{ id: string; status: string }>(`/v1/admin/support/tickets/${encodeURIComponent(id)}/reply`, { method: "POST", body: JSON.stringify({ body, status }) }),
    createPrivacyRequest: (type: "ACCESS_EXPORT" | "CORRECTION" | "DELETION_ANONYMIZATION") =>
      request<{ id: string; status: string; receipt: Record<string, unknown> }>("/v1/privacy/requests", { method: "POST", body: JSON.stringify({ type }) })
  };
}
