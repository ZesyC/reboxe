import Link from "next/link";
import { notFound } from "next/navigation";
import { SellerShell } from "../../../features/seller-shell";
import { SellerWorkbench } from "../../../features/seller-workbench/seller-workbench";
import { SellerDisputes, SellerOrders } from "../../../features/seller-operations";
import { SellerPromotions } from "../../../features/seller-promotions";
import { MarketplaceConnections } from "../../../features/marketplace-connections";
import { ShippingQuote } from "../../../features/shipping-quote";

const sections = {
  returns: "Khiếu nại / Hoàn trả",
  reports: "Báo Cáo Hiệu Suất"
} as const;

export default async function SellerSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "connections") return <SellerShell><MarketplaceConnections /></SellerShell>;
  if (section === "shipping") return <SellerShell><ShippingQuote /></SellerShell>;

  if (section === "inventory") {
    return (
      <SellerShell>
        <SellerWorkbench />
      </SellerShell>
    );
  }
  if (section === "orders" || section === "returns") {
    const Content = section === "orders" ? SellerOrders : SellerDisputes;
    return <SellerShell><Content /></SellerShell>;
  }
  if (section === "promotions") {
    return <SellerShell><SellerPromotions /></SellerShell>;
  }

  const title = sections[section as keyof typeof sections];

  if (!title) notFound();

  return (
    <SellerShell>
      <section className="grid min-h-[calc(100vh-100px)] place-items-center rounded-[18px] bg-white p-6 shadow-[0_3px_10px_rgba(16,40,69,0.08)] ring-1 ring-inset ring-[var(--line)]">
        <div className="max-w-md text-center">
          <p className="mb-3 text-sm font-medium text-[var(--accent)]">{title}</p>
          <h1 className="text-3xl font-bold text-[var(--ink)]">Tính năng đang phát triển</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">REBOXE đang hoàn thiện tính năng này. Vui lòng quay lại sau.</p>
          <Link className="mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--accent)] px-5 text-sm font-medium text-white" href="/seller/finance">Về trang đối soát</Link>
        </div>
      </section>
    </SellerShell>
  );
}
