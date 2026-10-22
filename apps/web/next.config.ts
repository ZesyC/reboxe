import type { NextConfig } from "next";

const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const nextConfig: NextConfig = {
  transpilePackages: ["@reboxe/api-client", "@reboxe/shared"],
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data: https:; connect-src 'self' http://127.0.0.1:* https:; script-src 'self' 'unsafe-inline'${devEval}; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'` }
    ] }];
  }
};

export default nextConfig;
