"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthBody, AuthField, AuthHeader } from "../../features/auth-shell";
import { getSupabaseBrowserClient } from "../../platform/auth/browser";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const data = new FormData(event.currentTarget);
    const redirectTo = `${window.location.origin}/reset-password`;
    setSubmitting(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(String(data.get("email")).trim(), { redirectTo });
      if (resetError) throw resetError;
      setMessage("Nếu email tồn tại, REBOXE đã gửi liên kết đặt lại mật khẩu.");
    } catch {
      setError("Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-[var(--paper)]">
      <AuthHeader title="Quên mật khẩu" />
      <AuthBody>
        <form className="flex w-full flex-col gap-4 rounded-xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-7" onSubmit={submit}>
          <h2 className="text-xl font-semibold text-[var(--ink)]">Đặt lại mật khẩu</h2>
          <AuthField autoComplete="email" label="Email" name="email" placeholder="Email" required type="email" />
          <button
            aria-busy={submitting}
            className="min-h-11 w-full rounded-md bg-[var(--accent)] px-4 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "ĐANG GỬI..." : "GỬI LIÊN KẾT"}
          </button>
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
          {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">{message}</p> : null}
          <p className="text-center text-[13px] text-[var(--muted)]">
            <Link className="font-medium text-[var(--accent)] hover:underline" href="/login">Quay lại đăng nhập</Link>
          </p>
        </form>
      </AuthBody>
    </div>
  );
}
