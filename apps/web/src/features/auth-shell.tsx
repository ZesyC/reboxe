import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AuthHeader({ title }: { title: string }) {
  return (
    <header className="min-h-[84px] border-b border-[var(--line)] bg-white px-4 py-4 sm:px-6">
      <div className="mx-auto flex h-full w-full max-w-[960px] flex-wrap items-center gap-3">
        <Link aria-label="Về trang chủ" className="inline-flex min-h-11 shrink-0 items-center gap-2.5" href="/">
          <Image alt="" aria-hidden height={36} src="/reboxe/logo.png" unoptimized width={36} />
          <span className="text-[28px] font-bold leading-none text-[var(--ink)]">REBOXE</span>
        </Link>
        <span aria-hidden className="h-[26px] w-px bg-[var(--line)]" />
        <h1 className="whitespace-nowrap text-xl font-normal text-[var(--ink)] sm:text-2xl">{title}</h1>
        <Link className="ml-auto inline-flex min-h-11 items-center whitespace-nowrap px-2 text-sm text-[var(--accent)] hover:underline" href="/support">Bạn cần giúp đỡ?</Link>
      </div>
    </header>
  );
}

export function AuthBody({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-[calc(100vh-84px)] items-center bg-[var(--accent-header)] px-4 py-10 sm:px-6">
      <div className="mx-auto grid w-full max-w-[960px] items-center gap-10 lg:grid-cols-[1fr_420px]">
        <div className="hidden text-[var(--on-accent-header)] lg:block">
          <div className="flex items-center gap-3">
            <span className="grid size-14 place-items-center rounded-2xl bg-white/95 p-2 shadow-sm">
              <Image alt="" aria-hidden height={40} src="/reboxe/logo.png" unoptimized width={40} />
            </span>
            <span className="text-3xl font-bold tracking-tight">REBOXE</span>
          </div>
          <h2 className="mt-6 text-balance text-3xl font-semibold leading-snug">
            Sàn thanh lý nguyên kiện hàng hoàn minh bạch
          </h2>
          <p className="mt-3 max-w-[44ch] text-base leading-relaxed">
            Kết nối nguồn kiện hoàn chưa mở kiểm tra từ người bán đã xác minh tới người mua với thông tin bản kê rõ ràng và quy trình đối soát minh bạch.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[420px]">
          {children}
        </div>
      </div>
    </main>
  );
}

export function AuthField({
  autoComplete,
  label,
  minLength,
  name,
  placeholder,
  required = false,
  type = "text"
}: {
  autoComplete: string;
  label?: string;
  minLength?: number;
  name: string;
  placeholder: string;
  required?: boolean;
  type?: "email" | "password" | "text";
}) {
  const fieldId = `auth-${name}`;
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--ink)]" htmlFor={fieldId}>
      <span>{label ?? placeholder}</span>
      <input
        autoComplete={autoComplete}
        className="h-11 w-full rounded-md border border-[var(--line-strong)] bg-white px-3.5 text-sm text-[var(--ink)]"
        id={fieldId}
        minLength={minLength}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

export function OrDivider() {
  return (
    <div className="flex h-5 items-center gap-2.5 text-xs text-[var(--muted)]">
      <span className="h-px flex-1 bg-[var(--line)]" />
      <span>HOẶC</span>
      <span className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

function FacebookLogo() {
  return (
    <svg aria-hidden className="size-5 shrink-0" viewBox="0 0 24 24">
      <circle cx="12" cy="12" fill="#fff" r="11" />
      <path
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07Z"
        fill="#1877F2"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden className="size-5 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
    </svg>
  );
}

function SocialButton({ icon, provider }: { icon: ReactNode; provider: string }) {
  return (
    <button
      aria-disabled="true"
      className="flex min-h-11 flex-1 cursor-not-allowed items-center justify-center gap-2.5 rounded-md border border-[var(--line-strong)] bg-white px-3 text-sm font-medium text-[var(--ink)]"
      disabled
      type="button"
    >
      {icon}
      <span>{provider}</span>
    </button>
  );
}

export function SocialLogin() {
  return (
    <div className="flex flex-wrap gap-2.5">
      <SocialButton icon={<FacebookLogo />} provider="Facebook" />
      <SocialButton icon={<GoogleLogo />} provider="Google" />
    </div>
  );
}

export function AuthTerms({ action }: { action: "đăng ký" | "đăng nhập" }) {
  return (
    <p className="text-center text-xs leading-5 text-[var(--muted)]">
      Bằng việc {action}, bạn đồng ý với <Link className="text-[var(--accent)] underline" href="/legal/marketplace-rules">Điều khoản dịch vụ</Link> và <Link className="text-[var(--accent)] underline" href="/legal/privacy-policy">Chính sách bảo mật</Link> của REBOXE.
    </p>
  );
}
