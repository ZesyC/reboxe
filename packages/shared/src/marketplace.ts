import { z } from "zod";

export const marketplaceSchema = z.enum(["SHOPEE", "TIKTOK"]);
export type Marketplace = z.infer<typeof marketplaceSchema>;
export const marketplaceNoticeVersion = "2026-10-20";
export const connectMarketplaceSchema = z.object({
  platform: marketplaceSchema,
  noticeVersion: z.literal(marketplaceNoticeVersion),
  consent: z.literal(true)
}).strict();
export const completeMarketplaceAuthorizationSchema = z.object({
  state: z.string().regex(/^[a-f0-9]{64}$/),
  code: z.string().min(1).max(2048),
  externalShopId: z.string().max(100).optional()
}).strict();
export const confirmMarketplaceShopSchema = z.object({
  sessionId: z.string().uuid(), externalShopId: z.string().min(1).max(100)
}).strict();
export type MarketplaceConnection = {
  id: string; platform: Marketplace; externalShopId: string; shopName: string;
  status: "CONNECTED" | "REAUTH_REQUIRED" | "DISCONNECTED";
  connectedAt: string; expiresAt: string; lastSyncedAt: string | null;
};
export type MarketplaceShopChoice = { id: string; name: string };
export type MarketplaceAvailability = { platform: Marketplace; configured: boolean };
