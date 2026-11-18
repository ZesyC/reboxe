"use client";

import type { PublicListing } from "@reboxe/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readCart, writeCart } from "../../features/cart-storage";
import { conditionLabels, formatPrice } from "../../features/commerce-data";
import { ProductVisual } from "../../features/commerce-ui";
import { createBrowserApiClient } from "../../platform/api/browser";

type CartItem = { listing: PublicListing; quantity: number };

const api = createBrowserApiClient();

function SelectionRadio({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-[var(--paper)]">
      <input aria-label={label} checked={checked} className="size-[18px] accent-[var(--accent)]" name="cart-selection" onChange={onChange} type="radio" />
    </label>
  );
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lines = readCart();
    void Promise.all(lines.map(async (line) => {
      try {
        return { listing: await api.getPublicListing(line.listingId), quantity: line.quantity };
      } catch {
        return null;
      }
    })).then((resolved) => {
      const available = resolved.filter((item): item is CartItem => item !== null);
      setItems(available);
      setSelectedId(available[0]?.listing.id ?? null);
      writeCart(available.map((item) => ({ listingId: item.listing.id, quantity: item.quantity })));
      setLoading(false);
    });
  }, []);

  const total = items.find((item) => item.listing.id === selectedId)?.listing.price ?? 0;

  function persist(nextItems: CartItem[]) {
    setItems(nextItems);
    writeCart(nextItems.map((item) => ({ listingId: item.listing.id, quantity: item.quantity })));
  }

  function removeItem(listingId: string) {
    persist(items.filter((item) => item.listing.id !== listingId));
    setSelectedId((current) => current === listingId ? null : current);
  }

  const checkoutHref = selectedId
    ? `/checkout?items=${encodeURIComponent(selectedId)}`
    : "/cart";

  return (
    <main className="min-h-[calc(100vh-132px)] bg-[var(--paper)] px-4 pb-36 pt-5 sm:px-6">
      <div className="reboxe-container">
        <h1 className="mb-4 text-xl font-semibold text-[var(--ink)]">Giỏ hàng</h1>
        {loading ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-8 text-center text-[var(--muted)]" role="status">Đang tải giỏ hàng...</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-[var(--line)] bg-white p-10 text-center">
            <p className="text-[var(--muted)]">Giỏ hàng chưa có sản phẩm.</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-md bg-[var(--accent-strong)] px-5 py-3 font-medium text-white hover:bg-[var(--ink)]" href="/">Xem sản phẩm</Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map(({ listing }) => (
              <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-[0_3px_10px_rgba(16,40,69,0.08)]" key={listing.id}>
                <div className="mb-4 flex items-center gap-2 border-b border-[var(--line)] pb-3">
                  <SelectionRadio checked={selectedId === listing.id} label={`Chọn ${listing.title}`} onChange={() => setSelectedId(listing.id)} />
                  <Link className="inline-flex min-h-11 items-center font-medium hover:text-[var(--accent)] hover:underline" href={`/shops/${listing.shopId}`}>{listing.shopDisplayName}</Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                  <ProductVisual className="size-24 bg-[var(--accent-header)] text-sm" label={listing.categoryId.toUpperCase()} src={listing.images[0]?.url} />
                  <div className="min-w-0">
                    <Link className="font-medium text-[var(--ink)] hover:text-[var(--accent)] hover:underline" href={`/listings/${listing.id}`}>{listing.title}</Link>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {listing.package ? "Kiện chưa mở kiểm tra" : `Tình trạng: ${conditionLabels[listing.conditionGrade]}`}
                    </p>
                    <strong className="mt-2 block tabular-nums text-[var(--accent)]">{formatPrice(listing.price)}</strong>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-[var(--muted)]">Số lượng: 1</span>
                    <strong className="w-28 text-right tabular-nums text-[var(--accent)]">{formatPrice(listing.price)}</strong>
                    <button
                      aria-label={`Xóa ${listing.title} khỏi giỏ hàng`}
                      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-[var(--danger)] hover:bg-red-50"
                      onClick={() => removeItem(listing.id)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {items.length > 0 ? (
          <aside className="fixed bottom-0 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-[1264px] -translate-x-1/2 flex-wrap items-center gap-4 rounded-t-lg border border-[var(--line)] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-2px_10px_rgba(16,40,69,0.08)]">
            <span className="text-sm">{selectedId ? "Đã chọn 1 sản phẩm" : "Chọn một sản phẩm để mua"}</span>
            <div className="ml-auto text-right">
              <span className="text-sm">Tổng cộng: </span>
              <strong className="text-xl tabular-nums text-[var(--accent)]">{formatPrice(total)}</strong>
            </div>
            <Link
              aria-disabled={!selectedId}
              className={`grid min-h-11 w-full place-items-center rounded-md px-5 font-medium text-white sm:w-48 ${!selectedId ? "pointer-events-none bg-slate-500" : "bg-[var(--accent-strong)] hover:bg-[var(--ink)]"}`}
              href={checkoutHref}
            >
              Mua hàng
            </Link>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
