import { ApiClientError } from "@reboxe/api-client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartActions } from "../../../../features/cart-actions";
import { conditionLabels, formatPrice, nameInitials, sealStatusLabels } from "../../../../features/commerce-data";
import { ReboxeBadge } from "../../../../features/commerce-ui";
import { ListingGallery } from "../../../../features/listing-gallery";
import { ProductCard } from "../../../../features/product-card";
import { SiteStatus } from "../../../../features/site-status";
import { createPublicApiClient } from "../../../../platform/api/server";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 text-sm leading-5 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = createPublicApiClient();
  let listing;
  try {
    listing = await api.getPublicListing(id);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    return <SiteStatus code={502} />;
  }

  const [relatedPage, categories, shop] = await Promise.all([
    api.listPublicListings({ category: listing.categoryId }).catch(() => null),
    api.listCategories().catch(() => []),
    api.getPublicShop(listing.shopId).catch(() => null)
  ]);
  const related = relatedPage?.items.filter((item) => item.id !== listing.id).slice(0, 4) ?? [];
  const categoryName = categories.find((category) => category.id === listing.categoryId)?.name ?? listing.categoryId;
  const conditionName = listing.package ? "Kiện chưa mở kiểm tra" : conditionLabels[listing.conditionGrade];
  const shopInitials = nameInitials(listing.shopDisplayName);

  return (
    <main className="bg-[var(--paper)] px-4 pb-9 pt-5 sm:px-6">
      <div className="reboxe-container">
        <nav aria-label="Breadcrumb" className="flex min-h-9 flex-wrap items-center gap-2 text-[13px]">
          <Link className="inline-flex min-h-9 items-center font-medium text-[var(--accent-strong)] hover:underline" href="/">REBOXE</Link>
          <span aria-hidden className="text-[var(--muted)]">/</span>
          <Link className="inline-flex min-h-9 items-center font-medium text-[var(--accent-strong)] hover:underline" href={`/search?category=${encodeURIComponent(listing.categoryId)}`}>{categoryName}</Link>
          <span aria-hidden className="text-[var(--muted)]">/</span>
          <span className="truncate text-[var(--ink)]">{listing.title}</span>
        </nav>

        <section className="mt-3 grid gap-8 rounded-[10px] border border-[var(--line)] bg-white p-5 sm:p-6 xl:min-h-[500px] xl:grid-cols-[500px_1fr]">
          <ListingGallery
            fallbackLabel={categoryName.toUpperCase()}
            images={listing.images}
            title={listing.title}
          />

          <div className="flex flex-col gap-4">
            <ReboxeBadge className="w-fit">{conditionName}</ReboxeBadge>
            <h1 className="text-balance text-2xl font-semibold leading-[34px] text-[var(--ink)]">{listing.title}</h1>
            <div className="rounded-lg bg-[var(--accent-soft)] px-4 py-3.5">
              <strong className="text-[30px] leading-[42px] tabular-nums text-[var(--accent-strong)]">{formatPrice(listing.price)}</strong>
            </div>
            <dl className="grid gap-3">
              <DetailRow label="Danh mục" value={categoryName} />
              <DetailRow label={listing.package ? "Công bố kiện" : "Tình trạng"} value={conditionName} />
              <DetailRow label="Mô tả tình trạng" value={listing.conditionNotes} />
              <DetailRow label="Đăng bán lúc" value={new Date(listing.publishedAt ?? listing.createdAt).toLocaleString("vi-VN")} />
            </dl>
            {listing.package ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <strong className="text-sm font-semibold">Kiện chưa mở kiểm tra</strong>
                <p className="mt-1 text-sm">
                  Tình trạng vỏ kiện: {sealStatusLabels[listing.package.sealStatus]} · {listing.package.manifestSummary.lineCount} dòng khai báo · {listing.package.manifestSummary.unitCount} đơn vị theo bản kê nguồn
                </p>
              </div>
            ) : null}
            <CartActions available={listing.availableQuantity !== 0} listingId={listing.id} />
          </div>
        </section>

        <section className="mt-6 rounded-[10px] border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[var(--ink)]">CAM KẾT CỦA REBOXE</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink)]">
            Hỗ trợ hoàn trả 100% tiền nếu hàng hóa mở ra khác xa mô tả (khác trên 30%).
          </p>
          <div className="mt-3 rounded-lg bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--ink)]">
            <p className="font-semibold">Điều kiện để xử lý nhanh:</p>
            <p className="mt-1 text-[var(--muted)]">
              Quay video khui hộp liên tục, quay rõ nhãn niêm phong ở những giây đầu trước khi bóc. Không có video vẫn gửi được khiếu nại, nhưng sẽ xử lý thủ công và mất thời gian hơn.{" "}
              <Link className="font-medium text-[var(--accent)] underline" href="/legal/dispute-process">Xem quy trình giải quyết tranh chấp</Link>
            </p>
          </div>
        </section>

        <section className="mt-6 flex flex-wrap items-center gap-4 rounded-[10px] border border-[var(--line)] bg-white px-5 py-5 sm:px-6">
          {shop?.avatarUrl ? (
            <img alt={`Ảnh đại diện ${listing.shopDisplayName}`} className="size-14 shrink-0 rounded-full bg-[var(--paper)] object-cover" decoding="async" height={56} loading="lazy" src={shop.avatarUrl} width={56} />
          ) : (
            <div className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--accent)] font-bold text-white">{shopInitials}</div>
          )}
          <div className="min-w-0">
            <Link className="font-semibold text-[var(--ink)] hover:text-[var(--accent)] hover:underline" href={`/shops/${listing.shopId}`}>{listing.shopDisplayName}</Link>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {shop?.verified ? "Đã xác minh eKYC" : "Shop đang hoạt động"}
              {shop?.location ? ` · ${shop.location}` : ""}
            </p>
          </div>
          <Link className="ml-auto inline-flex min-h-11 items-center rounded-md border border-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]" href={`/shops/${listing.shopId}`}>
            Xem shop
          </Link>
        </section>

        <section className="mt-6 rounded-[10px] border border-[var(--line)] bg-white p-5 sm:p-6">
          <h2 className="border-b border-[var(--line)] pb-3 text-base font-semibold">MÔ TẢ SẢN PHẨM</h2>
          <p className="mt-4 max-w-[75ch] text-pretty text-sm leading-6">{listing.description ?? listing.conditionNotes}</p>
        </section>

        {listing.package ? (
          <section className="mt-6 rounded-[10px] border border-[var(--line)] bg-white p-5 sm:p-6">
            <h2 className="border-b border-[var(--line)] pb-3 text-base font-semibold">BẢN KÊ NGUỒN ĐƯỢC PHÉP HIỂN THỊ</h2>
            <p className="mt-3 text-xs text-[var(--muted)]">Thông tin khai báo từ sàn nguồn; REBOXE và người bán chưa mở kiện kiểm đếm thực tế.</p>
            <ul className="mt-4 space-y-3">
              {listing.package.lines.map((line, index) => (
                <li className="flex items-center gap-3.5 rounded-lg border border-[var(--line)] p-3.5" key={`${line.productName}-${index}`}>
                  {line.imageUrls?.[0] ? (
                    <img
                      alt={line.productName}
                      className="size-16 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--paper)] object-cover sm:size-20"
                      decoding="async"
                      loading="lazy"
                      src={line.imageUrls[0]}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <strong className="text-sm">{line.productName}</strong>
                    <p className="mt-1 text-sm text-[var(--muted)]">{line.variantName ?? "Không có phân loại"} · SL khai báo {line.quantity}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="mb-4 text-lg font-semibold">SẢN PHẨM LIÊN QUAN</h2>
          {related.length === 0 ? (
            <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">Chưa có sản phẩm liên quan trong cơ sở dữ liệu.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {related.map((item) => <ProductCard key={item.id} product={item} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
