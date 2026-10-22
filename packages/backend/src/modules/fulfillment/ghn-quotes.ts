import type { Pool } from "pg";
import { DomainError } from "../../errors";

type Location = { id: string; name: string };
export class GhnQuotes {
  constructor(private readonly pool: Pool, private readonly token: string | undefined,
    private readonly shopMapping: Record<string, number>, private readonly production: boolean) {}
  async locations(kind: "province" | "district" | "ward", parent?: number): Promise<Location[]> {
    const data = await this.request(`/master-data/${kind}`, kind === "province" ? {} : kind === "district" ? { province_id: parent } : { district_id: parent });
    if (!Array.isArray(data)) throw new DomainError("VALIDATION_FAILED", 502, "Invalid carrier location data");
    return data.map((value) => {
      const item = value as Record<string, unknown>;
      const id = item[kind === "province" ? "ProvinceID" : kind === "district" ? "DistrictID" : "WardCode"];
      const name = item[kind === "province" ? "ProvinceName" : kind === "district" ? "DistrictName" : "WardName"];
      if (!["string", "number"].includes(typeof id) || typeof name !== "string") throw new DomainError("VALIDATION_FAILED", 502, "Invalid carrier location");
      return { id: String(id), name };
    });
  }
  async quote(actorId: string, shopId: string, listingId: string, districtId: number, wardCode: string) {
    const source = (await this.pool.query<{ weight_gram: number; price: string; dimensions: { length?: number; width?: number; height?: number } | null }>(
      `SELECT l.weight_gram,l.price,p.package_dimensions_cm AS dimensions FROM listings l
       LEFT JOIN return_packages p ON p.id=l.return_package_id
       WHERE l.id=$1 AND l.shop_id=$2 AND EXISTS(SELECT 1 FROM shop_memberships m JOIN profiles u ON u.id=m.user_id
         WHERE m.shop_id=$2 AND m.user_id=$3 AND m.status='ACTIVE' AND u.status='ACTIVE')`, [listingId, shopId, actorId])).rows[0];
    if (!source) throw new DomainError("RESOURCE_NOT_FOUND", 404, "Listing not found");
    const providerShopId = this.shopMapping[shopId];
    if (!providerShopId) throw new DomainError("VALIDATION_FAILED", 503, "Carrier pickup shop has not been configured for this seller");
    const result = await this.request("/v2/shipping-order/fee", {
      weight: source.weight_gram, service_type_id: source.weight_gram < 20_000 ? 2 : 5,
      to_district_id: districtId, to_ward_code: wardCode, insurance_value: Number(source.price),
      ...(source.dimensions ?? {})
    }, providerShopId) as { total?: unknown };
    if (!Number.isSafeInteger(result.total) || Number(result.total) < 0) throw new DomainError("VALIDATION_FAILED", 502, "Carrier returned an invalid fee");
    return { carrier: "GHN" as const, feeVnd: Number(result.total), estimated: true as const,
      environment: this.production ? "PRODUCTION" : "STAGING", quotedAt: new Date().toISOString() };
  }
  private async request(path: string, body: Record<string, unknown>, shopId?: number): Promise<unknown> {
    if (!this.token) throw new DomainError("VALIDATION_FAILED", 503, "GHN has not been configured");
    const origin = this.production ? "https://online-gateway.ghn.vn" : "https://dev-online-gateway.ghn.vn";
    try {
      const response = await fetch(`${origin}/shiip/public-api${path}`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
        headers: { "content-type": "application/json", Token: this.token, ...(shopId ? { ShopId: String(shopId) } : {}) }, body: JSON.stringify(body) });
      const result = await response.json() as { code?: number; data?: unknown };
      if (!response.ok || result.code !== 200) throw new Error("CARRIER_REQUEST_FAILED");
      return result.data;
    } catch { throw new DomainError("VALIDATION_FAILED", 502, "Carrier service is unavailable; retry later"); }
  }
}
export function ghnShopMapping(value: string | undefined): Record<string, number> {
  if (!value) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
    || !Object.values(parsed).every((id) => Number.isSafeInteger(id) && Number(id)>0)) throw new Error("GHN_SHOP_MAPPING must map REBOXE shop IDs to positive GHN shop IDs");
  return parsed as Record<string, number>;
}
