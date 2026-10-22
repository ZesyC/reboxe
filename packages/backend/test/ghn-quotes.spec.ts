import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GhnQuotes, ghnShopMapping } from "../src/modules/fulfillment/ghn-quotes";

afterEach(() => vi.unstubAllGlobals());
describe("GHN quotes", () => {
  it("uses the authorized listing weight and the seller's pickup shop", async () => {
    const pool = { query: vi.fn(async () => ({ rows: [{ weight_gram: 1500, price: "100000", dimensions: { length: 20, width: 15, height: 10 } }] })) };
    const fetcher = vi.fn(async () => Response.json({ code: 200, data: { total: 32000 } }));
    vi.stubGlobal("fetch", fetcher);
    const result = await new GhnQuotes(pool as unknown as Pool, "server-token", { seller: 123 }, false).quote("actor", "seller", "listing", 456, "789");
    expect(result).toMatchObject({ feeVnd: 32000, estimated: true, environment: "STAGING" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://dev-online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/fee");
    expect(init.headers).toMatchObject({ Token: "server-token", ShopId: "123" });
    expect(JSON.parse(init.body as string)).toMatchObject({ weight: 1500, insurance_value: 100000, to_district_id: 456, to_ward_code: "789" });
  });
  it("never contacts GHN for a listing outside the actor's shop", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const pool = { query: vi.fn(async () => ({ rows: [] })) };
    await expect(new GhnQuotes(pool as unknown as Pool, "token", {}, true).quote("actor", "shop", "other", 1, "1"))
      .rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects invalid pickup mappings and sanitizes provider errors", async () => {
    expect(() => ghnShopMapping('{"shop":-1}')).toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: 401, message: "secret-token" }, { status: 401 })));
    await expect(new GhnQuotes({} as Pool, "token", {}, false).locations("province")).rejects.not.toThrow("secret-token");
  });
});
