import { afterEach, describe, expect, it, vi } from "vitest";
import { ShopeeMarketplaceProvider, TiktokMarketplaceProvider, tiktokSignature } from "../src/modules/marketplace/http-providers";

afterEach(() => vi.unstubAllGlobals());
describe("marketplace provider boundary", () => {
  it("matches the TikTok request-signing reference vector", () => {
    expect(tiktokSignature("e59af819cc", "/authorization/202309/shops", { app_key: "29a39d", timestamp: "1623812664" }))
      .toBe("b596b73e0cc6de07ac26f036364178ab16b0a907af13d43f0a0cd2345f582dc8");
  });
  it("binds Shopee state to the callback redirect", () => {
    const provider = new ShopeeMarketplaceProvider({ appKey: "123", appSecret: "secret", callbackUrl: "https://reboxe.test/seller/connections" });
    const url = new URL(provider.authorizationUrl("state-value"));
    expect(url.hostname).toBe("partner.shopeemobile.com");
    expect(new URL(url.searchParams.get("redirect")!).searchParams.get("state")).toBe("state-value");
    expect(url.searchParams.has("sign")).toBe(true);
  });
  it("fails closed when credentials or a secure callback are missing", () => {
    expect(() => new TiktokMarketplaceProvider({}).authorizationUrl("state")).toThrow();
    expect(() => new ShopeeMarketplaceProvider({ callbackUrl: "http://public.example/callback" })).toThrow();
  });
  it("never exposes provider error details or credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: 105001, message: "secret-token-in-response" }))));
    const provider = new TiktokMarketplaceProvider({ appKey: "app", appSecret: "secret", serviceId: "service", callbackUrl: "https://reboxe.test/seller/connections" });
    await expect(provider.exchange("code")).rejects.toMatchObject({ code: "MARKETPLACE_UNAVAILABLE" });
    await expect(provider.exchange("code")).rejects.not.toThrow("secret-token-in-response");
  });
  it("rejects creator tokens instead of using them as seller credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: 0, data: { user_type: 1 } })));
    const provider = new TiktokMarketplaceProvider({ appKey: "app", appSecret: "secret", serviceId: "service", callbackUrl: "https://reboxe.test/seller/connections" });
    await expect(provider.exchange("code")).rejects.toMatchObject({ code: "MARKETPLACE_AUTH_INVALID" });
  });
});
