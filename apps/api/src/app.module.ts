import { AdminKycController } from "./http/controllers/admin-kyc.controller";
import { MarketplaceController } from "./http/controllers/marketplace.controller";
import { ClaimsAiController } from "./http/controllers/claims-ai.controller";
import { EvidenceController } from "./http/controllers/evidence.controller";
import { PayosController } from "./http/controllers/payos.controller";
import { GhnController } from "./http/controllers/ghn.controller";
import { KycReviewerGuard } from "./http/guards/kyc-reviewer.guard";
import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import type { DatabaseContext } from "@reboxe/backend";
import { backendProviders, DATABASE } from "./backend.providers";
import { AccountController } from "./http/controllers/account.controller";
import { HealthController } from "./http/controllers/health.controller";
import { FinanceController } from "./http/controllers/finance.controller";
import { IdentityController } from "./http/controllers/identity.controller";
import { ListingsController } from "./http/controllers/listings.controller";
import { KycController } from "./http/controllers/kyc.controller";
import { CommerceController } from "./http/controllers/commerce.controller";
import { FulfillmentController } from "./http/controllers/fulfillment.controller";
import { ClaimsController } from "./http/controllers/claims.controller";
import { OperationsController } from "./http/controllers/operations.controller";
import { HttpExceptionFilter } from "./http/filters/http-exception.filter";
import { SupabaseJwtGuard } from "./http/guards/supabase-jwt.guard";
import { RequestContextInterceptor } from "./http/interceptors/request-context.interceptor";
import { RateLimitGuard } from "./http/guards/rate-limit.guard";

@Module({
  controllers: [GhnController, PayosController, EvidenceController, ClaimsAiController, MarketplaceController, AccountController, AdminKycController, ClaimsController, CommerceController, FinanceController, FulfillmentController, HealthController, IdentityController, KycController, ListingsController, OperationsController],
  providers: [
    ...backendProviders,
    KycReviewerGuard,
    RateLimitGuard,
    { provide: APP_GUARD, useClass: SupabaseJwtGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter }
  ]
})
export class AppModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: DatabaseContext) {}

  async onApplicationShutdown(): Promise<void> {
    await this.database.pool.end();
  }
}
