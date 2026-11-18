import Link from "next/link";
import type { PublicListing } from "@reboxe/shared";
import { conditionLabels, formatPrice } from "./commerce-data";
import { ProductVisual } from "./commerce-ui";

type CatalogCardListing = Pick<PublicListing, "id" | "title" | "price" | "categoryId" | "conditionGrade" | "shopDisplayName" | "images" | "package">;

export function ProductCard({ product, sponsored = false }: { product: CatalogCardListing; sponsored?: boolean }) {
  const badgeText = product.package ? "Kiện chưa mở kiểm tra" : conditionLabels[product.conditionGrade];

  return (
    <article className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--card)] shadow-[0_3px_10px_rgba(16,40,69,0.08)] transition-transform hover:-translate-y-0.5 xl:w-[200px]">
      <div className="relative h-[184px] w-full shrink-0 overflow-hidden bg-[var(--paper)]">
        {product.images[0] ? (
          <img
            alt={product.title}
            className="size-full object-cover"
            decoding="async"
            loading="lazy"
            src={product.images[0].url}
          />
        ) : (
          <ProductVisual
            className="size-full rounded-none bg-[linear-gradient(137deg,var(--accent-strong)_14%,#7ea8df_86%)]"
            label={product.categoryId.toUpperCase()}
            labelClassName="px-4 text-center text-xl leading-normal"
          />
        )}
        <span className="absolute left-2 top-2 rounded bg-white/95 px-2 py-1 text-xs font-semibold text-[var(--accent-strong)] shadow-sm">
          {badgeText}
        </span>
        {sponsored ? (
          <span className="absolute right-2 top-2 rounded bg-slate-900/90 px-2 py-1 text-xs font-semibold text-white">
            Tài trợ
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h2 className="line-clamp-2 min-h-10 text-balance text-sm font-medium leading-5 text-[var(--ink)]">
          <Link
            aria-label={`Xem ${product.title}`}
            className="after:absolute after:inset-0 group-hover:text-[var(--accent)]"
            href={`/listings/${product.id}`}
          >
            {product.title}
          </Link>
        </h2>
        <p className="truncate text-xs font-medium text-[var(--accent)]">{product.shopDisplayName}</p>
        <div className="mt-auto pt-1">
          <strong className="whitespace-nowrap text-[17px] leading-6 tabular-nums text-[var(--accent)]">
            {formatPrice(product.price)}
          </strong>
        </div>
      </div>
    </article>
  );
}
