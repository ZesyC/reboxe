"use client";

import Image from "next/image";
import Link from "next/link";

const defaults = {
  404: {
    title: "Không tìm thấy trang",
    message: "Liên kết có thể đã thay đổi hoặc trang đã được gỡ."
  },
  502: {
    title: "Tạm thời chưa kết nối được",
    message: "REBOXE chưa nhận được phản hồi từ máy chủ. Bạn có thể thử tải lại trang."
  }
};

const primary = "inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ink)]";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--line-strong)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]";

export function SiteStatus({ code, title, message, retryHref }: {
  code: 404 | 502;
  title?: string;
  message?: string;
  retryHref?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-20">
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm md:grid md:grid-cols-[0.85fr_1fr]">
        <div className="grid content-center justify-items-center gap-3 bg-[var(--accent-soft)] px-6 py-8 md:min-h-[340px]">
          <Image alt="REBOXE" height={42} src="/reboxe/logo.png" unoptimized width={42} className="rounded-xl" />
          <p className="text-[clamp(4.5rem,14vw,8rem)] font-bold leading-none tracking-tight text-[var(--accent-strong)] tabular-nums">{code}</p>
        </div>
        <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12">
          <h1 className="text-balance text-2xl font-bold text-[var(--ink)] sm:text-3xl">{title ?? defaults[code].title}</h1>
          <p className="mt-3 max-w-md text-pretty text-sm leading-7 text-[var(--muted)] sm:text-base">{message ?? defaults[code].message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {code === 502 ? (
              <>
                {retryHref ? <a className={primary} href={retryHref}>Thử lại</a> : (
                  <button className={primary} onClick={() => window.location.reload()} type="button">Thử lại</button>
                )}
                <Link className={secondary} href="/support">Liên hệ hỗ trợ</Link>
              </>
            ) : (
              <>
                <Link className={primary} href="/">Về trang chủ</Link>
                <Link className={secondary} href="/search">Tìm sản phẩm</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
