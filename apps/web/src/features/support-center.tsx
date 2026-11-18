"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createBrowserApiClient } from "../platform/api/browser";

const api = createBrowserApiClient();

export function SupportCenter() {
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const hotline = process.env.NEXT_PUBLIC_SUPPORT_HOTLINE;
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setNotice(undefined);
    setError(undefined);
    try {
      const result = await api.createSupportTicket({
        category: String(data.get("category")) as "ORDER" | "DISPUTE" | "ACCOUNT" | "OTHER",
        content: String(data.get("content")),
        ...(data.get("orderId") ? { orderId: String(data.get("orderId")) } : {}),
        ...(data.get("caseId") ? { caseId: String(data.get("caseId")) } : {})
      });
      setNotice(`Đã tạo ticket ${result.id}.`);
      form.reset();
    } catch {
      setError("Không thể tạo yêu cầu. Hãy đăng nhập và kiểm tra mã đơn hoặc mã case.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold text-balance">Hỗ trợ REBOXE</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {hotline || email
          ? `${hotline ? `Hotline: ${hotline}` : ""}${hotline && email ? " · " : ""}${email ? `Email: ${email}` : ""}`
          : "Gửi yêu cầu để đội ngũ REBOXE kiểm tra đơn hàng, tranh chấp hoặc tài khoản của bạn."}
      </p>
      <form className="mt-6 space-y-4 rounded-xl border border-[var(--line)] bg-white p-5 sm:p-6" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm font-semibold">
          <span>Loại hỗ trợ</span>
          <select aria-label="Loại hỗ trợ" className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-white pl-3.5 pr-10 text-sm font-normal" defaultValue="ORDER" name="category">
            <option value="ORDER">Đơn hàng</option>
            <option value="DISPUTE">Tranh chấp</option>
            <option value="ACCOUNT">Tài khoản</option>
            <option value="OTHER">Khác</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          <span>Mã đơn (không bắt buộc)</span>
          <input className="min-h-11 w-full rounded-lg border border-[var(--line-strong)] px-3.5 py-2.5 text-sm font-normal" name="orderId" placeholder="VD: ORD-202604-001" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          <span>Mã case (không bắt buộc)</span>
          <input className="min-h-11 w-full rounded-lg border border-[var(--line-strong)] px-3.5 py-2.5 text-sm font-normal" name="caseId" placeholder="VD: CASE-001" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          <span>Nội dung cần hỗ trợ</span>
          <textarea className="min-h-32 w-full rounded-lg border border-[var(--line-strong)] px-3.5 py-2.5 text-sm font-normal" minLength={10} name="content" placeholder="Mô tả vấn đề bạn đang gặp phải (ít nhất 10 ký tự)" required />
        </label>
        <button className="inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50" disabled={busy} type="submit">
          {busy ? "Đang gửi..." : "Gửi yêu cầu"}
        </button>
        {notice ? <p role="status" className="text-sm font-medium text-[var(--success)]">{notice}</p> : null}
        {error ? <p role="alert" className="text-sm font-medium text-[var(--danger)]">{error}</p> : null}
      </form>
    </main>
  );
}

export function AdminSupportQueue() {
  const [items, setItems] = useState<Array<{ id: string; category: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void api.listSupportQueue()
      .then((rows) => { if (active) setItems(rows); })
      .catch(() => { if (active) setError("Cần quyền SUPPORT và MFA/AAL2."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function resolve(id: string) {
    setBusyId(id);
    setError(undefined);
    try {
      await api.replySupportTicket(id, "Yêu cầu đã được xử lý theo quy trình hỗ trợ.", "RESOLVED");
      setItems((rows) => rows.map((row) => row.id === id ? { ...row, status: "RESOLVED" } : row));
    } catch {
      setError("Không thể cập nhật trạng thái ticket.");
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-balance">Hàng đợi hỗ trợ</h1>
      {loading ? <p className="mt-4 text-sm text-[var(--muted)]" role="status">Đang tải hàng đợi hỗ trợ...</p> : null}
      {error ? <p className="mt-4 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
      {!loading && !error && items.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">Hiện chưa có yêu cầu hỗ trợ nào.</p> : null}
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <article className="rounded-xl border border-[var(--line)] bg-white p-5" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm font-bold">{item.id}</strong>
              <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-semibold">{item.status}</span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{item.category}</p>
            {item.status !== "RESOLVED" ? (
              <button
                className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50"
                disabled={busyId === item.id}
                onClick={() => void resolve(item.id)}
                type="button"
              >
                {busyId === item.id ? "Đang xử lý..." : "Phản hồi và đóng"}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
