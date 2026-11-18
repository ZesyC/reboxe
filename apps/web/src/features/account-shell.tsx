import Link from "next/link";
import type { ReactNode } from "react";

const accountNavItems = [
  { label: "Hồ sơ", href: "/account/profile" },
  { label: "Ngân hàng/ Ví điện tử", href: "/account/payment" },
  { label: "Địa chỉ", href: "/account/address" },
  { label: "Đổi mật khẩu", href: "/account/password" },
  { label: "Cài đặt thông báo", href: "/account/notifications" },
  { label: "Thiết lập riêng tư", href: "/account/privacy" },
  { label: "Thông tin cá nhân", href: "/account/personal" },
  { label: "Đơn mua", href: "/account/orders" }
];

function AccountNavItem({ active, href, label }: { active: boolean; href: string | undefined; label: string }) {
  const className = `flex min-h-10 items-center gap-3 rounded-lg px-2 text-[13px] transition-colors ${active ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[var(--ink)] hover:bg-white"}`;
  const content = (
    <>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${active ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`} />
      <span>{label}</span>
    </>
  );

  return href
    ? <Link aria-current={active ? "page" : undefined} className={className} href={href}>{content}</Link>
    : <span className={className}>{content}</span>;
}

export function AccountShell({ activeHref, children, username = "Tài khoản", initials = "US" }: {
  activeHref: string;
  children: ReactNode;
  username?: string;
  initials?: string;
}) {
  return (
    <main className="min-h-[780px] bg-[var(--paper)] px-4 pb-20 pt-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-[980px] items-start gap-6 max-md:flex-col">
        <aside className="w-[210px] shrink-0 max-md:w-full">
          <div className="flex min-h-[68px] items-center gap-3 pb-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]">{initials}</span>
            <div className="min-w-0">
              <strong className="block truncate text-[15px]">{username}</strong>
              <Link className="mt-1 inline-flex min-h-8 items-center text-xs text-[var(--muted)] hover:text-[var(--accent)] hover:underline" href="/account/profile">Sửa hồ sơ</Link>
            </div>
          </div>
          <div className="h-px bg-[var(--line)]" />
          <p className="pb-1.5 pt-3 text-xs font-semibold text-[var(--muted)]">TÀI KHOẢN CỦA TÔI</p>
          <nav aria-label="Tài khoản của tôi" className="grid gap-0.5 max-md:grid-cols-2 max-sm:grid-cols-1">
            {accountNavItems.map((item) => <AccountNavItem active={item.href === activeHref} href={item.href} key={item.label} label={item.label} />)}
          </nav>
        </aside>
        {children}
      </div>
    </main>
  );
}
