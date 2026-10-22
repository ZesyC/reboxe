"use client";

import { ApiClientError } from "@reboxe/api-client";
import type { ActorContext, Listing, PromotionOverview } from "@reboxe/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";

const api = createBrowserApiClient();

export function SellerPromotions() {
  const [actor, setActor] = useState<ActorContext>();
  const [listings, setListings] = useState<Listing[]>([]);
  const [overview, setOverview] = useState<PromotionOverview>({ creditVnd: 0, campaigns: [] });
  const [action, setAction] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [paymentOptions, setPaymentOptions] = useState({ payosPromotionPayments: false, sandboxPromotions: false });

  useEffect(() => {
    void api.getMe().then(async (nextActor) => {
      setActor(nextActor);
      const shop = nextActor.shops[0];
      if (!shop) return;
      const [nextListings, nextOverview, options] = await Promise.all([
        api.listShopListings(shop.id),
        api.getPromotionOverview(shop.id),
        api.getPaymentOptions()
      ]);
      setPaymentOptions(options);
      setListings(nextListings.filter((listing) => listing.status === "ACTIVE"));
      setOverview(nextOverview);
    }).catch(() => setError("Không tải được dữ liệu quảng bá."));
  }, []);

  const shop = actor?.shops[0];

  async function addCredit() {
    if (!shop) return;
    setAction("credit"); setError(undefined); setMessage(undefined);
    try {
      if (paymentOptions.payosPromotionPayments) {
        const storageKey = `reboxe.promotion.topup.${shop.id}`;
        let saved: { key: string; id?: string } | undefined;
        try { saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null") ?? undefined; } catch { /* Reset malformed browser state. */ }
        if (!saved?.key) saved = { key: crypto.randomUUID() };
        sessionStorage.setItem(storageKey, JSON.stringify(saved));
        const result = saved.id ? await api.getPromotionTopup(shop.id, saved.id) : await api.createPromotionTopup(shop.id, 100_000, saved.key);
        sessionStorage.setItem(storageKey, JSON.stringify({ ...saved, id: result.id }));
        if (result.status === "PAID") {
          setOverview(await api.getPromotionOverview(shop.id)); sessionStorage.removeItem(storageKey);
          setMessage("Đã ghi nhận thanh toán vào số dư quảng bá.");
        } else if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
        else if (["CANCELLED", "EXPIRED"].includes(result.status)) {
          sessionStorage.removeItem(storageKey); setMessage("Yêu cầu nạp đã kết thúc. Bạn có thể tạo yêu cầu mới.");
        } else if (result.status === "BLOCKED") setError("Kênh nhận tiền chưa khớp cấu hình. Yêu cầu đã bị chặn; vui lòng liên hệ hỗ trợ để kiểm tra.");
        else setMessage("Yêu cầu nạp đang được xác minh. Bấm lại để kiểm tra; không chuyển tiền thêm khi chưa rõ kết quả.");
      } else if (paymentOptions.sandboxPromotions) {
        setOverview(await api.seedPromotionCredit(shop.id, crypto.randomUUID()));
        setMessage("Đã thêm 100.000đ mô phỏng. Không phát sinh giao dịch ngân hàng.");
      }
    } catch { setError("Chưa xác định được kết quả nạp. Vui lòng thử kiểm tra lại yêu cầu hiện tại."); }
    finally { setAction(undefined); }
  }

  async function sponsor(listing: Listing) {
    if (!shop || !window.confirm(`Tài trợ “${listing.title}” trong 7 ngày với giá 20.000đ?`)) return;
    setAction(listing.id); setError(undefined); setMessage(undefined);
    try {
      const campaign = await api.sponsorListing(shop.id, listing.id, crypto.randomUUID());
      setOverview((current) => ({ creditVnd: current.creditVnd - campaign.feeVnd, campaigns: [...current.campaigns, campaign] }));
      setMessage("Sản phẩm đã được đưa vào hàng đầu của Gợi ý hôm nay.");
    } catch (caught) {
      setError(caught instanceof ApiClientError && caught.code === "INSUFFICIENT_PROMOTION_CREDIT"
        ? "Số dư quảng bá không đủ. Hãy nạp thêm trước khi tài trợ."
        : caught instanceof ApiClientError && caught.code === "PROMOTION_SLOTS_FULL"
          ? "Sáu vị trí tài trợ hiện đã kín. Vui lòng thử lại sau."
          : "Không thể tài trợ sản phẩm này.");
    } finally { setAction(undefined); }
  }

  if (!actor && !error) return <p className="rounded-xl bg-white p-6 text-sm text-[var(--muted)]">Đang tải quảng bá...</p>;
  if (!shop) return <p className="rounded-xl bg-white p-6 text-sm">Bạn cần có shop để quảng bá sản phẩm.</p>;

  return (
    <section className="min-h-[calc(100vh-100px)] rounded-xl border border-[var(--line)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
        <div><h1 className="text-[22px] font-bold text-[var(--ink)]">Quảng Bá Sản Phẩm</h1><p className="mt-1 text-sm text-[var(--muted)]">Đưa sản phẩm vào hàng đầu của Gợi ý hôm nay trong 7 ngày.</p></div>
        <div className="text-right"><p className="text-xs text-[var(--muted)]">Số dư quảng bá</p><strong className="text-xl text-[var(--accent)]">{overview.creditVnd.toLocaleString("vi-VN")}đ</strong><button className="ml-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={action === "credit" || (!paymentOptions.payosPromotionPayments && !paymentOptions.sandboxPromotions)} onClick={() => void addCredit()} type="button">{action === "credit" ? "Đang kiểm tra..." : paymentOptions.payosPromotionPayments ? "Nạp / kiểm tra 100.000đ" : paymentOptions.sandboxPromotions ? "Nạp mô phỏng 100.000đ" : "Chưa mở nạp"}</button></div>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">{error}</p> : null}
      {message ? <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{message}</p> : null}

      <div className="mt-5 grid gap-3">
        {listings.length === 0 ? <p className="rounded-lg bg-[var(--paper)] p-6 text-center text-sm text-[var(--muted)]">Chưa có sản phẩm đang bán để quảng bá.</p> : listings.map((listing) => {
          const campaign = overview.campaigns.find((item) => item.listingId === listing.id);
          return <article className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--line)] p-4" key={listing.id}>
            <div className="flex min-w-0 items-center gap-3">{listing.images[0] ? <img alt="" className="size-14 rounded-lg object-cover" src={listing.images[0].url} /> : null}<div className="min-w-0"><h2 className="truncate font-bold">{listing.title}</h2><p className="mt-1 text-xs text-[var(--muted)]">{listing.price.toLocaleString("vi-VN")}đ · Gói 20.000đ/7 ngày</p></div></div>
            <div className="flex items-center gap-4">{campaign ? <span className="text-sm font-bold text-emerald-700">Đang tài trợ đến {new Date(campaign.endsAt).toLocaleDateString("vi-VN")}</span> : <button className="rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent)] disabled:opacity-50" disabled={action === listing.id} onClick={() => void sponsor(listing)} type="button">{action === listing.id ? "Đang xử lý..." : "Tài trợ 20.000đ"}</button>}<Link className="text-sm text-[var(--accent)]" href={`/listings/${listing.id}`}>Xem</Link></div>
          </article>;
        })}
      </div>
    </section>
  );
}
