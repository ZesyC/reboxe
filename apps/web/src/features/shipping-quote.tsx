"use client";

import { useEffect, useState } from "react";
import type { CarrierLocation, CarrierQuote } from "@reboxe/shared";
import { createBrowserApiClient } from "../platform/api/browser";

const api = createBrowserApiClient();
export function ShippingQuote() {
  const [shops, setShops] = useState<Array<{ id: string; displayName: string }>>([]);
  const [shopId, setShopId] = useState("");
  const [listingId, setListingId] = useState("");
  const [provinces, setProvinces] = useState<CarrierLocation[]>([]);
  const [districts, setDistricts] = useState<CarrierLocation[]>([]);
  const [wards, setWards] = useState<CarrierLocation[]>([]);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [quote, setQuote] = useState<CarrierQuote>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void Promise.allSettled([api.getMe(), api.getCarrierLocations("provinces")]).then(([meResult, locationResult]) => {
      if (!active) return;
      if (meResult.status === "fulfilled") {
        setShops(meResult.value.shops);
        setShopId(meResult.value.shops[0]?.id ?? "");
      }
      if (locationResult.status === "fulfilled") {
        setProvinces(locationResult.value);
      } else if (meResult.status === "rejected") {
        setError(message(meResult.reason));
      } else {
        setError(message(locationResult.reason));
      }
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    if (province) void api.getCarrierLocations("districts", province).then((rows) => { if (active) setDistricts(rows); })
      .catch((caught: unknown) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [province]);
  useEffect(() => {
    let active = true;
    if (district) void api.getCarrierLocations("wards", district).then((rows) => { if (active) setWards(rows); })
      .catch((caught: unknown) => { if (active) setError(message(caught)); });
    return () => { active = false; };
  }, [district]);
  return <section className="grid max-w-2xl gap-5 rounded-xl border border-[var(--line)] bg-white p-5 sm:p-6">
    <h1 className="text-2xl font-bold text-balance">Ước tính phí vận chuyển GHN</h1>
    <p className="text-sm leading-6 text-[var(--muted)]">Phí dựa trên kiện hàng và điểm lấy hàng đã cấu hình của shop. Kết quả chưa tạo vận đơn và chưa thu phí.</p>
    <form className="grid gap-4" onChange={() => setQuote(undefined)} onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(undefined);
      try { setQuote(await api.quoteShipping(shopId, listingId.trim(), Number(district), ward)); }
      catch (caught) { setError(message(caught)); } finally { setBusy(false); }
    }}>
      <label className="grid gap-1.5 text-sm font-semibold"><span>Shop</span><select className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-white pl-3 pr-10 text-sm font-normal" required value={shopId} onChange={(event) => setShopId(event.target.value)}>
        <option value="">Chọn shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.displayName}</option>)}
      </select></label>
      <label className="grid gap-1.5 text-sm font-semibold"><span>Mã tin đăng</span><input className="block h-11 w-full rounded-lg border border-[var(--line-strong)] px-3 text-sm font-normal" required value={listingId} onChange={(event) => setListingId(event.target.value)} /></label>
      <label className="grid gap-1.5 text-sm font-semibold"><span>Tỉnh / thành nhận hàng</span><select className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-white pl-3 pr-10 text-sm font-normal" required value={province} onChange={(event) => {
        setProvince(event.target.value); setDistrict(""); setWard(""); setDistricts([]); setWards([]);
      }}><option value="">Chọn tỉnh / thành</option>{provinces.map(option)}</select></label>
      <label className="grid gap-1.5 text-sm font-semibold"><span>Quận / huyện</span><select className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-white pl-3 pr-10 text-sm font-normal" required value={district} onChange={(event) => {
        setDistrict(event.target.value); setWard(""); setWards([]);
      }}><option value="">Chọn quận / huyện</option>{districts.map(option)}</select></label>
      <label className="grid gap-1.5 text-sm font-semibold"><span>Phường / xã</span><select className="h-11 w-full rounded-lg border border-[var(--line-strong)] bg-white pl-3 pr-10 text-sm font-normal" required value={ward} onChange={(event) => setWard(event.target.value)}>
        <option value="">Chọn phường / xã</option>{wards.map(option)}</select></label>
      <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50" disabled={busy || !shopId || !ward} type="submit">{busy ? "Đang lấy phí…" : "Lấy phí vận chuyển"}</button>
    </form>
    {error && <p className="text-sm font-medium text-[var(--danger)]" role="alert">{error}</p>}
    {quote && <p className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4 text-sm font-medium tabular-nums" role="status">Phí ước tính: {quote.feeVnd.toLocaleString("vi-VN")} ₫ {quote.environment === "STAGING" ? "(môi trường thử nghiệm GHN)" : ""}. Báo giá lúc {new Date(quote.quotedAt).toLocaleString("vi-VN")}.</p>}
  </section>;
}
function option(location: CarrierLocation) { return <option key={location.id} value={location.id}>{location.name}</option>; }
function message(caught: unknown) {
  if (caught instanceof Error) {
    if (/not been configured|not configured/i.test(caught.message)) return "Dịch vụ vận chuyển GHN chưa được cấu hình trên môi trường này.";
    if (/access token|auth|401/i.test(caught.message)) return "Vui lòng đăng nhập tài khoản người bán để ước tính phí vận chuyển.";
    return caught.message;
  }
  return "Không thể kết nối dịch vụ vận chuyển.";
}
