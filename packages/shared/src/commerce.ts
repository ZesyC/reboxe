import { z } from "zod";

export const checkoutInitSchema = z.object({
  items: z.array(z.object({ listingId: z.string().min(1), quantity: z.literal(1) }).strict()).min(1).max(100),
  addressId: z.string().min(1)
}).strict();
export type CheckoutInitInput = z.infer<typeof checkoutInitSchema>;
export type CheckoutQuote = { subtotalVnd: number; shippingVnd: number; totalVnd: number; mode: "SANDBOX" };

export const sandboxPaySchema = z.object({ method: z.literal("SANDBOX_COD") }).strict();
export type SandboxPayInput = z.infer<typeof sandboxPaySchema>;

export const orderStatusSchema = z.enum([
  "RESERVED", "CONFIRMED", "READY_TO_SHIP", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "COMPLETED",
  "EXPIRED", "CANCELLED_BY_SELLER", "CANCELLED_BY_PICKUP_FAILURE", "DELIVERY_FAILED"
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export type CommerceOrder = {
  id: string; buyerId: string; shopId: string; shopDisplayName: string; status: OrderStatus;
  mode: "SANDBOX"; paymentMethod: "SANDBOX_COD" | null; subtotalVnd: number; feeVnd: number; totalVnd: number;
  expiresAt: string; confirmedAt: string | null; completedAt: string | null; createdAt: string;
  item: { listingId: string; title: string; imageUrl: string | null; disclosure: "UNOPENED_UNINSPECTED"; sealStatus: string; priceVnd: number };
  timeline: Array<{ status: string; at: string }>;
};

export type SellerFinanceProjection = {
  availableVnd: number; orderLockedVnd: number; withdrawalPendingVnd: 0;
  unmatchedReserveVnd: 0; debtVnd: 0; simulated: true;
};

export type ListingPromotion = {
  id: string;
  listingId: string;
  feeVnd: number;
  startsAt: string;
  endsAt: string;
};

export type PromotionOverview = {
  creditVnd: number;
  campaigns: ListingPromotion[];
};

export const fakeCarrierEventSchema = z.object({
  eventId: z.string().min(1).max(200),
  status: z.enum(["PICKED_UP", "IN_TRANSIT", "DELIVERED", "DELIVERY_FAILED", "CANCELLED_BY_PICKUP_FAILURE"])
}).strict();
export type FakeCarrierEventInput = z.infer<typeof fakeCarrierEventSchema>;

export const processingRecordSchema = z.object({
  purpose: z.enum(["KYC", "DISPUTE_EVIDENCE", "SELLER_EVIDENCE"]),
  targetType: z.string().min(1).max(80), targetId: z.string().min(1).max(200), noticeVersion: z.string().min(1).max(80)
}).strict();
export const createDisputeSchema = z.object({ reason: z.string().trim().min(10).max(2000) }).strict();
export const createEvidenceSchema = z.object({
  processingRecordId: z.string(), fileName: z.string().min(1).max(255), sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  checksum: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export const disputeReplySchema = z.object({ body: z.string().trim().min(3).max(5000) }).strict();
export const disputeDecisionSchema = z.object({
  decision: z.enum(["BUYER_REFUND", "SELLER_WIN"]), reason: z.string().trim().min(30).max(5000),
  refundAmountVnd: z.number().int().nonnegative(), returnRequired: z.boolean()
}).strict();

export const createSupportTicketSchema = z.object({
  category: z.enum(["ORDER", "DISPUTE", "ACCOUNT", "OTHER"]), content: z.string().trim().min(10).max(5000),
  orderId: z.string().optional(), caseId: z.string().optional()
}).strict();
export const privacyRequestSchema = z.object({
  type: z.enum(["ACCESS_EXPORT", "CORRECTION", "DELETION_ANONYMIZATION"])
}).strict();
export const legalAcceptanceSchema = z.object({ version: z.string().min(1).max(80), source: z.string().min(1).max(80) }).strict();
export const supportReplySchema = z.object({
  body: z.string().trim().min(3).max(5000), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional()
}).strict();
