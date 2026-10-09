import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { fetchProducts, type ShopProductData } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let featured: ShopProductData[] = [];
  try {
    const res = await fetchProducts({ limit: 4 });
    featured = res.data;
  } catch {
    featured = [];
  }

  return (
    <main>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border-subtle">
        <div className="oc-container py-24 md:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold">
              Online Competitions Essentials Vol. 1
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
              The Definition Collection
            </h1>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              Premium heavyweight apparel and accessories. Engineered for those who define their own
              path.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gold text-black px-6 py-3 text-sm font-semibold hover:bg-gold/90 transition-colors shadow-xs h-11"
              >
                Shop Now
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent hover:bg-white/5 text-foreground px-6 py-3 text-sm font-medium transition-colors h-11"
              >
                View All
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featured.length > 0 && (
        <section className="oc-container py-16" style={{ contentVisibility: "auto" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Featured</h2>
            <Link
              href="/products"
              className="text-sm text-muted-foreground transition-colors hover:text-gold"
            >
              View all →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product, i) => (
              <ProductCard key={product._id} product={product} preload={i < 2} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
