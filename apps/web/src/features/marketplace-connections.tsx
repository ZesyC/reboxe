"use client";

import { marketplaceNoticeVersion, type Marketplace, type MarketplaceAvailability, type MarketplaceConnection, type MarketplaceShopChoice } from "@reboxe/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createBrowserApiClient } from "../platform/api/browser";

const api = createBrowserApiClient();
const platformNames = { SHOPEE: "Shopee", TIKTOK: "TikTok Shop" };
const labels = { CONNECTED: "Đã kết nối", REAUTH_REQUIRED: "Cần kết nối lại", DISCONNECTED: "Đã ngắt" };
export function MarketplaceConnections() {
  const [shopId, setShopId] = useState("");
  const [connections, setConnections] = useState<MarketplaceConnection[]>([]);
  const [availability, setAvailability] = useState<MarketplaceAvailability[]>([]);
  const [consent, setConsent] = useState(false);
  const [selection, setSelection] = useState<{ sessionId: string; shops: MarketplaceShopChoice[] }>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const callbackStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const actor = await api.getMe();
        const pending = sessionStorage.getItem("reboxe.marketplace.shop");
        const callback = new URL(window.location.href);
        const hasCallback = callback.searchParams.has("code") || callback.searchParams.has("error");
        const shop = hasCallback ? actor.shops.find((item) => item.id === pending) : actor.shops[0];
        if (!shop) throw new Error(hasCallback ? "Vui lòng đăng nhập đúng tài khoản đã bắt đầu kết nối." : "Bạn cần tạo shop trước khi kết nối nguồn hàng.");
        if (cancelled) return;
        setShopId(shop.id);
        const data = await api.listMarketplaceConnections(shop.id);
        if (cancelled) return;
        setConnections(data.connections); setAvailability(data.availability);
        if (hasCallback && !callbackStarted.current) {
          callbackStarted.current = true;
          // Remove authorization codes before any further navigation or resource request.
          window.history.replaceState(null, "", "/seller/connections");
          if (callback.searchParams.has("error")) throw new Error("Kết nối chưa được cấp quyền. Bạn có thể thử lại.");
          setBusy(true);
          const result = await api.completeMarketplaceAuthorization(shop.id, {
            state: callback.searchParams.get("state") ?? "", code: callback.searchParams.get("code") ?? "",
            ...(callback.searchParams.has("shop_id") ? { externalShopId: callback.searchParams.get("shop_id")! } : {})
          });
          if (!cancelled) setSelection(result);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Không thể tải kết nối.");
      } finally { if (!cancelled) { setLoading(false); setBusy(false); } }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function connect(platform: Marketplace) {
    setBusy(true); setError(undefined); setNotice(undefined);
    try {
      sessionStorage.setItem("reboxe.marketplace.shop", shopId);
      const result = await api.beginMarketplaceAuthorization(shopId, platform, marketplaceNoticeVersion);
      window.location.assign(result.authorizationUrl);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể bắt đầu kết nối."); setBusy(false); }
  }
  async function confirm(externalShopId: string) {
    if (!selection) return;
    setBusy(true); setError(undefined);
    try {
      setConnections(await api.confirmMarketplaceShop(shopId, selection.sessionId, externalShopId));
      setSelection(undefined); sessionStorage.removeItem("reboxe.marketplace.shop");
      setNotice("Đã kết nối shop. Kết nối không tự động đăng bán hàng lên REBOXE.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể lưu shop."); }
    finally { setBusy(false); }
  }
  async function disconnect(platform: Marketplace) {
    setBusy(true); setError(undefined);
    try {
      await api.disconnectMarketplace(shopId, platform);
      setConnections((await api.listMarketplaceConnections(shopId)).connections);
      setNotice("REBOXE đã xóa thông tin truy cập và dừng kết nối. Bạn cũng có thể thu hồi quyền trong cài đặt của sàn.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể ngắt kết nối."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5 rounded-xl bg-white p-6">
    <h1 className="text-2xl font-bold">Kết nối nguồn hàng</h1>
    <p>Liên kết shop để chuẩn bị nhập dữ liệu hàng hoàn. Bạn tự đăng nhập và cấp quyền trên trang chính thức của sàn.</p>
    <div className="rounded-lg border p-4 text-sm leading-6">
      <p>REBOXE sử dụng mã đơn, mã kiện, tên, phân loại, ảnh, số lượng và giá nguồn để hỗ trợ tạo bản nháp. Dữ liệu người mua trên sàn gốc không được công khai. Bạn vẫn kiểm tra và xác nhận trước khi đăng bán.</p>
      <p className="mt-2">Bạn có thể ngắt kết nối tại đây. Thông tin truy cập được mã hóa ở hệ thống; REBOXE không yêu cầu bạn gửi mật khẩu hoặc OTP cho nhân viên.</p>
      <label className="mt-3 flex items-start gap-2"><input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" /><span>Tôi đồng ý kết nối theo thông báo phiên bản {marketplaceNoticeVersion}.</span></label>
    </div>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="text-emerald-700">{notice}</p> : null}
    {loading ? <p>Đang tải...</p> : availability.map(({ platform, configured }) => {
      const connection = connections.find((item) => item.platform === platform);
      return <article className="rounded-lg border p-4" key={platform}>
        <h2 className="text-lg font-bold">{platformNames[platform]}</h2>
        {connection ? <p className="mt-2">{connection.shopName} · {labels[connection.status]}</p> : <p className="mt-2">Chưa kết nối</p>}
        {!configured ? <p className="mt-2 text-sm text-[var(--muted)]">Kênh này chưa được cấu hình. Bạn có thể nhập bản kê CSV/Excel.</p> : null}
        <div className="mt-3 flex gap-3">
          <button className="rounded bg-[var(--accent)] px-4 py-2 text-white disabled:opacity-50" disabled={!consent || !configured || busy || !shopId} onClick={() => void connect(platform)} type="button">{connection?.status === "CONNECTED" ? "Đổi kết nối" : "Kết nối shop"}</button>
          {connection && connection.status !== "DISCONNECTED" ? <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={busy} onClick={() => void disconnect(platform)} type="button">Ngắt kết nối</button> : null}
        </div>
      </article>;
    })}
    {selection ? <section className="rounded-lg border p-4"><h2 className="font-bold">Chọn shop vừa cấp quyền</h2>{selection.shops.map((shop) => <button className="m-2 rounded border px-4 py-2 disabled:opacity-50" disabled={busy} key={shop.id} onClick={() => void confirm(shop.id)} type="button">{shop.name}</button>)}</section> : null}
    <div className="flex flex-wrap gap-4 text-[var(--accent)]"><Link href="/seller/products/new">Nhập bản kê CSV/Excel</Link><Link href="/support">Nhờ REBOXE hướng dẫn kết nối</Link></div>
  </section>;
}
