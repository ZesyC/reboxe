import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { DomainError, type PayosPromotionTopups } from "@reboxe/backend";
import { promotionTopupSchema } from "@reboxe/shared";
import { PAYOS_TOPUPS } from "../../backend.providers";
import { CurrentActor } from "../decorators/current-actor";
import { Public } from "../decorators/public";
import type { Actor } from "../types/authenticated-request";

@Controller("v1")
export class PayosController {
  constructor(@Inject(PAYOS_TOPUPS) private readonly topups: PayosPromotionTopups) {}
  @Get("payment-options")
  options() { return { payosPromotionPayments: this.topups.configured,
    sandboxPromotions: process.env.NODE_ENV !== "production" && (process.env.COMMERCE_MODE ?? "SANDBOX") === "SANDBOX" && (process.env.PAYMENT_MODE ?? "DISABLED") === "DISABLED" }; }
  @Post("shops/:shopId/promotion-topups")
  create(@CurrentActor() actor: Actor, @Param("shopId") shopId: string, @Body() body: unknown) {
    const input = promotionTopupSchema.safeParse(body);
    if (!input.success) throw new DomainError("VALIDATION_FAILED", 422, "Top-up must be between 10,000 and 10,000,000 VND with a valid idempotency key");
    return this.topups.create(actor.id, shopId, input.data.amountVnd, input.data.idempotencyKey);
  }
  @Get("shops/:shopId/promotion-topups/:id")
  get(@CurrentActor() actor: Actor, @Param("shopId") shopId: string, @Param("id") id: string) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new DomainError("VALIDATION_FAILED", 422, "Invalid top-up ID");
    return this.topups.get(actor.id, shopId, id);
  }
  @Public()
  @Post("webhooks/payos/promotions")
  webhook(@Body() body: unknown) { return this.topups.webhook(body); }
}
