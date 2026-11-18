"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../platform/auth/browser";
import { nameInitials } from "./commerce-data";

function accountDisplayName(user?: User | null): string | null {
  if (!user) return null;
  const fullName = user.user_metadata.full_name;
  return typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : user.email?.split("@")[0] || null;
}

function useSignedInName() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then((result: { data: { session: Session | null } }) => {
      setName(accountDisplayName(result.data.session?.user));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setName(accountDisplayName(session?.user));
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  return name;
}

function UtilityNavigation({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const name = useSignedInName();

  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/");
  }

  return (
    <nav aria-label="Điều hướng tiện ích" className={`reboxe-container flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[var(--on-accent-header)] ${compact ? "text-xs sm:text-[13px]" : "text-xs sm:text-sm"}`}>
      <div className="flex items-center gap-3">
        <Link className="inline-flex min-h-9 items-center py-1 hover:underline" href="/seller/inventory">Kênh Người Bán</Link>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link className="inline-flex min-h-9 items-center py-1 hover:underline" href="/account/notifications">Thông báo</Link>
        <Link className="inline-flex min-h-9 items-center py-1 hover:underline" href="/support">Hỗ trợ</Link>
        <span aria-hidden className="opacity-60">|</span>
        {name ? (
          <>
            <Link className="inline-flex min-h-9 items-center py-1 font-medium hover:underline" href="/account/profile">{name}</Link>
            <span aria-hidden className="opacity-60">|</span>
            <button className="inline-flex min-h-9 items-center py-1 hover:underline" onClick={logout} type="button">Đăng xuất</button>
          </>
        ) : (
          <>
            <Link className="inline-flex min-h-9 items-center py-1 hover:underline" href="/register">Đăng ký</Link>
            <span aria-hidden className="opacity-60">|</span>
            <Link className="inline-flex min-h-9 items-center py-1 hover:underline" href="/login">Đăng nhập</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function ReboxeBrand({ section }: { section?: string | undefined }) {
  return (
    <Link className="flex min-h-11 shrink-0 items-center gap-2.5 text-white" href="/">
      <Image alt="" aria-hidden height={38} src="/reboxe/logo.png" unoptimized width={38} />
      <strong className="text-2xl leading-none sm:text-[30px]">REBOXE</strong>
      {section ? <span aria-hidden className="h-7 w-px bg-white/80" /> : null}
      {section ? <span className="whitespace-nowrap text-lg leading-7 sm:text-[22px]">{section}</span> : null}
    </Link>
  );
}

function SearchField({ className = "", placeholder = "Tìm kiếm sản phẩm hoàn, đồ mới giá tốt..." }: { className?: string; placeholder?: string | undefined }) {
  return (
    <form
      action="/search"
      className={`flex h-12 min-w-0 items-center rounded-md bg-white pl-4 pr-1 ring-inset focus-within:ring-2 focus-within:ring-[var(--ink)] ${className}`}
      data-focus-ring-parent
      role="search"
    >
      <input
        aria-label="Tìm kiếm sản phẩm"
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--ink)]"
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button
        aria-label="Tìm kiếm"
        className="flex h-10 w-[56px] shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent-strong)] hover:bg-[var(--ink)]"
        type="submit"
      >
        <Image alt="" aria-hidden height={22} src="/reboxe/search.svg" width={22} />
      </button>
    </form>
  );
}

function MarketplaceHeader({ cart = false, shop = false }: { cart?: boolean; shop?: boolean }) {
  return (
    <header className="relative z-40 bg-[var(--accent-header)] px-4 pb-3 pt-1 text-white sm:px-6">
      <UtilityNavigation />
      <div className="reboxe-container mt-1 flex min-h-16 flex-wrap items-center gap-x-6 gap-y-3 xl:flex-nowrap">
        <ReboxeBrand section={cart ? "Giỏ Hàng" : undefined} />
        <SearchField
          className="order-3 w-full xl:order-none xl:flex-1"
          placeholder={shop ? "Tìm sản phẩm trong cửa hàng..." : undefined}
        />
        {!cart ? (
          <Link aria-label="Mở giỏ hàng" className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-white/10 xl:ml-0" href="/cart">
            <Image alt="" aria-hidden height={30} src="/reboxe/cart.svg" width={30} />
          </Link>
        ) : null}
      </div>
    </header>
  );
}

function CheckoutHeader() {
  return (
    <header className="relative z-40 border-b border-[var(--line)]">
      <div className="bg-[var(--accent-header)] px-4 py-0.5 sm:px-6"><UtilityNavigation compact /></div>
      <div className="min-h-20 bg-white px-4 py-4 sm:px-6">
        <div className="reboxe-container flex h-full flex-wrap items-center gap-y-2">
          <Link className="flex items-center gap-3" href="/">
            <Image alt="" aria-hidden height={38} src="/reboxe/logo.png" unoptimized width={38} />
            <strong className="text-2xl leading-none text-[var(--accent)] sm:text-[30px]">REBOXE</strong>
          </Link>
          <span aria-hidden className="mx-4 h-8 w-px bg-[var(--line)]" />
          <span className="text-xl font-medium text-[var(--accent)] sm:text-[22px]">Thanh Toán</span>
        </div>
      </div>
    </header>
  );
}

function SellerHeader() {
  const name = useSignedInName();
  const initials = nameInitials(name ?? "REBOXE", "R");

  return (
    <header className="relative z-40 h-[52px] border-b border-[var(--line)] bg-white">
      <div className="flex h-full items-center px-4">
        <Link aria-label="REBOXE" className="ml-11 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-1" href="/">
          <Image alt="" aria-hidden height={28} src="/reboxe/logo.png" unoptimized width={28} />
        </Link>
        <nav aria-label="Breadcrumb Kênh người bán" className="flex min-w-0 items-center">
          <Link className="ml-2 inline-flex min-h-10 items-center px-1 text-[13px] text-[var(--muted)] hover:text-[var(--accent)] hover:underline" href="/">Trang chủ</Link>
          <span aria-hidden className="mx-1 text-base text-[var(--muted)]">›</span>
          <span className="truncate text-[13px] font-semibold text-[var(--ink)]">Kênh người bán</span>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            aria-label="Hồ sơ tài khoản"
            className="grid size-9 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white hover:bg-[var(--accent-strong)]"
            href="/account/profile"
            title={name ?? "Tài khoản người bán"}
          >
            {initials}
          </Link>
        </div>
      </div>
    </header>
  );
}

function AdminHeader({ pathname }: { pathname: string }) {
  const nav = [
    { href: "/admin/kyc", label: "Duyệt KYC" },
    { href: "/admin/listings", label: "Duyệt sản phẩm" },
    { href: "/admin/disputes", label: "Tranh chấp" },
    { href: "/admin/support", label: "Hỗ trợ" }
  ];
  return (
    <header className="relative z-40 border-b border-[var(--line)] bg-white px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2">
        <Link className="inline-flex min-h-10 items-center gap-2 font-bold text-[var(--ink)]" href="/">
          <Image alt="" aria-hidden height={28} src="/reboxe/logo.png" unoptimized width={28} />
          <span>REBOXE · Quản trị</span>
        </Link>
        <nav aria-label="Điều hướng quản trị" className="flex flex-wrap items-center gap-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  if (pathname === "/checkout") return <CheckoutHeader />;
  if (pathname === "/cart") return <MarketplaceHeader cart />;
  if (pathname.startsWith("/account/") || pathname === "/support" || pathname.startsWith("/legal/")) return <MarketplaceHeader />;
  if (pathname === "/" || pathname.startsWith("/listings/") || pathname === "/search") return <MarketplaceHeader />;
  if (pathname.startsWith("/shops/")) return <MarketplaceHeader shop />;
  if (pathname === "/seller/onboarding") return <CheckoutHeader />;
  if (pathname.startsWith("/seller/")) return <SellerHeader />;
  if (pathname.startsWith("/admin/")) return <AdminHeader pathname={pathname} />;
  return null;
}
