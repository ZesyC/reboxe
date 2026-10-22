import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { DomainError, type GhnQuotes } from "@reboxe/backend";
import { carrierQuoteSchema } from "@reboxe/shared";
import { GHN_QUOTES } from "../../backend.providers";
import { CurrentActor } from "../decorators/current-actor";
import type { Actor } from "../types/authenticated-request";

@Controller("v1")
export class GhnController {
  constructor(@Inject(GHN_QUOTES) private readonly ghn: GhnQuotes) {}
  @Get("shipping/ghn/provinces")
  provinces() { return this.ghn.locations("province"); }
  @Get("shipping/ghn/districts")
  districts(@Query("provinceId") value: string) { return this.ghn.locations("district", positiveId(value)); }
  @Get("shipping/ghn/wards")
  wards(@Query("districtId") value: string) { return this.ghn.locations("ward", positiveId(value)); }
  @Post("shops/:shopId/shipping/quote")
  quote(@CurrentActor() actor: Actor, @Param("shopId") shopId: string, @Body() body: unknown) {
    const input = carrierQuoteSchema.safeParse(body);
    if (!input.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid carrier quote request");
    return this.ghn.quote(actor.id, shopId, input.data.listingId, input.data.districtId, input.data.wardCode);
  }
}
function positiveId(value: string) {
  if (!/^\d{1,10}$/.test(value) || Number(value)<=0) throw new DomainError("VALIDATION_FAILED", 422, "Invalid carrier location ID");
  return Number(value);
}
