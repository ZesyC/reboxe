import { z } from "zod";
export const carrierQuoteSchema = z.object({ listingId: z.string().min(1).max(200),
  districtId: z.number().int().positive(), wardCode: z.string().regex(/^[a-zA-Z0-9-]{1,20}$/) }).strict();
export type CarrierLocation = { id: string; name: string };
export type CarrierQuote = { carrier: "GHN"; feeVnd: number; estimated: true; environment: string; quotedAt: string };
