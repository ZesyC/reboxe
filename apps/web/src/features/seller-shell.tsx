"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

type FinanceTab = "overview" | "wallet";

function SellerNavItem({ active, children, href }: { active?: boolean; children: ReactNode; href?: string }) {
  const className = `flex h-[34px] w-[184px] items-center rounded-xl px-3 text-[13px] ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink)]"}`;
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link aria-current={active ? "page" : undefined} className={className} href={href}>{children}</Link>
  );
}

export function SellerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-[calc(100vh-52px)] bg-[var(--paper)] xl:h-[calc(100vh-52px)] xl:min-h-0 xl:overflow-hidden">
      <button aria-controls="seller-sidebar" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? "Ẩn thanh bên" : "Hiện thanh bên"} className="fixed left-4 top-[10px] z-50 grid size-8 place-items-center rounded-md text-xl leading-none text-[#66758b] hover:bg-[var(--accent-soft)]" onClick={() => setSidebarOpen((open) => !open)} type="button"><span aria-hidden>☰</span></button>
      <aside className="w-[220px] shrink-0 border-r border-[var(--line)] bg-white px-4 py-[18px]" hidden={!sidebarOpen} id="seller-sidebar">
        <nav aria-label="Điều hướng Kênh người bán">
          <p className="mb-1 text-[11px] font-medium text-[var(--muted)]">QUẢN LÝ BÁN HÀNG</p>
          <div className="grid gap-1">
            <SellerNavItem active={pathname === "/seller/products/new"} href="/seller/products/new">Thêm Sản Phẩm</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/inventory"} href="/seller/inventory">Quản Lý Kho Hàng</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/promotions"} href="/seller/promotions">Quảng Bá Sản Phẩm</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/orders"} href="/seller/orders">Quản Lý Đơn Hàng</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/shipping"} href="/seller/shipping">Phí vận chuyển</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/kyc"} href="/seller/kyc">Trạng thái xác minh</SellerNavItem>
            <SellerNavItem active={pathname === "/seller/returns"} href="/seller/returns">Khiếu nại / Hoàn trả</SellerNavItem>
          </div>
          <p className="mb-1 mt-5 text-[11px] font-medium text-[var(--muted)]">TÀI CHÍNH</p>
          <SellerNavItem active={pathname === "/seller/finance" || pathname === "/seller/wallet"} href="/seller/finance">Đối Soát &amp; Ví Ký Quỹ</SellerNavItem>
          <p className="mb-1 mt-5 text-[11px] font-medium text-[var(--muted)]">DỮ LIỆU</p>
          <SellerNavItem active={pathname === "/seller/connections"} href="/seller/connections">Kết nối nguồn hàng</SellerNavItem>
          <SellerNavItem active={pathname === "/seller/reports"} href="/seller/reports">Báo Cáo Hiệu Suất</SellerNavItem>
        </nav>
      </aside>
      <main className={`min-w-0 flex-1 overscroll-contain p-4 sm:p-6 ${pathname === "/seller/inventory" ? "xl:overflow-hidden" : "xl:overflow-y-auto"}`}><div className="mx-auto h-full max-w-[1200px]">{children}</div></main>
    </div>
  );
}

export function FinanceWorkspace({ active, children }: { active: FinanceTab; children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-3 overflow-y-auto rounded-[18px] bg-white p-4 shadow-[0_3px_10px_rgba(16,40,69,0.08)] ring-1 ring-inset ring-[var(--line)] sm:p-6 xl:h-full xl:min-h-[679px]">
      <h1 className="h-[33px] text-[24px] font-bold leading-[33px] text-[var(--ink)] sm:text-[28px]">Đối Soát Tài Chính &amp; Ví Ký Quỹ</h1>
      <nav className="flex h-11 shrink-0 items-end gap-2" aria-label="Đối soát tài chính">
        <Link className={`flex h-9 w-[94px] flex-col items-center justify-end gap-2 px-3.5 text-sm font-medium ${active === "overview" ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} href="/seller/finance"><span className="whitespace-nowrap">Tổng quan</span><span className={`h-[3px] rounded-sm ${active === "overview" ? "w-[54px] bg-[var(--accent)]" : "w-[54px]"}`} /></Link>
        <Link className={`flex h-9 w-[88px] flex-col items-center justify-end gap-2 px-3.5 text-sm font-medium ${active === "wallet" ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} href="/seller/wallet"><span className="whitespace-nowrap">Lịch sử ví</span><span className={`h-[3px] rounded-sm ${active === "wallet" ? "w-[60px] bg-[var(--accent)]" : "w-[60px]"}`} /></Link>
      </nav>
      {children}
    </section>
  );
}
