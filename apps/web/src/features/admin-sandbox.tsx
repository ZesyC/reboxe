"use client";
import type { Listing } from "@reboxe/shared";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";
import { AiCaseReview } from "./ai-case-review";

const api = createBrowserApiClient();
export function AdminListingReviews() {
  const [items, setItems] = useState<Listing[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => { void api.listPendingListingReviews().then(setItems).catch(() => setError("Cần tài khoản moderator với MFA/AAL2.")); }, []);
  async function decide(item: Listing, decision: "APPROVE" | "REJECT") { await api.decideListingReview(item.id, decision, decision === "APPROVE" ? "Đã kiểm tra theo quy định hiện hành" : "Sản phẩm không đáp ứng quy định hiện hành"); setItems((current) => current.filter((row) => row.id !== item.id)); }
  return <main className="mx-auto max-w-5xl p-6"><h1 className="text-2xl font-bold">Duyệt sản phẩm</h1>{error ? <p className="mt-4 text-red-700">{error}</p> : <div className="mt-6 space-y-3">{items.map((item) => <article className="border bg-white p-4" key={item.id}><strong>{item.title}</strong><p className="mt-1 text-sm">Nguồn hàng: {item.returnPackageId ? `Kiện ${item.returnPackageId}` : "Người bán đăng trực tiếp"}.</p><div className="mt-3 flex gap-2"><button className="rounded bg-emerald-700 px-4 py-2 text-white" onClick={() => void decide(item, "APPROVE")}>Duyệt</button><button className="rounded bg-red-700 px-4 py-2 text-white" onClick={() => void decide(item, "REJECT")}>Từ chối</button></div></article>)}</div>}</main>;
}

export function AdminDisputes() {
  const [items, setItems] = useState<Array<{ id: string; orderId: string; status: string; reason: string; buyerPayableVnd: number }>>([]);
  const [error, setError] = useState<string>();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, Array<{ id: string; view: string; objectVersion: string }>>>({});
  useEffect(() => { void api.listAdminDisputes().then(setItems).catch(() => setError("Cần quyền giải quyết tranh chấp với MFA/AAL2.")); }, []);
  async function decide(item: typeof items[number], decision: "BUYER_REFUND" | "SELLER_WIN") {
    const reason = reasons[item.id]?.trim() ?? "";
    if (reason.length < 30) return setError("Lý do quyết định phải có ít nhất 30 ký tự.");
    await api.decideDispute(item.id, { decision, reason, refundAmountVnd: decision === "BUYER_REFUND" ? item.buyerPayableVnd : 0, returnRequired: false });
    setItems((current) => current.filter((row) => row.id !== item.id));
  }
  return <main className="mx-auto max-w-5xl p-6"><h1 className="text-2xl font-bold">Hàng đợi tranh chấp</h1>{error ? <p className="mt-4 text-red-700" role="alert">{error}</p> : null}<div className="mt-6 space-y-3">{items.map((item) => <article className="border bg-white p-4" key={item.id}><strong>{item.id}</strong><span className="float-right">{item.status}</span><p className="mt-2">{item.reason}</p><p className="mt-1 text-sm">Số tiền đề nghị hoàn: {item.buyerPayableVnd.toLocaleString("vi-VN")} ₫</p><button className="mt-3 text-sm text-[var(--accent)] underline" onClick={() => void api.listDisputeEvidence(item.id).then((rows) => setEvidence((all) => ({ ...all, [item.id]: rows })))}>Xem bằng chứng</button>{evidence[item.id]?.map((row) => <p className="mt-1 text-xs" key={row.id}>{row.view} · phiên bản {row.objectVersion}</p>)}<textarea aria-label={`Lý do quyết định ${item.id}`} className="mt-3 min-h-20 w-full border p-2" minLength={30} onChange={(event) => setReasons((values) => ({ ...values, [item.id]: event.target.value }))} value={reasons[item.id] ?? ""} /><div className="mt-2 flex gap-2"><button className="rounded bg-emerald-700 px-3 py-2 text-sm text-white" onClick={() => void decide(item, "BUYER_REFUND")}>Hoàn tiền cho người mua</button><button className="rounded bg-slate-700 px-3 py-2 text-sm text-white" onClick={() => void decide(item, "SELLER_WIN")}>Công nhận người bán</button></div><AiCaseReview caseId={item.id} /></article>)}</div></main>;
}
