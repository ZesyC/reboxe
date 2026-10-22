"use client";
import type { CommerceOrder } from "@reboxe/shared";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";
import { AccountShell } from "./account-shell";
import { EvidenceUploader } from "./evidence-uploader";

const api = createBrowserApiClient();
export function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<CommerceOrder>();
  const [error, setError] = useState<string>();
  const [reason, setReason] = useState("");
  const [caseId, setCaseId] = useState<string>();
  useEffect(() => { void api.getCommerceOrder(id).then(setOrder).catch(() => setError("Không thể tải đơn hàng.")); }, [id]);
  return <AccountShell activeHref="/account/orders" initials="RB" username="Tài khoản"><main className="min-h-96 flex-1 rounded border border-[var(--line)] bg-white p-6">{error ? <p role="alert">{error}</p> : !order ? <p>Đang tải...</p> : <><h1 className="text-xl font-bold">Đơn {order.id}</h1><p className="mt-2 text-sm text-[var(--muted)]">Thanh toán khi nhận hàng (COD)</p><div className="mt-6 border p-4"><strong>{order.item.title}</strong><p className="mt-2">{order.totalVnd.toLocaleString("vi-VN")} ₫</p></div><ol className="mt-6 space-y-3">{order.timeline.map((event) => <li key={`${event.status}-${event.at}`}><strong>{event.status.replaceAll("_", " ")}</strong> · {new Date(event.at).toLocaleString("vi-VN")}</li>)}</ol>{["DELIVERED", "COMPLETED"].includes(order.status) ? <div className="mt-8 border-t pt-5"><h2 className="font-bold">Mở khiếu nại</h2><p className="mt-1 text-sm text-[var(--muted)]">Bạn có thể gửi khiếu nại không kèm bằng chứng hoặc bổ sung video tối đa 90 giây.</p><textarea aria-label="Lý do khiếu nại" className="mt-3 min-h-24 w-full border p-3" minLength={10} onChange={(event) => setReason(event.target.value)} value={reason} /><button className="mt-2 rounded bg-[var(--accent)] px-4 py-2 font-bold text-white" disabled={reason.trim().length < 10 || Boolean(caseId)} onClick={() => void api.openDispute(order.id, reason).then((item) => setCaseId(item.id))}>{caseId ? `Đã tạo ${caseId}` : "Gửi khiếu nại"}</button>{caseId ? <EvidenceUploader caseId={caseId} purpose="DISPUTE_EVIDENCE" /> : null}</div> : null}</>}</main></AccountShell>;
}
