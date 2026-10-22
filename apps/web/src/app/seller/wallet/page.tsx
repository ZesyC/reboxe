"use client";

import type { SellerFinanceSnapshot } from "@reboxe/shared";
import { useEffect, useState } from "react";
import { FinanceWorkspace, SellerShell } from "../../../features/seller-shell";
import { createBrowserApiClient } from "../../../platform/api/browser";

const api = createBrowserApiClient();
const kindLabel = { DEPOSIT: "NẠP KÝ QUỸ", HOLD: "TẠM TRỪ VÍ", REVENUE: "DOANH THU ĐƠN" } as const;

export default function SellerWalletPage() {
  const [finance, setFinance] = useState<SellerFinanceSnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void api.getMe()
      .then((actor) => actor.shops[0] ? api.getSellerFinance(actor.shops[0].id) : Promise.reject())
      .then(setFinance)
      .catch(() => setError("Không tải được lịch sử ví."));
  }, []);

  return (
    <SellerShell>
      <FinanceWorkspace active="wallet">
        {error ? <div className="grid min-h-[420px] place-items-center text-sm text-red-600" role="alert">{error}</div> : !finance ? <div className="grid min-h-[420px] place-items-center text-sm text-[var(--muted)]">Đang tải lịch sử ví...</div> : <>
        <section className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="border-b border-[var(--line)] bg-[var(--paper)] px-5 py-4">
            <h2 className="text-lg font-bold">Lịch sử ví ký quỹ</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">Các bút toán đã ghi nhận làm thay đổi số dư khả dụng của shop</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-[var(--muted)]"><tr><th className="px-5 py-3">Mã tham chiếu</th><th className="px-5 py-3">Loại giao dịch</th><th className="px-5 py-3">Nội dung</th><th className="px-5 py-3">Giá trị</th><th className="px-5 py-3">Thời gian</th></tr></thead>
              <tbody>
                {finance.walletTransactions.map((transaction) => (
                  <tr className="border-t border-[var(--line)]" key={transaction.code}>
                    <td className="px-5 py-4 font-bold">{transaction.code}</td>
                    <td className="px-5 py-4"><span className="rounded-full bg-[var(--paper)] px-3 py-1 text-xs font-medium">{kindLabel[transaction.kind]}</span></td>
                    <td className="px-5 py-4">{transaction.detail}</td>
                    <td className={`px-5 py-4 font-bold ${transaction.amountVnd >= 0 ? "text-emerald-700" : "text-red-600"}`}>{transaction.amountVnd >= 0 ? "+" : ""}{transaction.amountVnd.toLocaleString("vi-VN")}đ</td>
                    <td className="px-5 py-4 text-[var(--muted)]">{new Date(transaction.occurredAt).toLocaleDateString("vi-VN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>}
      </FinanceWorkspace>
    </SellerShell>
  );
}
