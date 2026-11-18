"use client";

import { ApiClientError } from "@reboxe/api-client";
import type { ShopReview, ShopReviewEligibility } from "@reboxe/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createBrowserApiClient } from "../platform/api/browser";

const api = createBrowserApiClient();

export function ShopReviews({ shopId }: { shopId: string }) {
  const router = useRouter();
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [eligibility, setEligibility] = useState<ShopReviewEligibility | null>();
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setRating(5);
    setContent("");
    setEditing(false);
    setLoading(true);
    setEligibility(undefined);
    setError("");
    void Promise.all([
      api.listShopReviews(shopId),
      api.getMyShopReview(shopId).catch((cause: unknown) => {
        if (cause instanceof ApiClientError && cause.status === 401) return null;
        throw cause;
      }),
      api.getShopReviewEligibility(shopId).catch((cause: unknown) => {
        if (cause instanceof ApiClientError && cause.status === 401) return null;
        throw cause;
      })
    ]).then(([items, mine, result]) => {
      if (!active) return;
      setError("");
      setReviews(items);
      setEligibility(result);
      if (mine) {
        setRating(mine.rating);
        setContent(mine.content);
        setEditing(true);
      }
    }).catch(() => {
      if (active) setError("Không thể tải đánh giá của shop.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [shopId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.upsertShopReview(shopId, { rating, content });
      setReviews(await api.listShopReviews(shopId));
      setEditing(true);
      router.refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.code === "REVIEW_NOT_ELIGIBLE") {
        setEligibility({ eligible: false, reason: "COMPLETED_ORDER_REQUIRED" });
      } else if (cause instanceof ApiClientError && cause.status === 401) {
        setEligibility(null);
      } else if (cause instanceof ApiClientError && cause.status === 403) {
        setEligibility({ eligible: false, reason: "SHOP_MEMBER" });
      } else {
        setError("Không thể lưu đánh giá. Vui lòng thử lại.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-[10px] border border-[var(--line)] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold">ĐÁNH GIÁ SHOP</h2>
      {eligibility?.eligible ? <form className="mt-4 grid gap-3 border-b border-[var(--line)] pb-6" onSubmit={submit}>
        <div aria-label="Số sao" className="flex gap-1" role="group">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              aria-label={`${star} sao`}
              aria-pressed={rating === star}
              className={`grid size-11 place-items-center rounded-md text-2xl transition-colors hover:bg-[var(--paper)] ${star <= rating ? "text-amber-500" : "text-slate-400"}`}
              key={star}
              onClick={() => setRating(star)}
              type="button"
            >★</button>
          ))}
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-[var(--ink)]">
          <span>Nhận xét của bạn</span>
          <textarea
            className="min-h-24 rounded-md border border-[var(--line-strong)] p-3 text-sm font-normal focus:border-[var(--accent)]"
            maxLength={1000}
            minLength={3}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Chia sẻ trải nghiệm của bạn về shop"
            required
            value={content}
          />
        </label>
        <div className="flex items-center gap-3">
          <button className="min-h-11 rounded-md bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--ink)] disabled:opacity-60" disabled={saving} type="submit">
            {saving ? "Đang lưu..." : editing ? "Cập nhật đánh giá" : "Gửi đánh giá"}
          </button>
          {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
        </div>
      </form> : eligibility === null
        ? <p className="mt-4 border-b border-[var(--line)] pb-6 text-sm">Bạn cần <Link className="font-medium text-[var(--accent)] underline" href="/login">đăng nhập</Link> để đánh giá shop.</p>
        : eligibility?.reason === "SHOP_MEMBER"
          ? <p className="mt-4 border-b border-[var(--line)] pb-6 text-sm">Thành viên không thể tự đánh giá shop của mình.</p>
          : eligibility?.reason === "COMPLETED_ORDER_REQUIRED"
            ? <p className="mt-4 border-b border-[var(--line)] pb-6 text-sm">Bạn cần hoàn thành một đơn hàng từ shop này để đánh giá.</p>
            : null}
      {error && !eligibility?.eligible ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}

      <div className="mt-5 grid gap-4">
        {loading ? <p className="text-sm text-[var(--muted)]">Đang tải đánh giá...</p>
          : reviews.length === 0 ? <p className="text-sm text-[var(--muted)]">Shop chưa có đánh giá.</p>
            : reviews.map((review) => (
              <article className="border-b border-[var(--line)] pb-4 last:border-b-0" key={review.id}>
                <div className="flex items-center gap-3">
                  <strong className="text-sm">Người dùng REBOXE</strong>
                  <span aria-label={`${review.rating} trên 5 sao`} className="text-amber-500">{"★".repeat(review.rating)}<span className="text-slate-300">{"★".repeat(5 - review.rating)}</span></span>
                  <time className="ml-auto text-xs text-[var(--muted)]" dateTime={review.updatedAt}>{new Date(review.updatedAt).toLocaleDateString("vi-VN")}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{review.content}</p>
              </article>
            ))}
      </div>
    </section>
  );
}
