import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { DomainError, type CommerceModule } from "@reboxe/backend";
import { checkoutInitSchema, sandboxPaySchema } from "@reboxe/shared";
import { COMMERCE } from "../../backend.providers";
import { CurrentActor } from "../decorators/current-actor";
import type { Actor } from "../types/authenticated-request";

@Controller("v1")
export class CommerceController {
  constructor(@Inject(COMMERCE) private readonly commerce: CommerceModule) {}

  @Post("checkout/quote")
  quote(@CurrentActor() actor: Actor, @Body() body: unknown) {
    const parsed = checkoutInitSchema.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid checkout quote");
    return this.commerce.quoteCheckout(actor.id, parsed.data);
  }

  @Post("checkout/init")
  init(@CurrentActor() actor: Actor, @Body() body: unknown, @Headers("idempotency-key") key: string) {
    const parsed = checkoutInitSchema.safeParse(body);
    if (!parsed.success) throw new DomainError("VALIDATION_FAILED", 422, parsed.error.issues[0]?.message ?? "Invalid checkout");
    return this.commerce.initCheckout(actor.id, parsed.data, key);
  }

  @Post("checkout/:orderId/pay")
  pay(@CurrentActor() actor: Actor, @Param("orderId") orderId: string, @Body() body: unknown, @Headers("idempotency-key") key: string) {
    const parsed = sandboxPaySchema.safeParse(body);
    if (!parsed.success) throw new DomainError("PAYMENT_METHOD_DISABLED", 409, "Only SANDBOX_COD is available in sandbox");
    return this.commerce.payCheckout(actor.id, orderId, key);
  }

  @Get("orders")
  listOrders(@CurrentActor() actor: Actor) { return this.commerce.listBuyerOrders(actor.id); }

  @Get("orders/:orderId")
  getOrder(@CurrentActor() actor: Actor, @Param("orderId") orderId: string) { return this.commerce.getOrder(actor.id, orderId); }

  @Get("shops/:shopId/orders")
  listSellerOrders(@CurrentActor() actor: Actor, @Param("shopId") shopId: string) {
    return this.commerce.listSellerOrders(actor.id, shopId);
  }

  @Get("shops/:shopId/finance/projection")
  finance(@CurrentActor() actor: Actor, @Param("shopId") shopId: string) {
    return this.commerce.financeProjection(actor.id, shopId);
  }

  @Get("shops/:shopId/promotions")
  promotions(@CurrentActor() actor: Actor, @Param("shopId") shopId: string) {
    return this.commerce.getPromotionOverview(actor.id, shopId);
  }

  @Post("shops/:shopId/promotions/credit")
  seedPromotionCredit(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Headers("idempotency-key") key: string
  ) {
    return this.commerce.seedPromotionCredit(actor.id, shopId, key);
  }

  @Post("shops/:shopId/listings/:listingId/promotions")
  sponsorListing(
    @CurrentActor() actor: Actor,
    @Param("shopId") shopId: string,
    @Param("listingId") listingId: string,
    @Headers("idempotency-key") key: string
  ) {
    return this.commerce.sponsorListing(actor.id, shopId, listingId, key);
  }
}
