import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { DomainError } from "@reboxe/backend";
import type { AuthenticatedRequest } from "../types/authenticated-request";

const counters = new Map<string, number>();

@Injectable()
export class RateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!new Set(["POST", "PUT", "PATCH", "DELETE"]).has(request.method)) return true;
    const route = request.route?.path ?? request.path;
    const limit = route.includes("quick-listing") ? 10
      : route.includes("checkout") || route.includes("admin") ? 20
      : route.includes("upload") || route.includes("evidence") ? 30 : 60;
    const key = `${request.actor?.id ?? request.ip ?? "unknown"}:${route}:${Math.floor(Date.now() / 60_000)}`;
    // ponytail: process-local limiter; replace with shared storage when API runs more than one replica.
    if (counters.size > 10_000) counters.clear();
    const count = (counters.get(key) ?? 0) + 1;
    counters.set(key, count);
    if (count > limit) throw new DomainError("RATE_LIMITED", 429, "Too many requests");
    return true;
  }
}
