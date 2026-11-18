import type { Metadata } from "next";
import { SiteStatus } from "../../features/site-status";

export const metadata: Metadata = {
  title: "502 · REBOXE",
  robots: { index: false, follow: false }
};

export default function BadGatewayPage() {
  return <SiteStatus code={502} retryHref="/" />;
}
