"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type FinanceTab = "overview" | "wallet";

function SellerNavItem({ active, children, href, onNavigate }: { active?: boolean; children: ReactNode; href?: string; onNavigate?: () => void }) {
  const className = `flex min-h-10 w-full items-center rounded-xl px-3 text-[13px] font-medium transition-colors ${active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[var(--ink)] hover:bg-[var(--paper)]"}`;
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link aria-current={active ? "page" : undefined} className={className} href={href} {...(onNavigate ? { onClick: onNavigate } : {})}>{children}</Link>
  );
}

function HamburgerIcon() {
  return (
    <svg aria-hidden fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 20 20" width="20">
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isQuickListing = pathname === "/seller/quick-listing";
  const sidebarToggle = "fixed left-2 top-1.5 z-50 grid size-10 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]";

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileSidebarOpen]);

  const closeMobile = () => setMobileSidebarOpen(false);

  return (
    <div className={`flex bg-[var(--paper)] ${isQuickListing ? "h-[calc(100dvh-52px)] min-h-[320px]" : "min-h-[calc(100vh-52px)] xl:h-[calc(100vh-52px)] xl:min-h-0 xl:overflow-hidden"}`} data-quick-listing-shell={isQuickListing || undefined}>
      <button
        aria-controls="seller-sidebar"
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? "Ẩn thanh bên" : "Hiện thanh bên"}
        className={`${sidebarToggle} hidden sm:grid`}
        onClick={() => setSidebarOpen((open) => !open)}
        type="button"
      >
        <HamburgerIcon />
      </button>
      <button
        aria-controls="seller-sidebar"
        aria-expanded={mobileSidebarOpen}
        aria-label={mobileSidebarOpen ? "Ẩn thanh bên" : "Hiện thanh bên"}
        className={`${sidebarToggle} sm:hidden`}
        onClick={() => setMobileSidebarOpen((open) => !open)}
        type="button"
      >
        <HamburgerIcon />
      </button>

      {mobileSidebarOpen ? (
        <div
          aria-hidden
          className="fixed inset-x-0 bottom-0 top-[52px] z-30 bg-slate-900/25 sm:hidden"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={`w-[232px] shrink-0 overflow-y-auto border-r border-[var(--line)] bg-white px-4 py-[18px] max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:top-[52px] max-sm:z-40 max-sm:shadow-xl ${mobileSidebarOpen ? "max-sm:block" : "max-sm:hidden"} ${sidebarOpen ? "sm:block" : "sm:hidden"}`}
        id="seller-sidebar"
      >
        <nav aria-label="Điều hướng Kênh người bán">
          <p className="mb-1.5 px-2 text-xs font-semibold text-[var(--muted)]">QUẢN LÝ BÁN HÀNG</p>
          <div className="grid gap-1">
            <SellerNavItem active={pathname === "/seller/products/new"} href="/seller/products/new" onNavigate={closeMobile}>Thêm Sản Phẩm</SellerNavItem>
            <SellerNavItem active={isQuickListing} href="/seller/quick-listing" onNavigate={closeMobile}>Đăng nhanh</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/inventory"} href="/seller/inventory" onNavigate={closeMobile}>Quản Lý Kho Hàng</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/promotions"} href="/seller/promotions" onNavigate={closeMobile}>Quảng Bá Sản Phẩm</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/orders"} href="/seller/orders" onNavigate={closeMobile}>Quản Lý Đơn Hàng</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/shipping"} href="/seller/shipping" onNavigate={closeMobile}>Phí vận chuyển</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/kyc"} href="/seller/kyc" onNavigate={closeMobile}>Trạng thái xác minh</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/returns"} href="/seller/returns" onNavigate={closeMobile}>Khiếu nại / Hoàn trả</SellerNavItem>
          </div>
          <p className="mb-1.5 mt-5 px-2 text-xs font-semibold text-[var(--muted)]">TÀI CHÍNH</p>
          <SellerNavItem active={pathname === "/seller/finance" || pathname === "/seller/wallet"} href="/seller/finance" onNavigate={closeMobile}>Đối Soát &amp; Ví Ký Quỹ</SellerNavItem>
          <p className="mb-1.5 mt-5 px-2 text-xs font-semibold text-[var(--muted)]">DỮ LIỆU</p>
          <div className="grid gap-1">
            <SellerNavItem active={pathname === "/seller/connections"} href="/seller/connections" onNavigate={closeMobile}>Kết nối nguồn hàng</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/reports"} href="/seller/reports" onNavigate={closeMobile}>Báo Cáo Hiệu Suất</SellerNavItem>
          </div>
        </nav>
      </aside>
      <main className={`min-w-0 flex-1 overscroll-contain ${isQuickListing ? "p-2 sm:p-5 xl:overflow-hidden" : `p-4 sm:p-6 ${pathname === "/seller/inventory" ? "xl:overflow-hidden" : "xl:overflow-y-auto"}`}`}>
        <div className="mx-auto h-full max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}

export function FinanceWorkspace({ active, children }: { active: FinanceTab; children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-3 overflow-y-auto rounded-[18px] bg-white p-4 shadow-[0_3px_10px_rgba(16,40,69,0.08)] ring-1 ring-inset ring-[var(--line)] sm:p-6 xl:h-full xl:min-h-[679px]">
      <h1 className="text-xl font-bold leading-snug text-[var(--ink)] sm:text-[26px]">Đối Soát Tài Chính &amp; Ví Ký Quỹ</h1>
      <nav aria-label="Đối soát tài chính" className="flex min-h-11 shrink-0 items-end gap-2 border-b border-[var(--line)]">
        <Link
          aria-current={active === "overview" ? "page" : undefined}
          className={`inline-flex min-h-11 flex-col items-center justify-end gap-2 px-3.5 text-sm font-medium ${active === "overview" ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          href="/seller/finance"
        >
          <span className="whitespace-nowrap">Tổng quan</span>
          <span className={`h-[3px] w-14 rounded-sm ${active === "overview" ? "bg-[var(--accent)]" : "bg-transparent"}`} />
        </Link>
        <Link
          aria-current={active === "wallet" ? "page" : undefined}
          className={`inline-flex min-h-11 flex-col items-center justify-end gap-2 px-3.5 text-sm font-medium ${active === "wallet" ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          href="/seller/wallet"
        >
          <span className="whitespace-nowrap">Lịch sử ví</span>
          <span className={`h-[3px] w-14 rounded-sm ${active === "wallet" ? "bg-[var(--accent)]" : "bg-transparent"}`} />
        </Link>
      </nav>
      {children}
    </section>
  );
}
