"use client";

import { ApiClientError } from "@reboxe/api-client";
import type { ActorContext, KycStatus, KycStatusResponse } from "@reboxe/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";

const api = createBrowserApiClient();
const messages: Record<KycStatus, string> = {
  PENDING: "Hồ sơ chưa bắt đầu xác minh. Vui lòng hoàn thành các bước onboarding.",
  PROCESSING: "Hồ sơ đang xử lý hoặc còn thiếu bước xác minh. Chưa thể đăng bán.",
  MANUAL_REVIEW: "Hồ sơ đang chờ nhân viên duyệt. Bạn chưa thể đăng bán; vui lòng quay lại kiểm tra kết quả.",
  VERIFIED: "Hồ sơ đã được duyệt. Bạn được phép đăng bán.",
  REJECTED: "Hồ sơ bị từ chối. Vui lòng liên hệ hỗ trợ REBOXE và cung cấp mã hồ sơ bên dưới."
};

export function SellerKycStatus() {
  const [shop, setShop] = useState<ActorContext["shops"][number]>();
  const [status, setStatus] = useState<KycStatusResponse>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    setStatus(undefined);
    try {
      const me = await api.getMe();
      const owned = me.shops.find((item) => item.role === "OWNER" && item.membershipStatus === "ACTIVE");
      setShop(owned);
      if (owned?.kycId) setStatus(await api.getKycStatus(owned.kycId));
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.status === 401
        ? "Bạn cần đăng nhập để xem hồ sơ." : "Không tải được trạng thái. Vui lòng thử lại.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  return <section className="mx-auto max-w-2xl space-y-5 rounded-xl border border-[var(--line)] bg-white p-5 sm:p-6">
    <h1 className="text-2xl font-bold text-balance">Trạng thái xác minh</h1>
    {loading ? <p className="text-sm text-[var(--muted)]" role="status">Đang tải hồ sơ…</p> : error ? <p className="text-sm font-medium text-[var(--danger)]" role="alert">{error}</p> : shop ? <>
      <h2 className="text-lg font-bold">{shop.displayName}</h2>
      <p className="text-sm leading-6" role="status">{messages[status?.kycStatus ?? shop.kycStatus]}</p>
      {status?.review ? <div className="space-y-2 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 text-sm leading-6">
        <p className="whitespace-pre-wrap"><strong>Lý do: </strong>{status.review.reason}</p>
        <p className="text-[var(--muted)]">Thời điểm duyệt: {new Date(status.review.reviewedAt).toLocaleString("vi-VN")}</p>
      </div> : null}
      {shop.kycId ? <p className="break-all text-xs text-[var(--muted)]">Mã hồ sơ: {shop.kycId}</p> : null}
    </> : <p className="text-sm text-[var(--muted)]">Chưa có hồ sơ shop thuộc quyền sở hữu của bạn.</p>}
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <button type="button" disabled={loading} onClick={() => void reload()} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--line-strong)] px-4 py-2 font-bold text-[var(--accent)] hover:bg-[var(--paper)] disabled:opacity-50">Cập nhật trạng thái</button>
      <Link href="/seller/inventory" className="inline-flex min-h-11 items-center font-semibold underline">Về kho hàng</Link>
      {error ? <Link href="/login" className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 font-bold text-white hover:bg-[var(--accent-strong)]">Đăng nhập</Link> : null}
    </div>
  </section>;
}
