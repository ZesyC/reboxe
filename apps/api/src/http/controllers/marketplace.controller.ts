import { Body, Controller, Delete, Get, Inject, Param, Post } from "@nestjs/common";
import { DomainError, type MarketplaceModule } from "@reboxe/backend";
import { completeMarketplaceAuthorizationSchema, confirmMarketplaceShopSchema, connectMarketplaceSchema, marketplaceSchema } from "@reboxe/shared";
import { MARKETPLACE } from "../../backend.providers";
import { CurrentActor } from "../decorators/current-actor";
import type { Actor } from "../types/authenticated-request";

@Controller("v1/shops/:shopId/marketplaces")
export class MarketplaceController {
  constructor(@Inject(MARKETPLACE) private readonly marketplace: MarketplaceModule) {}
  @Get()
  async list(@CurrentActor() actor: Actor, @Param("shopId") shopId: string) {
    return { connections: await this.marketplace.list(actor.id, shopId), availability: this.marketplace.availability() };
  }
  @Post("authorize")
  begin(@CurrentActor() actor: Actor, @Param("shopId") shopId: string, @Body() body: unknown) {
    const input = connectMarketplaceSchema.safeParse(body);
    if (!input.success) throw new DomainError("VALIDATION_FAILED", 422, "Explicit consent to the current connection notice is required");
    return this.marketplace.begin(actor.id, shopId, input.data.platform, input.data.noticeVersion);
  }
  @Post("complete")
  complete(@CurrentActor() actor: Actor, @Param("shopId") shopId: string, @Body() body: unknown) {
    const input = completeMarketplaceAuthorizationSchema.safeParse(body);
    if (!input.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid platform authorization response");
    return this.marketplace.complete(actor.id, shopId, input.data.state, input.data.code, input.data.externalShopId);
  }
  @Post("confirm")
  confirm(@CurrentActor() actor: Actor, @Param("shopId") shopId: string, @Body() body: unknown) {
    const input = confirmMarketplaceShopSchema.safeParse(body);
    if (!input.success) throw new DomainError("VALIDATION_FAILED", 422, "Choose an authorized shop");
    return this.marketplace.confirm(actor.id, shopId, input.data.sessionId, input.data.externalShopId);
  }
  @Delete(":platform")
  disconnect(@CurrentActor() actor: Actor, @Param("shopId") shopId: string, @Param("platform") platform: string) {
    const input = marketplaceSchema.safeParse(platform);
    if (!input.success) throw new DomainError("VALIDATION_FAILED", 422, "Invalid marketplace");
    return this.marketplace.disconnect(actor.id, shopId, input.data);
  }
}
