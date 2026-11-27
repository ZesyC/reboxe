"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthBody, AuthField, AuthHeader, AuthTerms, OrDivider, SocialLogin } from "../../features/auth-shell";
import { getSupabaseBrowserClient } from "../../platform/auth/browser";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(undefined);

    try {
      const identifier = String(data.get("email")).trim();
      const email = identifier.includes("@") ? identifier : `${identifier.toLowerCase()}@reboxe.demo`;
      const { error: authError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email,
        password: String(data.get("password"))
      });
      if (authError) {
        setError("Email hoặc mật khẩu không đúng.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && /^\/(?!\/)[^\\]*$/.test(next) ? next : "/");
    } catch {
      setError("Không thể kết nối dịch vụ đăng nhập. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[var(--paper)]">
      <AuthHeader title="Đăng nhập" />
      <AuthBody>
        <form className="flex w-full flex-col gap-3.5 rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-7" onSubmit={login}>
          <div className="flex items-center justify-between gap-2 pb-1">
            <h2 className="text-[22px] font-semibold text-[var(--ink)]">Đăng nhập</h2>
          </div>
          <AuthField autoComplete="username" label="Email" name="email" placeholder="Email hoặc tên đăng nhập" required type="text" />
          <AuthField autoComplete="current-password" label="Mật khẩu" name="password" placeholder="Mật khẩu" required type="password" />
          <div className="flex justify-end">
            <Link className="inline-flex min-h-9 items-center text-[13px] font-medium text-[var(--accent)] hover:underline" href="/forgot-password">Quên mật khẩu?</Link>
          </div>
          <button
            aria-busy={submitting}
            className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP"}
          </button>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">{error}</p> : null}
          <OrDivider />
          <SocialLogin />
          <AuthTerms action="đăng nhập" />
          <p className="text-center text-[13px] text-[var(--muted)]">
            Bạn mới biết đến REBOXE? <Link className="ml-1 font-medium text-[var(--accent)] hover:underline" href="/register">Đăng ký</Link>
          </p>
        </form>
      </AuthBody>
    </div>
  );
}
