"use client";

import { ApiClientError } from "@reboxe/api-client";
import { createAccountAddressSchema, type CheckoutQuote, type CommerceOrder, type PublicListing } from "@reboxe/shared";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserApiClient } from "../../platform/api/browser";
import { readCart, writeCart } from "../cart-storage";
import { confirmSandboxOrder } from "../checkout-session";
import { formatPrice } from "../commerce-data";

const api = createBrowserApiClient();
const fields = [
  { key: "recipientName", label: "Họ và tên", question: "Bạn cho mình xin họ và tên người nhận hàng nhé.", autoComplete: "shipping name", max: 120 },
  { key: "phone", label: "Số điện thoại", question: "Người giao hàng có thể gọi số điện thoại nào?", autoComplete: "shipping tel-national", max: 20 },
  { key: "addressLine", label: "Số nhà và tên đường", question: "Bạn cho mình xin số nhà, tên đường hoặc tên thôn, xóm nhé.", autoComplete: "shipping address-line1", max: 250 },
  { key: "ward", label: "Phường hoặc xã", question: "Địa chỉ nhận hàng ở phường hoặc xã nào?", autoComplete: "shipping address-level3", max: 100 },
  { key: "district", label: "Quận hoặc huyện", question: "Bạn cho mình xin quận hoặc huyện theo địa chỉ giao hàng nhé.", autoComplete: "shipping address-level2", max: 100 },
  { key: "province", label: "Tỉnh hoặc thành phố", question: "Bạn nhận hàng ở tỉnh hoặc thành phố nào?", autoComplete: "shipping address-level1", max: 100 }
] as const;

const primary = "inline-flex min-h-12 items-center justify-center rounded-lg bg-[var(--accent-strong)] px-5 py-2.5 font-semibold text-white hover:bg-[var(--ink)] disabled:opacity-50";
const secondary = "min-h-11 text-left font-medium text-[var(--accent-strong)] underline underline-offset-2 disabled:opacity-50";
const bubble = "w-fit rounded-xl rounded-bl-sm border border-[var(--line)] bg-white px-4 py-3 text-xl leading-relaxed";

function loginUrl(listingId: string) {
  return `/login?next=${encodeURIComponent(`/shopping-chat?listing=${encodeURIComponent(listingId)}`)}`;
}

export function ShoppingCheckout({ listing, onBack }: { listing: PublicListing; onBack: (purchased: boolean) => void }) {
  const [ready, setReady] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({ recipientName: "", phone: "", addressLine: "", ward: "", district: "", province: "" });
  const [review, setReview] = useState<{ addressId: string; quote: CheckoutQuote }>();
  const [order, setOrder] = useState<CommerceOrder>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"quote" | "order">();
  const requestActive = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const field = fields[step];

  useEffect(() => {
    let active = true;
    void api.listAccountAddresses().then((addresses) => {
      if (!active) return;
      const saved = addresses.find((address) => address.isDefault) ?? addresses[0];
      if (saved) {
        setDetails({
          recipientName: saved.recipientName,
          phone: saved.phone,
          addressLine: saved.addressLine,
          ward: saved.ward,
          district: saved.district,
          province: saved.province
        });
        setStep(fields.length);
      }
      setReady(true);
    }).catch((error) => {
      if (!active) return;
      if (error instanceof ApiClientError && error.status === 401) setSignIn(true);
      else setError("Chưa thể mở thông tin giao hàng. Bạn vui lòng thử lại.");
    });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    if (ready && field) input.current?.focus();
  }, [ready, field]);

  function nextField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!field) return;
    const value = field.key === "phone" ? details.phone.replace(/[ .-]/g, "").replace(/^\+84/, "0") : details[field.key];
    const parsed = createAccountAddressSchema.shape[field.key].safeParse(value);
    if (!parsed.success) {
      setError(field.key === "phone" ? "Bạn nhập 10 chữ số bắt đầu bằng 0, ví dụ 0901234567." : `Bạn vui lòng nhập đầy đủ ${field.label.toLowerCase()}.`);
      return;
    }
    setDetails({ ...details, [field.key]: parsed.data });
    setError("");
    setStep(step + 1);
  }

  async function getQuote() {
    if (requestActive.current) return;
    requestActive.current = true;
    setBusy("quote");
    setError("");
    try {
      const available = await api.listAccountAddresses();
      const existing = available.find((address) => fields.every(({ key }) => details[key] === address[key]));
      const address = existing ?? await api.createAccountAddress({ ...details, label: "Địa chỉ giao hàng", isDefault: false });
      const quote = await api.quoteCheckout({ items: [{ listingId: listing.id, quantity: 1 }], addressId: address.id });
      setReview({ addressId: address.id, quote });
    } catch (error) {
      showCheckoutError(error, "Chưa thể tính tổng tiền. Bạn vui lòng thử lại.");
    } finally {
      requestActive.current = false;
      setBusy(undefined);
    }
  }

  async function placeOrder() {
    if (!review || requestActive.current) return;
    requestActive.current = true;
    setBusy("order");
    setError("");
    try {
      const result = await confirmSandboxOrder(api, listing.id, review.addressId, review.quote);
      if (result.quote) {
        setReview({ ...review, quote: result.quote });
        setError("Giá đã thay đổi. Bạn kiểm tra tổng tiền mới rồi bấm xác nhận lại nhé.");
        return;
      }
      setOrder(result.order);
      const cart = readCart();
      const remaining = cart.filter((line) => line.listingId !== listing.id);
      if (remaining.length < cart.length) writeCart(remaining);
    } catch (error) {
      showCheckoutError(error, "Chưa thể xác nhận đơn hàng. Bạn có thể bấm xác nhận lại để kiểm tra.");
    } finally {
      requestActive.current = false;
      setBusy(undefined);
    }
  }

  function showCheckoutError(error: unknown, fallback: string) {
    if (error instanceof ApiClientError && error.status === 401) {
      setSignIn(true);
    } else if (error instanceof ApiClientError && ["ITEM_SOLD", "ITEM_BEING_PURCHASED", "SHOP_UNAVAILABLE"].includes(error.code)) {
      setError("Kiện này hiện không thể đặt. Bạn có thể quay lại để chọn kiện khác.");
    } else {
      setError(error instanceof Error && !(error instanceof ApiClientError) && error.message.startsWith("Lượt giữ hàng")
        ? error.message : fallback);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-xl">Bạn đã chọn <strong className="break-words">{listing.title}</strong>{order ? "." : ` · ${formatPrice(listing.price)}`}</p>
      {order ? (
        <div className="grid gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-950" role="status">
          <p className="text-xl font-bold">Đã đặt đơn mô phỏng</p>
          <p className="break-all">Mã đơn hàng {order.id}</p>
          <Link className={`${primary} justify-self-start`} href={`/account/orders/${order.id}`}>Xem đơn hàng</Link>
        </div>
      ) : signIn ? (
        <>
          <p className={bubble}>Bạn hãy đăng nhập để tiếp tục đặt kiện này.</p>
          <Link className={`${primary} justify-self-start`} href={loginUrl(listing.id)}>Đăng nhập để đặt hàng</Link>
        </>
      ) : !ready ? (
        error ? <button className={`${primary} justify-self-start`} onClick={() => {
          setError("");
          setLoadAttempt(loadAttempt + 1);
        }} type="button">Thử lại</button> : <p className={bubble} role="status">Đang mở thông tin giao hàng…</p>
      ) : field ? (
        <>
          <p className={bubble} id="shipping-question">{field.question}</p>
          <form className="grid gap-2" onSubmit={nextField}>
            <label className="font-semibold" htmlFor="shipping-answer">{field.label}</label>
            <div className="flex flex-wrap gap-2">
              <input
                aria-describedby="shipping-question" autoComplete={field.autoComplete}
                className="min-h-12 min-w-0 flex-1 basis-48 rounded-lg border border-[var(--line-strong)] bg-white px-3 text-xl"
                id="shipping-answer" key={field.key} maxLength={field.max} onChange={(event) => setDetails({ ...details, [field.key]: event.target.value })}
                ref={input} required type={field.key === "phone" ? "tel" : "text"} value={details[field.key]}
              />
              <button className={primary} type="submit">Tiếp tục</button>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className={bubble} aria-live="polite">{review ? "Bạn kiểm tra địa chỉ và tổng tiền trước khi xác nhận đặt hàng nhé." : "Bạn kiểm tra thông tin nhận hàng giúp mình nhé."}</p>
          <section aria-label="Thông tin nhận hàng" className="grid gap-1 break-words rounded-xl bg-white p-4">
            <p className="font-semibold">{details.recipientName} · {details.phone}</p>
            <p>{details.addressLine}, {details.ward}, {details.district}, {details.province}</p>
          </section>
          {review ? (
            <>
              <dl className="grid gap-2 tabular-nums">
                <div className="flex justify-between gap-2"><dt>Tiền hàng</dt><dd>{formatPrice(review.quote.subtotalVnd)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Phí vận chuyển</dt><dd>{formatPrice(review.quote.shippingVnd)}</dd></div>
                <div className="flex justify-between gap-2 border-t border-[var(--line)] pt-2 text-xl font-bold"><dt>Tổng tiền</dt><dd>{formatPrice(review.quote.totalVnd)}</dd></div>
              </dl>
              <p className="text-[var(--muted)]">Thanh toán khi nhận hàng (COD) mô phỏng. Đơn thử nghiệm không phát sinh thu tiền hoặc giao hàng thật.</p>
            </>
          ) : <p className="text-[var(--muted)]">Địa chỉ được lưu vào tài khoản khi bạn bấm Xem tổng tiền.</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {review ? (
              <button className={primary} disabled={!!busy} onClick={() => void placeOrder()} type="button">{busy ? "Đang đặt hàng…" : "Xác nhận đặt hàng"}</button>
            ) : (
              <button className={primary} disabled={!!busy} onClick={() => void getQuote()} type="button">{busy ? "Đang tính tổng tiền…" : "Xem tổng tiền"}</button>
            )}
            <button className={secondary} disabled={!!busy} onClick={() => {
              setReview(undefined);
              setError("");
              setStep(0);
            }} type="button">Sửa thông tin nhận hàng</button>
          </div>
        </>
      )}
      {error && <p className="font-medium text-[var(--danger)]" role="alert">{error}</p>}
      <button className={`${secondary} justify-self-start`} disabled={!!busy} onClick={() => onBack(Boolean(order))} type="button">{order ? "Tìm món khác" : "Quay lại tìm hàng"}</button>
    </div>
  );
}
