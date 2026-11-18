import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "../features/site-header";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  display: "swap",
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Reboxe",
  description: "Sàn thanh lý nguyên kiện hàng hoàn"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${beVietnamPro.variable} flex min-h-dvh flex-col`}>
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--accent-strong)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
          href="#main-content"
        >
          Bỏ qua đến nội dung chính
        </a>
        <SiteHeader />
        <div className="grow" id="main-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="border-t border-[var(--line)] bg-[var(--card)] px-4 py-4 text-center text-xs text-[var(--muted)]">
          <nav aria-label="Thông tin pháp lý và hỗ trợ" className="reboxe-container flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Link className="inline-flex min-h-11 items-center px-2 hover:text-[var(--accent)] hover:underline" href="/legal/marketplace-rules">Quy chế sàn</Link>
            <span aria-hidden>·</span>
            <Link className="inline-flex min-h-11 items-center px-2 hover:text-[var(--accent)] hover:underline" href="/legal/privacy-policy">Chính sách bảo mật</Link>
            <span aria-hidden>·</span>
            <Link className="inline-flex min-h-11 items-center px-2 hover:text-[var(--accent)] hover:underline" href="/legal/dispute-process">Giải quyết tranh chấp</Link>
            <span aria-hidden>·</span>
            <Link className="inline-flex min-h-11 items-center px-2 hover:text-[var(--accent)] hover:underline" href="/support">Hỗ trợ</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
