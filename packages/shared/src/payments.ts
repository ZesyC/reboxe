import { z } from "zod";
export const promotionTopupSchema = z.object({ amountVnd: z.number().int().min(10_000).max(10_000_000), idempotencyKey: z.string().uuid() }).strict();
export type PromotionTopup = { id: string; amountVnd: number; status: string; checkoutUrl: string | null; expiresAt: string };
