import Link from "next/link";
import { categoryLabels, nameInitials } from "../../../../features/commerce-data";
import { ProductCard } from "../../../../features/product-card";
import { ShopReviews } from "../../../../features/shop-reviews";
import { createPublicApiClient } from "../../../../platform/api/server";

type ShopSearchParams = Promise<{ category?: string; sort?: "newest" | "price_asc" | "price_desc" }>;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function membershipAge(createdAt?: string): string {
  if (!createdAt) return "—";
  const joined = new Date(createdAt);
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth());
  if (months < 1) return "Tháng này";
  return months < 12 ? `${months} tháng` : `${Math.floor(months / 12)} năm`;
}

export default async function ShopDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: ShopSearchParams;
}) {
  const { id } = await params;
  const query = await searchParams;
  const api = createPublicApiClient();
  const [shop, result] = await Promise.all([
    api.getPublicShop(id).catch(() => null),
    api.listPublicListings({
      shopId: id,
      category: query.category,
      sort: query.sort ?? "newest"
    }).catch(() => null)
  ]);
  const shopName = shop?.displayName ?? result?.items[0]?.shopDisplayName ?? "Cửa hàng";
  const categories = [...new Set(result?.items.map((item) => item.categoryId) ?? [])];

  return (
    <main>
      <section className="bg-white px-4 pt-6 sm:px-6">
        <div className="reboxe-container">
          <div className="grid gap-5 pb-5 lg:grid-cols-[430px_1fr] lg:gap-8">
            <div className="flex min-h-[148px] items-center gap-4 rounded-xl bg-[var(--accent-header)] p-5 text-[var(--on-accent-header)]">
              {shop?.avatarUrl ? (
                <img
                  alt={`Ảnh đại diện ${shop.displayName}`}
                  className="size-[72px] shrink-0 rounded-full bg-white object-cover"
                  decoding="async"
                  height={72}
                  src={shop.avatarUrl}
                  width={72}
                />
              ) : (
                <div className="grid size-[72px] shrink-0 place-items-center rounded-full bg-white text-[22px] font-bold text-[var(--accent)]">
                  {nameInitials(shopName)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">{shopName}</h1>
                {shop?.verified ? (
                  <p className="mt-1 text-xs font-semibold">Đã xác minh eKYC · REBOXE</p>
                ) : null}
                <p className="mt-1 text-xs">{shop ? "Đang hoạt động" : "Không thể tải thông tin cửa hàng"}</p>
                {shop?.description ? <p className="mt-1 line-clamp-2 text-xs">{shop.description}</p> : null}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 py-2 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Sản phẩm đang bán" value={shop ? String(shop.activeListingCount) : "—"} />
              <Metric label="Đánh giá" value={shop?.averageRating ? `${shop.averageRating.toFixed(1)}/5 (${shop.reviewCount})` : "Chưa có"} />
              <Metric label="Tham gia" value={membershipAge(shop?.createdAt)} />
              <Metric label="Địa chỉ kho" value={shop?.location ?? "Chưa cập nhật"} />
            </dl>
          </div>
          <ShopReviews shopId={id} />
        </div>
      </section>

      <section className="min-h-[620px] bg-[var(--paper)] px-4 pb-10 pt-5 sm:px-6">
        <div className="reboxe-container">
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-white p-4 text-xs">
            <span className="mr-1 font-medium text-[var(--muted)]">Danh mục</span>
            <Link
              className={`inline-flex min-h-10 items-center rounded-md px-3.5 py-2 font-medium ${!query.category ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--paper)]"}`}
              href={`/shops/${id}`}
            >
              Tất cả
            </Link>
            {categories.map((category) => (
              <Link
                className={`inline-flex min-h-10 items-center rounded-md px-3.5 py-2 font-medium ${query.category === category ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--paper)]"}`}
                href={`/shops/${id}?category=${encodeURIComponent(category)}`}
                key={category}
              >
                {categoryLabels[category] ?? category}
              </Link>
            ))}
            <span className="ml-auto font-medium text-[var(--muted)] max-sm:ml-0 max-sm:w-full">Sắp xếp</span>
            {[{ label: "Mới nhất", value: "newest" }, { label: "Giá tăng", value: "price_asc" }, { label: "Giá giảm", value: "price_desc" }].map((sort) => {
              const params = new URLSearchParams();
              if (query.category) params.set("category", query.category);
              params.set("sort", sort.value);
              const active = query.sort === sort.value || (!query.sort && sort.value === "newest");
              return (
                <Link
                  className={`inline-flex min-h-10 items-center rounded-md px-3.5 py-2 font-medium ${active ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--paper)]"}`}
                  href={`/shops/${id}?${params}`}
                  key={sort.value}
                >
                  {sort.label}
                </Link>
              );
            })}
          </div>

          {result === null ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-amber-900">Không thể tải sản phẩm. Vui lòng thử lại sau.</p>
          ) : result.items.length === 0 ? (
            <p className="rounded-lg border border-[var(--line)] bg-white p-8 text-center text-[var(--muted)]">Shop chưa có sản phẩm đang bán.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-3 gap-y-4 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[repeat(6,200px)]">
              {result.items.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
