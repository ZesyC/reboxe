"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthBody, AuthField, AuthHeader, AuthTerms, OrDivider, SocialLogin } from "../../features/auth-shell";
import { getSupabaseBrowserClient } from "../../platform/auth/browser";

export default function RegisterPage() {
  const router = useRouter();
  const [pendingEmail, setPendingEmail] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirmPassword"))) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    setSuccess(undefined);

    try {
      const next = new URLSearchParams(window.location.search).get("next");
      const email = String(data.get("email")).trim();
      const { data: authData, error: authError } = await getSupabaseBrowserClient().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login${next === "/seller/onboarding" ? "?next=/seller/onboarding" : ""}`
        }
      });
      if (authError) {
        setError("Không thể tạo tài khoản. Email có thể đã được sử dụng.");
        return;
      }
      if (!authData.session) {
        setPendingEmail(email);
        setSuccess("Mã xác thực đã được gửi tới email của bạn.");
        return;
      }
      router.replace(next === "/seller/onboarding" ? next : "/");
    } catch {
      setError("Không thể kết nối dịch vụ đăng ký. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !pendingEmail) return;

    const token = String(new FormData(event.currentTarget).get("token"));
    setSubmitting(true);
    setError(undefined);

    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.verifyOtp({
        email: pendingEmail,
        token,
        type: "signup"
      });
      if (authError) {
        setError("Mã xác thực không đúng hoặc đã hết hạn.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next === "/seller/onboarding" ? next : "/");
    } catch {
      setError("Không thể xác thực tài khoản. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[var(--paper)]">
      <AuthHeader title="Đăng ký" />
      <AuthBody>
        <form className="flex w-full flex-col gap-3.5 rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-7" onSubmit={pendingEmail ? verifyOtp : register}>
          <div className="pb-1">
            <h2 className="text-[22px] font-semibold text-[var(--ink)]">{pendingEmail ? "Xác thực email" : "Đăng ký"}</h2>
          </div>
          {pendingEmail ? (
            <>
              <p className="text-sm text-[var(--muted)]">Nhập mã 6 số đã gửi tới {pendingEmail}.</p>
              <label className="grid gap-1.5 text-sm font-medium text-[var(--ink)]" htmlFor="register-otp">
                <span>Mã xác thực</span>
                <input
                  autoComplete="one-time-code"
                  className="h-11 w-full rounded-md border border-[var(--line-strong)] bg-white px-3.5 text-sm text-[var(--ink)]"
                  id="register-otp"
                  inputMode="numeric"
                  maxLength={6}
                  minLength={6}
                  name="token"
                  pattern="[0-9]{6}"
                  placeholder="Mã xác thực"
                  required
                />
              </label>
            </>
          ) : (
            <>
              <AuthField autoComplete="email" label="Email" name="email" placeholder="Email" required type="email" />
              <AuthField autoComplete="new-password" label="Mật khẩu" minLength={8} name="password" placeholder="Mật khẩu (ít nhất 8 ký tự)" required type="password" />
              <AuthField autoComplete="new-password" label="Nhập lại mật khẩu" minLength={8} name="confirmPassword" placeholder="Nhập lại mật khẩu" required type="password" />
            </>
          )}
          <button
            aria-busy={submitting}
            className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "ĐANG XỬ LÝ..." : pendingEmail ? "XÁC THỰC" : "ĐĂNG KÝ"}
          </button>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700" role="alert">{error}</p> : null}
          {success ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800" role="status">{success}</p> : null}
          {pendingEmail ? null : <><OrDivider /><SocialLogin /></>}
          <AuthTerms action="đăng ký" />
          <p className="text-center text-[13px] text-[var(--muted)]">
            Bạn đã có tài khoản? <Link className="ml-1 font-medium text-[var(--accent)] hover:underline" href="/login">Đăng nhập</Link>
          </p>
        </form>
      </AuthBody>
    </div>
  );
}
