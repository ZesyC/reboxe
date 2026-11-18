"use client";

import { ApiClientError } from "@reboxe/api-client";
import type { AdminKycDetail, AdminKycQueue, KycDecisionInput } from "@reboxe/shared";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserApiClient } from "../platform/api/browser";
import { getSupabaseBrowserClient } from "../platform/auth/browser";

const api = createBrowserApiClient();
const button = "rounded-lg border border-[var(--line)] px-4 py-2 font-semibold disabled:opacity-50";

export function AdminKyc() {
  const [queue, setQueue] = useState<AdminKycQueue>();
  const [detail, setDetail] = useState<AdminKycDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [factor, setFactor] = useState<{ id: string; qr?: string }>();
  const sending = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);

  const reportError = useCallback((caught: unknown) => {
    if (caught instanceof ApiClientError && (caught.status === 401 || caught.status === 403)) {
      setQueue(undefined);
      setDetail(undefined);
      setMfaRequired(caught.code === "MFA_REQUIRED");
      setError(caught.status === 401 ? "Bạn cần đăng nhập bằng tài khoản nhân viên."
        : caught.code === "MFA_REQUIRED" ? "Vui lòng xác thực hai bước để mở hồ sơ." : "Bạn không có quyền duyệt hồ sơ.");
    } else {
      setError(caught instanceof ApiClientError && caught.status === 409
        ? "Hồ sơ hoặc yêu cầu đã thay đổi. Hãy tải lại hàng đợi để kiểm tra kết quả."
        : "Không hoàn tất được yêu cầu. Bạn có thể thử lại.");
    }
  }, []);

  const reload = useCallback(async (cursor?: string) => {
    setBusy(true); setError(""); setDetail(undefined);
    try {
      const result = await api.listKycReviews(cursor);
      setQueue(result); setMfaRequired(false);
    } catch (caught) { reportError(caught); }
    finally { setBusy(false); }
  }, [reportError]);
  useEffect(() => { void reload(); }, [reload]);

  async function open(id: string) {
    setBusy(true); setError(""); setDetail(undefined); attempt.current = null;
    try { setDetail(await api.getKycReview(id)); }
    catch (caught) { reportError(caught); }
    finally { setBusy(false); }
  }

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || sending.current) return;
    const form = new FormData(event.currentTarget);
    const input: KycDecisionInput = {
      decision: form.get("decision") === "APPROVE" ? "APPROVE" : "REJECT",
      reason: String(form.get("reason") ?? "").trim()
    };
    if (!input.reason) { setError("Vui lòng nhập lý do duyệt."); return; }
    const payload = JSON.stringify({ id: detail.kycId, ...input });
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    sending.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const result = await api.decideKycReview(detail.kycId, input, attempt.current.key);
      setQueue((current) => current ? { ...current, items: current.items.filter((item) => item.kycId !== result.kycId) } : current);
      setMessage(`${result.kycStatus === "VERIFIED" ? "Đã phê duyệt" : "Đã từ chối"} hồ sơ ${detail.shopDisplayName}.`);
      setDetail(undefined); attempt.current = null;
    } catch (caught) { reportError(caught); }
    finally { sending.current = false; setBusy(false); }
  }

  async function beginMfa() {
    setBusy(true); setError("");
    try {
      const mfa = getSupabaseBrowserClient().auth.mfa;
      const factors = await mfa.listFactors();
      if (factors.error) throw factors.error;
      const existing = factors.data.totp[0];
      if (existing) setFactor({ id: existing.id });
      else {
        const enrolled = await mfa.enroll({ factorType: "totp", friendlyName: `REBOXE staff ${Date.now()}` });
        if (enrolled.error) throw enrolled.error;
        setFactor({ id: enrolled.data.id, qr: enrolled.data.totp.qr_code });
      }
    } catch { setError("Không mở được xác thực hai bước. Vui lòng đăng nhập rồi thử lại."); }
    finally { setBusy(false); }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor) return;
    const code = String(new FormData(event.currentTarget).get("code"));
    setBusy(true); setError("");
    try {
      const result = await getSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (result.error) throw result.error;
      setFactor(undefined); await reload();
    } catch { setError("Mã xác thực chưa đúng hoặc đã hết hạn. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-6xl space-y-6 p-5 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm text-[var(--muted)]">REBOXE · Quản trị</p><h1 className="text-2xl font-bold text-balance sm:text-3xl">Duyệt hồ sơ người bán</h1></div>
      <button className={button} disabled={busy} onClick={() => void reload()}>Tải lại hàng đợi</button>
    </div>
    {error ? <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900">{error}</p> : null}
    {message ? <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-900">{message}</p> : null}
    {busy ? <p role="status">Đang xử lý…</p> : null}
    {mfaRequired ? <section className="space-y-4">
      {!factor ? <button className={button} disabled={busy} onClick={() => void beginMfa()}>Xác thực hai bước</button> : <form onSubmit={verifyMfa} className="max-w-sm space-y-3">
        {factor.qr ? <><p>Quét mã bằng ứng dụng xác thực, sau đó nhập mã 6 chữ số.</p>
          <img src={factor.qr} alt="Mã QR thiết lập xác thực hai bước" width={200} height={200} /></> : null}
        <label className="block">Mã xác thực<input className="mt-2 block w-full rounded border p-2" name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
        <button className={button} disabled={busy}>Xác nhận</button>
      </form>}
    </section> : null}
    {!queue ? <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--accent-strong)]">Đăng nhập</Link> : <div className="grid gap-8 lg:grid-cols-[minmax(240px,1fr)_2fr]">
      <section aria-label="Hàng đợi KYC" className="space-y-3">
        <h2 className="font-bold">Chờ duyệt · Cũ nhất trước</h2>
        {queue.items.length === 0 ? <p>Không có hồ sơ chờ duyệt trên trang này.</p> : <ul className="divide-y divide-[var(--line)]">
          {queue.items.map((item) => <li key={item.kycId}><button disabled={busy} onClick={() => void open(item.kycId)} className="min-h-11 w-full rounded-lg px-2 py-3.5 text-left transition-colors hover:bg-[var(--paper)] disabled:opacity-50" type="button" aria-pressed={detail?.kycId === item.kycId}>
            <span className="block font-semibold">{item.shopDisplayName}</span><span className="text-sm text-[var(--muted)]">{new Date(item.submittedAt).toLocaleString("vi-VN")} · {item.provider}</span>
          </button></li>)}
        </ul>}
        {queue.nextCursor ? <button className={button} disabled={busy} onClick={() => void reload(queue.nextCursor!)}>Trang tiếp</button> : null}
      </section>
      {detail ? <section key={detail.kycId} aria-label="Chi tiết hồ sơ" className="space-y-5 rounded-xl border border-[var(--line)] bg-white p-5">
        <h2 className="text-xl font-bold">{detail.shopDisplayName}</h2>
        <p className="text-sm">{detail.kycId} · {detail.status}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm">
          {[
            ["CCCD", detail.identity.citizenId], ["Họ tên", detail.identity.fullName], ["Ngày sinh", detail.identity.dateOfBirth],
            ["Giới tính", detail.identity.gender], ["Địa chỉ", detail.identity.address], ["Ngày cấp", detail.identity.issuedAt],
            ["Giấy tờ hợp lệ", verdict(detail.verification.documentValid)], ["Khuôn mặt khớp", verdict(detail.verification.faceMatched)],
            ["Điểm khuôn mặt", detail.verification.faceScore], ["Liveness", verdict(detail.verification.livenessPassed)],
            ["Điểm liveness", detail.verification.livenessScore], ["Xác minh MST", detail.tax.status], ["Tên đăng ký MST", detail.tax.registeredName],
            ["Ngân hàng", detail.bank.bankCode], ["Số tài khoản", detail.bank.accountNumber], ["Xác minh ngân hàng", detail.bank.status],
            ["Tên ngân hàng trả về", detail.bank.registeredName], ["Điểm khớp tên", detail.bank.nameMatchScore]
          ].map(([label, value]) => <div key={label} className="contents"><dt className="text-[var(--muted)]">{label}</dt><dd className="break-words">{value ?? "Chưa có kết quả"}</dd></div>)}
        </dl>
        <p className="text-sm text-[var(--muted)]">Phê duyệt cho phép đăng bán. Kết quả xác minh MST và ngân hàng được giữ nguyên.</p>
        {detail.status === "MANUAL_REVIEW" ? <form onSubmit={decide} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <div><label htmlFor="kyc-decision" className="block text-sm font-semibold">Quyết định</label><select id="kyc-decision" name="decision" required defaultValue="" className="mt-2 h-11 w-full rounded-lg border border-[var(--line-strong)] bg-white pl-3 pr-10 text-sm">
              <option value="" disabled>Chọn quyết định</option><option value="APPROVE">Phê duyệt</option><option value="REJECT">Từ chối</option>
            </select></div>
            <label className="block text-sm font-semibold">Lý do (seller sẽ thấy nội dung này)<textarea name="reason" required maxLength={1000} rows={3} className="mt-2 block w-full rounded-lg border border-[var(--line-strong)] px-3 py-2.5 text-sm font-normal" /></label>
            <button className={`${button} min-h-11 bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]`} disabled={busy} type="submit">Gửi quyết định</button>
          </fieldset>
        </form> : <p>{detail.review?.reason ?? "Hồ sơ đã thay đổi trạng thái. Vui lòng tải lại hàng đợi."}</p>}
      </section> : <p className="text-[var(--muted)]">Chọn một hồ sơ để xem chi tiết.</p>}
    </div>}
  </main>;
}

function verdict(value: boolean | null): string {
  return value === null ? "Chưa có kết quả" : value ? "Đạt" : "Không đạt";
}
