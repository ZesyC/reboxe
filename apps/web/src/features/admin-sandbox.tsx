"use client";
import type { Listing } from "@reboxe/shared";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";
import { AiCaseReview } from "./ai-case-review";
import { disputeStatusLabels } from "./commerce-data";

const api = createBrowserApiClient();
export function AdminListingReviews() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void api.listPendingListingReviews()
      .then((rows) => { if (active) setItems(rows); })
      .catch(() => { if (active) setError("Cần tài khoản moderator với MFA/AAL2."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function decide(item: Listing, decision: "APPROVE" | "REJECT") {
    setBusyId(item.id);
    setError(undefined);
    try {
      await api.decideListingReview(item.id, decision, decision === "APPROVE" ? "Đã kiểm tra theo quy định hiện hành" : "Sản phẩm không đáp ứng quy định hiện hành");
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch {
      setError("Không thể gửi quyết định duyệt sản phẩm.");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-balance">Duyệt sản phẩm</h1>
      {loading ? <p className="mt-4 text-sm text-[var(--muted)]" role="status">Đang tải danh sách chờ duyệt...</p> : null}
      {error ? <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
      {!loading && !error && items.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">Hiện không có sản phẩm chờ duyệt.</p> : null}
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <article className="rounded-xl border border-[var(--line)] bg-white p-5" key={item.id}>
            <strong className="text-base font-bold">{item.title}</strong>
            <p className="mt-1 text-sm text-[var(--muted)]">Nguồn hàng: {item.returnPackageId ? `Kiện ${item.returnPackageId}` : "Người bán đăng trực tiếp"}.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button className="inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50" disabled={busyId === item.id} onClick={() => void decide(item, "APPROVE")} type="button">Duyệt</button>
              <button className="inline-flex min-h-11 items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50" disabled={busyId === item.id} onClick={() => void decide(item, "REJECT")} type="button">Từ chối</button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

export function AdminDisputes() {
  const [items, setItems] = useState<Array<{ id: string; orderId: string; status: string; reason: string; buyerPayableVnd: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, Array<{ id: string; view: string; objectVersion: string }>>>({});

  useEffect(() => {
    let active = true;
    void api.listAdminDisputes()
      .then((rows) => { if (active) setItems(rows); })
      .catch(() => { if (active) setError("Cần quyền giải quyết tranh chấp với MFA/AAL2."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function decide(item: typeof items[number], decision: "BUYER_REFUND" | "SELLER_WIN") {
    const reason = reasons[item.id]?.trim() ?? "";
    if (reason.length < 30) return setError("Lý do quyết định phải có ít nhất 30 ký tự.");
    setBusyId(item.id);
    setError(undefined);
    try {
      await api.decideDispute(item.id, { decision, reason, refundAmountVnd: decision === "BUYER_REFUND" ? item.buyerPayableVnd : 0, returnRequired: false });
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch {
      setError("Không thể cập nhật quyết định tranh chấp.");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-balance">Hàng đợi tranh chấp</h1>
      {loading ? <p className="mt-4 text-sm text-[var(--muted)]" role="status">Đang tải hàng đợi tranh chấp...</p> : null}
      {error ? <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
      {!loading && !error && items.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">Hiện không có tranh chấp cần xử lý.</p> : null}
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <article className="rounded-xl border border-[var(--line)] bg-white p-5" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm font-bold">{item.id}</strong>
              <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-semibold">{disputeStatusLabels[item.status] ?? item.status}</span>
            </div>
            <p className="mt-2 text-sm leading-6">{item.reason}</p>
            <p className="mt-1 text-sm tabular-nums">Số tiền đề nghị hoàn: {item.buyerPayableVnd.toLocaleString("vi-VN")} ₫</p>
            <button
              className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-[var(--accent)] underline"
              onClick={() => void api.listDisputeEvidence(item.id).then((rows) => setEvidence((all) => ({ ...all, [item.id]: rows }))).catch(() => setError("Không tải được danh sách bằng chứng."))}
              type="button"
            >
              Xem bằng chứng
            </button>
            {evidence[item.id]?.map((row) => <p className="mt-1 text-xs text-[var(--muted)]" key={row.id}>{row.view} · phiên bản {row.objectVersion}</p>)}
            <textarea
              aria-label={`Lý do quyết định ${item.id}`}
              className="mt-3 min-h-20 w-full rounded-lg border border-[var(--line-strong)] px-3 py-2.5 text-sm"
              minLength={30}
              onChange={(event) => setReasons((values) => ({ ...values, [item.id]: event.target.value }))}
              placeholder="Nhập lý do quyết định (tối thiểu 30 ký tự)..."
              value={reasons[item.id] ?? ""}
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <button className="inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50" disabled={busyId === item.id} onClick={() => void decide(item, "BUYER_REFUND")} type="button">Hoàn tiền cho người mua</button>
              <button className="inline-flex min-h-11 items-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50" disabled={busyId === item.id} onClick={() => void decide(item, "SELLER_WIN")} type="button">Công nhận người bán</button>
            </div>
            <AiCaseReview caseId={item.id} />
          </article>
        ))}
      </div>
    </main>
  );
}
