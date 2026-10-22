"use client";
import type { CommerceOrder } from "@reboxe/shared";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";
import { EvidenceUploader } from "./evidence-uploader";

const api = createBrowserApiClient();
const orderStatusLabel: Record<CommerceOrder["status"], string> = {
  RESERVED: "Đã giữ hàng", CONFIRMED: "Đã xác nhận", READY_TO_SHIP: "Sẵn sàng giao",
  PICKED_UP: "Đã lấy hàng", IN_TRANSIT: "Đang vận chuyển", DELIVERED: "Đã giao hàng",
  COMPLETED: "Hoàn thành", EXPIRED: "Hết hạn", CANCELLED_BY_SELLER: "Người bán đã hủy",
  CANCELLED_BY_PICKUP_FAILURE: "Hủy do lấy hàng thất bại", DELIVERY_FAILED: "Giao hàng thất bại"
};
const disputeStatusLabel: Record<string, string> = {
  OPEN: "Đang xử lý", APPEALED: "Đã kháng nghị",
  RESOLVED_APPEAL_WINDOW: "Đã có quyết định", CLOSED: "Đã đóng"
};

export function SellerOrders() {
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [shopId, setShopId] = useState("");
  const [label, setLabel] = useState<string>();
  useEffect(() => { void api.getMe().then(async (actor) => { const shop = actor.shops[0]; if (!shop) return []; setShopId(shop.id); return api.listSellerOrders(shop.id); }).then(setOrders); }, []);
  async function ship(orderId: string) { const shipment = await api.createFakeShipment(shopId, orderId); setLabel(shipment.label); setOrders((items) => items.map((item) => item.id === orderId ? { ...item, status: "READY_TO_SHIP" } : item)); }
  return <section className="rounded-xl bg-white p-6"><h1 className="text-2xl font-bold">Quản lý đơn hàng</h1><p className="mt-2 text-sm text-[var(--muted)]">Theo dõi và xử lý các đơn hàng của shop.</p>{label ? <pre className="mt-4 whitespace-pre-wrap rounded bg-slate-100 p-4">{label}</pre> : null}<div className="mt-6 space-y-3">{orders.map((order) => <article className="border p-4" key={order.id}><strong>{order.id}</strong><span className="float-right">{orderStatusLabel[order.status]}</span><p className="mt-2 text-sm">{order.item.title} · {order.totalVnd.toLocaleString("vi-VN")} ₫</p>{order.status === "CONFIRMED" ? <button className="mt-3 rounded bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white" onClick={() => void ship(order.id)}>Tạo vận đơn</button> : null}</article>)}</div></section>;
}

export function SellerDisputes() {
  const [cases, setCases] = useState<Array<{ id: string; orderId: string; productTitle: string; status: string; reason: string; createdAt: string }>>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string>();
  useEffect(() => { void api.getMe().then((actor) => actor.shops[0] ? api.listSellerDisputes(actor.shops[0].id) : []).then(setCases); }, []);
  async function reply(caseId: string) {
    const body = replies[caseId]?.trim(); if (!body) return;
    await api.replyDispute(caseId, body); setNotice(`Đã phản hồi ${caseId}.`); setReplies((items) => ({ ...items, [caseId]: "" }));
  }
  return <section className="rounded-xl bg-white p-6"><h1 className="text-2xl font-bold">Khiếu nại / Hoàn trả</h1>{notice ? <p className="mt-3 text-sm text-emerald-700" role="status">{notice}</p> : null}<div className="mt-6 space-y-3">{cases.length === 0 ? <p className="text-sm text-[var(--muted)]">Chưa có khiếu nại.</p> : cases.map((item) => <article className="border p-4" key={item.id}><strong>{item.productTitle}</strong><span className="float-right">{disputeStatusLabel[item.status] ?? "Đang xử lý"}</span><p className="mt-1 text-xs text-[var(--muted)]">{item.id} · Đơn {item.orderId}</p><p className="mt-2 text-sm">{item.reason}</p><textarea aria-label={`Phản hồi ${item.id}`} className="mt-3 min-h-20 w-full border p-2 text-sm" onChange={(event) => setReplies((values) => ({ ...values, [item.id]: event.target.value }))} value={replies[item.id] ?? ""} /><div className="mt-2 flex gap-2"><button className="rounded bg-[var(--accent)] px-3 py-2 text-sm font-bold text-white" disabled={(replies[item.id]?.trim().length ?? 0) < 3} onClick={() => void reply(item.id)}>Gửi phản hồi</button><EvidenceUploader caseId={item.id} purpose="SELLER_EVIDENCE" /></div></article>)}</div></section>;
}
