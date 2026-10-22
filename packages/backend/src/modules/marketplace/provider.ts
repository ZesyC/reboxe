import type { Marketplace } from "@reboxe/shared";

export type MarketplaceCredentials = {
  accessToken: string; refreshToken: string; expiresAt: string; refreshExpiresAt: string;
};
export type AuthorizedMarketplaceShop = {
  id: string; name: string; cipher?: string; credentials: MarketplaceCredentials;
};
export interface MarketplaceProvider {
  readonly platform: Marketplace;
  readonly configured: boolean;
  authorizationUrl(state: string): string;
  exchange(code: string, externalShopId?: string): Promise<AuthorizedMarketplaceShop[]>;
  refresh(shop: AuthorizedMarketplaceShop): Promise<MarketplaceCredentials>;
}
