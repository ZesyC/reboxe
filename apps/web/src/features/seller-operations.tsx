"use client";
import type { CommerceOrder } from "@reboxe/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";
import { disputeStatusLabels, orderStatusLabels } from "./commerce-data";
import { EvidenceUploader } from "./evidence-uploader";

const api = createBrowserApiClient();

export function SellerOrders() {
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [shopId, setShopId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [label, setLabel] = useState<string>();

  useEffect(() => {
    let active = true;
    void api.getMe()
      .then(async (actor) => {
        const shop = actor.shops[0];
        if (!shop) return [];
        if (active) setShopId(shop.id);
        return api.listSellerOrders(shop.id);
      })
      .then((rows) => { if (active) setOrders(rows); })
      .catch(() => { if (active) setError("Vui lòng đăng nhập tài khoản người bán để xem đơn hàng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function ship(orderId: string) {
    setBusyId(orderId);
    setError(undefined);
    try {
      const shipment = await api.createFakeShipment(shopId, orderId);
      setLabel(shipment.label);
      setOrders((items) => items.map((item) => item.id === orderId ? { ...item, status: "READY_TO_SHIP" } : item));
    } catch {
      setError("Không thể tạo vận đơn lúc này. Vui lòng thử lại.");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h1 className="text-2xl font-bold text-balance">Quản lý đơn hàng</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Theo dõi và xử lý các đơn hàng của shop.</p>
      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--line)] pt-4 text-sm font-medium text-[var(--danger)]" role="alert">
          <span>{error}</span>
          <Link className="inline-flex min-h-10 items-center font-bold underline" href="/login">Đăng nhập</Link>
        </div>
      ) : null}
      {label ? <pre className="mt-4 overflow-x-auto whitespace-pre-wrap border-t border-[var(--line)] pt-4 text-xs leading-6">{label}</pre> : null}
      <div className="mt-6 divide-y divide-[var(--line)]">
        {loading ? (
          <p className="text-sm text-[var(--muted)]" role="status">Đang tải danh sách đơn hàng...</p>
        ) : orders.length === 0 && !error ? (
          <p className="text-sm text-[var(--muted)]">Chưa có đơn hàng nào.</p>
        ) : orders.map((order) => (
          <article className="py-4 first:pt-0 last:pb-0" key={order.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm font-bold">{order.id}</strong>
              <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">{orderStatusLabels[order.status]}</span>
            </div>
            <p className="mt-2 text-sm tabular-nums">{order.item.title} · {order.totalVnd.toLocaleString("vi-VN")} ₫</p>
            {order.status === "CONFIRMED" ? (
              <button
                className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
                disabled={busyId === order.id}
                onClick={() => void ship(order.id)}
                type="button"
              >
                {busyId === order.id ? "Đang tạo vận đơn..." : "Tạo vận đơn"}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function SellerDisputes() {
  const [cases, setCases] = useState<Array<{ id: string; orderId: string; productTitle: string; status: string; reason: string; createdAt: string }>>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let active = true;
    void api.getMe()
      .then((actor) => actor.shops[0] ? api.listSellerDisputes(actor.shops[0].id) : [])
      .then((rows) => { if (active) setCases(rows); })
      .catch(() => { if (active) setError("Vui lòng đăng nhập tài khoản người bán để xem khiếu nại."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function reply(caseId: string) {
    const body = replies[caseId]?.trim();
    if (!body) return;
    setBusyId(caseId);
    setError(undefined);
    try {
      await api.replyDispute(caseId, body);
      setNotice(`Đã phản hồi ${caseId}.`);
      setReplies((items) => ({ ...items, [caseId]: "" }));
    } catch {
      setError("Không thể gửi phản hồi lúc này. Vui lòng thử lại.");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-5 sm:p-6">
      <h1 className="text-2xl font-bold text-balance">Khiếu nại / Hoàn trả</h1>
      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--line)] pt-4 text-sm font-medium text-[var(--danger)]" role="alert">
          <span>{error}</span>
          <Link className="inline-flex min-h-10 items-center font-bold underline" href="/login">Đăng nhập</Link>
        </div>
      ) : null}
      {notice ? <p className="mt-3 text-sm font-medium text-[var(--success)]" role="status">{notice}</p> : null}
      <div className="mt-6 divide-y divide-[var(--line)]">
        {loading ? (
          <p className="text-sm text-[var(--muted)]" role="status">Đang tải danh sách khiếu nại...</p>
        ) : cases.length === 0 && !error ? (
          <p className="text-sm text-[var(--muted)]">Chưa có khiếu nại.</p>
        ) : cases.map((item) => (
          <article className="py-4 first:pt-0 last:pb-0" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-base font-bold">{item.productTitle}</strong>
              <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">{disputeStatusLabels[item.status] ?? "Đang xử lý"}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">{item.id} · Đơn {item.orderId}</p>
            <p className="mt-2 text-sm leading-6">{item.reason}</p>
            <textarea
              aria-label={`Phản hồi ${item.id}`}
              className="mt-3 min-h-20 w-full rounded-lg border border-[var(--line-strong)] px-3 py-2.5 text-sm"
              onChange={(event) => setReplies((values) => ({ ...values, [item.id]: event.target.value }))}
              placeholder="Nhập nội dung phản hồi tới người mua và bộ phận xử lý..."
              value={replies[item.id] ?? ""}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
                disabled={busyId === item.id || (replies[item.id]?.trim().length ?? 0) < 3}
                onClick={() => void reply(item.id)}
                type="button"
              >
                {busyId === item.id ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
              <EvidenceUploader caseId={item.id} purpose="SELLER_EVIDENCE" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
