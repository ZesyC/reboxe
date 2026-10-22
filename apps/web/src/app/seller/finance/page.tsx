"use client";

import type { SellerFinanceSnapshot } from "@reboxe/shared";
import { useEffect, useState } from "react";
import { FinanceWorkspace, SellerShell } from "../../../features/seller-shell";
import { createBrowserApiClient } from "../../../platform/api/browser";

const api = createBrowserApiClient();
const money = (value: number) => `${value.toLocaleString("vi-VN")} VNĐ`;
const compactMoney = (value: number) => `${value.toLocaleString("vi-VN")}đ`;

function MetricCards({ finance }: { finance: SellerFinanceSnapshot }) {
  const metrics = [
    { label: "SỐ DƯ KÝ QUỸ KHẢ DỤNG", value: finance.availableBalanceVnd },
    { label: "TẠM KHÓA ĐỐI SOÁT", value: finance.heldBalanceVnd },
    { label: finance.unpricedOrderCount ? "GIÁ TRỊ ĐƠN HOÀN THÀNH" : "DOANH THU SAU ĐIỀU CHỈNH", value: finance.netRevenueVnd }
  ];
  return (
    <div className="grid shrink-0 gap-3 lg:grid-cols-3 xl:gap-3">
      {metrics.map((metric) => (
        <article className="flex h-[104px] flex-col gap-2 rounded-xl bg-white px-[18px] py-4 ring-1 ring-inset ring-[var(--line)]" key={metric.label}>
          <p className="text-[11px] font-medium text-[var(--muted)]">{metric.label}</p>
          <p className="text-2xl font-bold leading-normal text-[var(--ink)]">{money(metric.value)}</p>
        </article>
      ))}
    </div>
  );
}

function RevenueTrend({ finance }: { finance: SellerFinanceSnapshot }) {
  if (finance.monthlyRevenue.length === 0) return <article className="grid h-[270px] place-items-center rounded-xl text-sm text-[var(--muted)] ring-1 ring-inset ring-[var(--line)]">Chưa có đơn hoàn thành để tổng hợp doanh thu.</article>;
  const amounts = finance.monthlyRevenue.map((item) => item.amountVnd);
  const min = Math.min(...amounts);
  const range = Math.max(1, Math.max(...amounts) - min);
  const lastIndex = Math.max(1, finance.monthlyRevenue.length - 1);
  const trend = finance.monthlyRevenue.map((item, index) => ({
    ...item,
    left: 71 + (1012 * index) / lastIndex,
    pointTop: 190 - ((item.amountVnd - min) / range) * 102
  }));
  return (
    <article className="h-[270px] shrink-0 overflow-x-auto rounded-xl ring-1 ring-inset ring-[var(--line)]">
      <div className="relative h-[268px] min-w-[1122px]">
        <h2 className="absolute left-[19px] top-[17px] text-lg font-bold">Xu hướng doanh thu theo tháng</h2>
        <p className="absolute left-[19px] top-[43px] text-xs text-[var(--muted)]">Giá trị đơn hoàn thành sau các khoản điều chỉnh đã ghi nhận</p>
        {[81, 123.67, 166.33, 209].map((top) => <span className="absolute left-[71px] h-px w-[1012px] bg-[var(--line)]" key={top} style={{ top }} />)}
        {trend.map((item, index) => {
          const next = trend[index + 1];
          return <div key={item.label}>
            {next ? <span className="absolute h-[2px] origin-left bg-[var(--accent)]" style={{ left: item.left, top: item.pointTop + 3, transform: `rotate(${Math.atan2(next.pointTop - item.pointTop, next.left - item.left) * 180 / Math.PI}deg)`, width: Math.hypot(next.left - item.left, next.pointTop - item.pointTop) }} /> : null}
            <span className="absolute w-20 -translate-x-1/2 text-center text-[11px] font-medium" style={{ left: item.left, top: item.pointTop - 20 }}>{compactMoney(item.amountVnd)}</span>
            <span className="absolute size-2 -translate-x-1/2 rounded-full bg-[var(--accent)]" style={{ left: item.left, top: item.pointTop }} />
            <span className="absolute top-[221px] w-11 -translate-x-1/2 text-center text-xs text-[var(--muted)]" style={{ left: item.left }}>{item.label}</span>
          </div>;
        })}
      </div>
    </article>
  );
}

function RevenueByProduct({ finance }: { finance: SellerFinanceSnapshot }) {
  const maxRevenue = Math.max(1, ...finance.productRevenue.map((item) => item.amountVnd));
  const products = finance.productRevenue.slice(0, 4).map((item) => ({ ...item, height: Math.max(0, item.amountVnd / maxRevenue * 106.4) }));
  return (
    <article className="relative min-h-[280px] min-w-0 rounded-xl ring-1 ring-inset ring-[var(--line)]">
      <h2 className="absolute left-[19px] top-[17px] text-lg font-bold">Doanh thu theo sản phẩm</h2>
      <p className="absolute left-[19px] top-[43px] text-xs text-[var(--muted)]">So sánh nhóm sản phẩm nổi bật</p>
      {[83, 124.33, 165.67, 207].map((top) => <span className="absolute left-[53px] right-[51px] h-px bg-[var(--line)]" key={top} style={{ top }} />)}
      <div className="absolute left-[39px] right-[69px] top-[83px] grid h-[156px] grid-cols-4">
        {products.map((product) => (
          <div className="relative" key={product.label}>
            <span className="absolute left-1/2 w-20 -translate-x-1/2 text-center text-[11px] font-medium" style={{ bottom: product.height + 36 }}>{compactMoney(product.amountVnd)}</span>
            <span className="absolute bottom-8 left-1/2 w-12 -translate-x-1/2 rounded-[3px] bg-[var(--accent)]" style={{ height: product.height }} />
            <span className="absolute left-1/2 top-[138px] w-[92px] -translate-x-1/2 text-center text-[11px] text-[var(--muted)]">{product.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function FinancialComposition({ finance }: { finance: SellerFinanceSnapshot }) {
  const total = finance.availableBalanceVnd + finance.heldBalanceVnd;
  const availablePercent = total ? Math.round(finance.availableBalanceVnd / total * 100) : 0;
  const heldPercent = total ? 100 - availablePercent : 0;
  return (
    <article className="relative min-h-[280px] min-w-0 rounded-xl ring-1 ring-inset ring-[var(--line)]">
      <h2 className="absolute left-[19px] top-[17px] text-lg font-bold">Cơ cấu tài chính</h2>
      <p className="absolute left-[19px] top-[43px] text-xs text-[var(--muted)]">Số dư khả dụng và khoản tạm khóa</p>
      <div
        aria-label={`Cơ cấu: khả dụng ${availablePercent}%, tạm khóa ${heldPercent}%`}
        className="absolute left-[61px] top-[81px] size-[150px] rounded-full"
        role="img"
        style={{ background: `conic-gradient(var(--accent) 0 ${availablePercent}%, var(--accent-soft) ${availablePercent}% 100%)` }}
      />
      <strong className="absolute left-[146px] top-[113px] w-12 text-center text-lg">{availablePercent}%</strong>
      <strong className="absolute left-[78px] top-[177px] w-12 text-center text-lg">{heldPercent}%</strong>
      <span className="absolute left-[257px] top-[95px] size-3 rounded-sm bg-[var(--accent)]" />
      <p className="absolute left-[279px] top-[90px] text-[13px] font-medium">Số dư khả dụng</p>
      <p className="absolute left-[279px] top-[111px] text-[13px] text-[var(--muted)]">{money(finance.availableBalanceVnd)} ({availablePercent}%)</p>
      <span className="absolute left-[257px] top-[153px] size-3 rounded-sm border border-[var(--line)] bg-[var(--accent-soft)]" />
      <p className="absolute left-[279px] top-[148px] text-[13px] font-medium">Tạm khóa đối soát</p>
      <p className="absolute left-[279px] top-[169px] text-[13px] text-[var(--muted)]">{money(finance.heldBalanceVnd)} ({heldPercent}%)</p>
      <p className="absolute left-[257px] top-[209px] text-[13px] font-bold">Tổng tài chính: {money(total)}</p>
    </article>
  );
}

export default function SellerFinancePage() {
  const [finance, setFinance] = useState<SellerFinanceSnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void api.getMe()
      .then((actor) => actor.shops[0] ? api.getSellerFinance(actor.shops[0].id) : Promise.reject())
      .then(setFinance)
      .catch(() => setError("Không tải được dữ liệu tài chính."));
  }, []);

  return (
    <SellerShell>
      <FinanceWorkspace active="overview">
        {error ? <div className="grid min-h-[420px] place-items-center text-sm text-red-600" role="alert">{error}</div> : !finance ? <div className="grid min-h-[420px] place-items-center text-sm text-[var(--muted)]">Đang tải dữ liệu tài chính...</div> : <>
        <MetricCards finance={finance} />
        {finance.unpricedOrderCount ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">Có {finance.unpricedOrderCount} đơn cũ chưa lưu hoa hồng tại thời điểm đặt hàng. Giá trị tổng hợp chưa phản ánh đủ hoa hồng của các đơn này và không phải xác nhận tiền đã về ngân hàng.</p> : null}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <RevenueTrend finance={finance} />
          <div className="grid min-h-[280px] flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
            <RevenueByProduct finance={finance} />
            <FinancialComposition finance={finance} />
          </div>
        </div>
        </>}
      </FinanceWorkspace>
    </SellerShell>
  );
}
