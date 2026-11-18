import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const devEval = isDevelopment ? " 'unsafe-eval'" : "";
const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? (isDevelopment ? "http://127.0.0.1:54321" : "");
const storage = URL.parse(storageUrl);
const localCatalogImages = storage?.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(storage.hostname)
  ? ` ${storage.origin}/storage/v1/object/public/catalog-media/`
  : "";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["@reboxe/api-client", "@reboxe/shared"],
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data: blob: https:${localCatalogImages}; media-src 'self' blob:; connect-src 'self' http://127.0.0.1:* https:; script-src 'self' 'unsafe-inline'${devEval}; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'` }
    ] }];
  }
};

export default nextConfig;
