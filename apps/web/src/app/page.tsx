import { ProductCard } from "../features/product-card";
import { SiteStatus } from "../features/site-status";
import { createPublicApiClient } from "../platform/api/server";

export default async function HomePage() {
  const result = await createPublicApiClient().listPublicListings().catch(() => null);
  if (result === null) return <SiteStatus code={502} />;
  const sponsored = result.sponsored ?? [];

  return (
    <main>
      <section className="bg-white px-4 pt-5 sm:px-6">
        <div className="reboxe-container text-center">
          <h1 className="text-lg font-semibold leading-6 text-[var(--accent)]">GỢI Ý HÔM NAY</h1>
          <div className="mt-4 h-1 w-full rounded-sm bg-[var(--accent)]" />
        </div>
      </section>
      <section className="min-h-[760px] bg-[var(--paper)] px-4 pb-8 pt-5 sm:px-6">
        {sponsored.length === 0 && result.items.length === 0 ? (
          <p className="reboxe-container rounded-lg border border-[var(--line)] bg-white p-8 text-center text-pretty text-[var(--muted)]">Chưa có sản phẩm đang bán.</p>
        ) : (
          <div className="reboxe-container grid grid-cols-1 gap-x-3 gap-y-4 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[repeat(6,200px)]">
            {sponsored.map((product) => <ProductCard key={product.id} product={product} sponsored />)}
            {result.items.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </section>
    </main>
  );
}
