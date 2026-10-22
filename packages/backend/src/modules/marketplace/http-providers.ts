import { createHmac } from "node:crypto";
import { DomainError } from "../../errors";
import type { AuthorizedMarketplaceShop, MarketplaceCredentials, MarketplaceProvider } from "./provider";

type Config = { appKey?: string | undefined; appSecret?: string | undefined; callbackUrl?: string | undefined; serviceId?: string | undefined };
type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_PROVIDER_RESPONSE");
  return value as JsonObject;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 8192) throw new Error("INVALID_PROVIDER_FIELD");
  return value;
}
function expiry(value: unknown, relative: boolean): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("INVALID_PROVIDER_EXPIRY");
  const date = new Date((relative ? Date.now() : 0) + seconds * 1000);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error("EXPIRED_PROVIDER_TOKEN");
  return date.toISOString();
}
async function json(url: URL, init: RequestInit = {}): Promise<JsonObject> {
  try {
    const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("PROVIDER_HTTP_FAILURE");
    const data = object(await response.json());
    if ((data.error !== undefined && data.error !== "" && data.error !== 0)
      || (data.code !== undefined && data.code !== 0)) throw new Error("PROVIDER_BUSINESS_FAILURE");
    return data;
  } catch {
    throw new DomainError("MARKETPLACE_UNAVAILABLE", 502, "Platform request failed; retry or reconnect your shop");
  }
}
export function shopeeSignature(secret: string, partnerId: string, path: string, timestamp: string, accessToken = "", shopId = ""): string {
  return createHmac("sha256", secret).update(`${partnerId}${path}${timestamp}${accessToken}${shopId}`).digest("hex");
}
export function tiktokSignature(secret: string, path: string, params: Record<string, string>, body = ""): string {
  const query = Object.keys(params).filter((key) => !["sign", "access_token"].includes(key)).sort().map((key) => key + params[key]).join("");
  return createHmac("sha256", secret).update(`${secret}${path}${query}${body}${secret}`).digest("hex");
}
export class ShopeeMarketplaceProvider implements MarketplaceProvider {
  readonly platform = "SHOPEE" as const;
  readonly configured: boolean;
  constructor(private readonly config: Config) {
    this.configured = Boolean(config.appKey && config.appSecret && config.callbackUrl);
    if (config.callbackUrl) validateCallback(config.callbackUrl);
    if (config.appKey && !/^\d+$/.test(config.appKey)) throw new Error("SHOPEE_PARTNER_ID must be numeric");
  }
  authorizationUrl(state: string): string {
    this.requireConfigured();
    const callback = new URL(this.config.callbackUrl!);
    callback.searchParams.set("state", state);
    const url = this.url("/api/v2/shop/auth_partner");
    url.searchParams.set("redirect", callback.toString());
    return url.toString();
  }
  async exchange(code: string, externalShopId?: string): Promise<AuthorizedMarketplaceShop[]> {
    this.requireConfigured();
    if (!externalShopId || !/^\d+$/.test(externalShopId) || !Number.isSafeInteger(Number(externalShopId))) {
      throw new DomainError("MARKETPLACE_AUTH_INVALID", 422, "Shopee authorization did not identify a valid shop");
    }
    const result = await json(this.url("/api/v2/auth/token/get"), { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, partner_id: Number(this.config.appKey), shop_id: Number(externalShopId) }) });
    const credentials = this.credentials(result);
    const envelope = await json(this.url("/api/v2/shop/get_shop_info", credentials.accessToken, externalShopId));
    const info = object(envelope.response ?? envelope);
    return [{ id: externalShopId, name: text(info.shop_name), credentials }];
  }
  async refresh(shop: AuthorizedMarketplaceShop): Promise<MarketplaceCredentials> {
    const result = await json(this.url("/api/v2/auth/access_token/get"), { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: shop.credentials.refreshToken, partner_id: Number(this.config.appKey), shop_id: Number(shop.id) }) });
    return this.credentials(result);
  }
  private credentials(data: JsonObject): MarketplaceCredentials {
    return { accessToken: text(data.access_token), refreshToken: text(data.refresh_token), expiresAt: expiry(data.expire_in, true),
      refreshExpiresAt: expiry(Number(process.env.SHOPEE_REFRESH_TOKEN_TTL_SECONDS ?? 30 * 86400), true) };
  }
  private url(path: string, token = "", shopId = "") {
    this.requireConfigured();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const url = new URL(path, "https://partner.shopeemobile.com");
    url.searchParams.set("partner_id", this.config.appKey!);
    url.searchParams.set("timestamp", timestamp);
    if (token) url.searchParams.set("access_token", token);
    if (shopId) url.searchParams.set("shop_id", shopId);
    url.searchParams.set("sign", shopeeSignature(this.config.appSecret!, this.config.appKey!, path, timestamp, token, shopId));
    return url;
  }
  private requireConfigured() { if (!this.configured) throw new DomainError("MARKETPLACE_NOT_CONFIGURED", 503, "Shopee connection is not configured"); }
}
export class TiktokMarketplaceProvider implements MarketplaceProvider {
  readonly platform = "TIKTOK" as const;
  readonly configured: boolean;
  constructor(private readonly config: Config) {
    this.configured = Boolean(config.appKey && config.appSecret && config.serviceId && config.callbackUrl);
    if (config.callbackUrl) validateCallback(config.callbackUrl);
  }
  authorizationUrl(state: string): string {
    this.requireConfigured();
    const url = new URL("https://services.tiktokshop.com/open/authorize");
    url.searchParams.set("service_id", this.config.serviceId!);
    url.searchParams.set("state", state);
    return url.toString();
  }
  async exchange(code: string): Promise<AuthorizedMarketplaceShop[]> {
    this.requireConfigured();
    const token = await this.token("get", { auth_code: code, grant_type: "authorized_code" });
    const result = await json(this.businessUrl("/authorization/202309/shops"), { headers: { "x-tts-access-token": token.accessToken, "content-type": "application/json" } });
    const shops = object(result.data).shops;
    if (!Array.isArray(shops)) throw new Error("INVALID_AUTHORIZED_SHOPS");
    return shops.map((value) => {
      const shop = object(value);
      return { id: text(shop.id), name: text(shop.name), cipher: text(shop.cipher), credentials: token };
    });
  }
  async refresh(shop: AuthorizedMarketplaceShop): Promise<MarketplaceCredentials> {
    return this.token("refresh", { refresh_token: shop.credentials.refreshToken, grant_type: "refresh_token" });
  }
  private async token(operation: string, params: Record<string, string>): Promise<MarketplaceCredentials> {
    const url = new URL(`https://auth.tiktok-shops.com/api/v2/token/${operation}`);
    url.search = new URLSearchParams({ app_key: this.config.appKey!, app_secret: this.config.appSecret!, ...params }).toString();
    const data = object((await json(url)).data);
    if (data.user_type !== 0) throw new DomainError("MARKETPLACE_AUTH_INVALID", 422, "A TikTok Shop seller authorization is required");
    return { accessToken: text(data.access_token), refreshToken: text(data.refresh_token),
      expiresAt: expiry(data.access_token_expire_in, false), refreshExpiresAt: expiry(data.refresh_token_expire_in, false) };
  }
  private businessUrl(path: string) {
    const params = { app_key: this.config.appKey!, timestamp: String(Math.floor(Date.now() / 1000)) };
    const url = new URL(path, "https://open-api.tiktokglobalshop.com");
    url.search = new URLSearchParams({ ...params, sign: tiktokSignature(this.config.appSecret!, path, params) }).toString();
    return url;
  }
  private requireConfigured() { if (!this.configured) throw new DomainError("MARKETPLACE_NOT_CONFIGURED", 503, "TikTok Shop connection is not configured"); }
}
function validateCallback(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Marketplace callback must use HTTPS (except localhost)");
  }
  if (url.username || url.password || url.hash || url.search) throw new Error("Marketplace callback must not contain credentials, query or fragment");
}
export function createMarketplaceProviders(): MarketplaceProvider[] {
  return [new ShopeeMarketplaceProvider({ appKey: process.env.SHOPEE_PARTNER_ID, appSecret: process.env.SHOPEE_PARTNER_KEY,
    callbackUrl: process.env.MARKETPLACE_CALLBACK_URL }),
  new TiktokMarketplaceProvider({ appKey: process.env.TIKTOK_APP_KEY, appSecret: process.env.TIKTOK_APP_SECRET,
    serviceId: process.env.TIKTOK_SERVICE_ID, callbackUrl: process.env.MARKETPLACE_CALLBACK_URL })];
}
