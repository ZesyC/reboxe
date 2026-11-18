"use client";
import type { CommerceOrder } from "@reboxe/shared";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";
import { useAccountIdentity } from "./account-center";
import { AccountShell } from "./account-shell";
import { orderStatusLabels } from "./commerce-data";
import { EvidenceUploader } from "./evidence-uploader";

const api = createBrowserApiClient();
export function OrderDetail({ id }: { id: string }) {
  const identity = useAccountIdentity();
  const [order, setOrder] = useState<CommerceOrder>();
  const [error, setError] = useState<string>();
  const [disputeError, setDisputeError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [caseId, setCaseId] = useState<string>();

  useEffect(() => { void api.getCommerceOrder(id).then(setOrder).catch(() => setError("Không thể tải đơn hàng.")); }, [id]);

  async function submitDispute() {
    if (!order || submitting) return;
    setSubmitting(true);
    setDisputeError(undefined);
    try {
      const item = await api.openDispute(order.id, reason);
      setCaseId(item.id);
    } catch {
      setDisputeError("Không thể gửi khiếu nại lúc này. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AccountShell activeHref="/account/orders" initials={identity.initials} username={identity.username}>
      <section className="min-h-96 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-white p-5 sm:p-6">
        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : !order ? <p className="text-sm text-[var(--muted)]" role="status">Đang tải...</p> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl font-semibold">Đơn {order.id}</h1>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">{orderStatusLabels[order.status]}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">Thanh toán khi nhận hàng (COD)</p>
            <div className="mt-6 rounded-lg border border-[var(--line)] p-4">
              <strong>{order.item.title}</strong>
              <p className="mt-2 tabular-nums font-semibold text-[var(--accent)]">{order.totalVnd.toLocaleString("vi-VN")} ₫</p>
            </div>
            <ol className="mt-6 space-y-3 text-sm">
              {order.timeline.map((event) => (
                <li key={`${event.status}-${event.at}`}>
                  <strong>{orderStatusLabels[event.status as keyof typeof orderStatusLabels] ?? event.status}</strong> · {new Date(event.at).toLocaleString("vi-VN")}
                </li>
              ))}
            </ol>
            {["DELIVERED", "COMPLETED"].includes(order.status) ? (
              <div className="mt-8 border-t border-[var(--line)] pt-5">
                <h2 className="font-bold">Mở khiếu nại</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Bạn có thể gửi khiếu nại không kèm bằng chứng hoặc bổ sung video tối đa 90 giây.</p>
                <label className="mt-3 block text-sm font-medium">
                  Lý do khiếu nại (ít nhất 10 ký tự)
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-[var(--line-strong)] p-3 text-sm font-normal"
                    minLength={10}
                    onChange={(event) => setReason(event.target.value)}
                    value={reason}
                  />
                </label>
                {disputeError ? <p className="mt-2 text-sm text-red-700" role="alert">{disputeError}</p> : null}
                <button
                  className="mt-3 min-h-11 rounded-md bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
                  disabled={reason.trim().length < 10 || Boolean(caseId) || submitting}
                  onClick={() => void submitDispute()}
                  type="button"
                >
                  {caseId ? `Đã tạo ${caseId}` : submitting ? "Đang gửi..." : "Gửi khiếu nại"}
                </button>
                {caseId ? <EvidenceUploader caseId={caseId} purpose="DISPUTE_EVIDENCE" /> : null}
              </div>
            ) : null}
          </>
        )}
      </section>
    </AccountShell>
  );
}
