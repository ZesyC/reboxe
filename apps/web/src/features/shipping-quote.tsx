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
    void Promise.all([api.getMe(), api.getCarrierLocations("provinces")]).then(([actor, locations]) => {
      if (active) { setShops(actor.shops); setShopId(actor.shops[0]?.id ?? ""); setProvinces(locations); }
    }).catch((caught: unknown) => { if (active) setError(message(caught)); });
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
  return <section className="grid max-w-2xl gap-5 rounded-xl bg-white p-6">
    <h1 className="text-2xl font-bold">Ước tính phí vận chuyển GHN</h1>
    <p>Phí dựa trên kiện hàng và điểm lấy hàng đã cấu hình của shop. Kết quả chưa tạo vận đơn và chưa thu phí.</p>
    <form className="grid gap-4" onChange={() => setQuote(undefined)} onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(undefined);
      try { setQuote(await api.quoteShipping(shopId, listingId.trim(), Number(district), ward)); }
      catch (caught) { setError(message(caught)); } finally { setBusy(false); }
    }}>
      <label>Shop<select className="block w-full rounded border p-2" required value={shopId} onChange={(event) => setShopId(event.target.value)}>
        <option value="">Chọn shop</option>{shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.displayName}</option>)}
      </select></label>
      <label>Mã tin đăng<input className="block w-full rounded border p-2" required value={listingId} onChange={(event) => setListingId(event.target.value)} /></label>
      <label>Tỉnh / thành nhận hàng<select className="block w-full rounded border p-2" required value={province} onChange={(event) => {
        setProvince(event.target.value); setDistrict(""); setWard(""); setDistricts([]); setWards([]);
      }}><option value="">Chọn tỉnh / thành</option>{provinces.map(option)}</select></label>
      <label>Quận / huyện<select className="block w-full rounded border p-2" required value={district} onChange={(event) => {
        setDistrict(event.target.value); setWard(""); setWards([]);
      }}><option value="">Chọn quận / huyện</option>{districts.map(option)}</select></label>
      <label>Phường / xã<select className="block w-full rounded border p-2" required value={ward} onChange={(event) => setWard(event.target.value)}>
        <option value="">Chọn phường / xã</option>{wards.map(option)}</select></label>
      <button className="rounded bg-[var(--accent)] p-3 text-white disabled:opacity-50" disabled={busy || !shopId || !ward} type="submit">{busy ? "Đang lấy phí…" : "Lấy phí vận chuyển"}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {quote && <p role="status">Phí ước tính: {quote.feeVnd.toLocaleString("vi-VN")} ₫ {quote.environment === "STAGING" ? "(môi trường thử nghiệm GHN)" : ""}. Báo giá lúc {new Date(quote.quotedAt).toLocaleString("vi-VN")}.</p>}
  </section>;
}
function option(location: CarrierLocation) { return <option key={location.id} value={location.id}>{location.name}</option>; }
function message(caught: unknown) { return caught instanceof Error ? caught.message : "Không thể kết nối dịch vụ vận chuyển."; }
