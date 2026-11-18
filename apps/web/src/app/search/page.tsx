import Link from "next/link";
import { ProductCard } from "../../features/product-card";
import { createPublicApiClient } from "../../platform/api/server";

type SearchParams = Promise<{ q?: string; category?: string; sort?: "newest" | "price_asc" | "price_desc"; cursor?: string }>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const result = await createPublicApiClient().listPublicListings(query).catch(() => null);
  const nextQuery = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, cursor: result?.nextCursor })) {
    if (value) nextQuery.set(key, value);
  }

  return (
    <main className="min-h-[760px] bg-[var(--paper)] px-4 py-6 sm:px-6">
      <div className="reboxe-container">
        <h1 className="sr-only">Tìm kiếm sản phẩm</h1>
        <form action="/search" className="mb-6 grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4 sm:grid-cols-[1fr_220px_180px_auto]">
          <input aria-label="Từ khóa" className="min-h-11 rounded-md border border-[var(--line-strong)] px-3 py-2 text-sm" defaultValue={query.q} name="q" placeholder="Tìm sản phẩm" type="search" />
          <input aria-label="Danh mục" className="min-h-11 rounded-md border border-[var(--line-strong)] px-3 py-2 text-sm" defaultValue={query.category} name="category" placeholder="Mã danh mục" />
          <select aria-label="Sắp xếp" className="h-11 rounded-md border border-[var(--line-strong)] bg-white pl-3 pr-10 text-sm" defaultValue={query.sort ?? "newest"} name="sort">
            <option value="newest">Mới nhất</option>
            <option value="price_asc">Giá tăng dần</option>
            <option value="price_desc">Giá giảm dần</option>
          </select>
          <button className="min-h-11 rounded-md bg-[var(--accent-strong)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--ink)]" type="submit">Tìm kiếm</button>
        </form>

        {result === null ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-center text-pretty text-amber-900" role="alert">Không thể tải kết quả. Vui lòng thử lại sau.</p>
        ) : result.items.length === 0 ? (
          <p className="rounded-lg border border-[var(--line)] bg-white p-8 text-center text-pretty text-[var(--muted)]">Không tìm thấy sản phẩm phù hợp.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-3 gap-y-4 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[repeat(6,200px)]">
              {result.items.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
            {result.nextCursor ? <Link className="mx-auto mt-8 inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--accent)] bg-white px-6 py-3 font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]" href={`/search?${nextQuery}`}>Xem thêm</Link> : null}
          </>
        )}
      </div>
    </main>
  );
}
