import { Package, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { fetchCategories, fetchProducts } from "@/lib/api";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const activeCategory = typeof params.categoryId === "string" ? params.categoryId : "";
  const currentPage = typeof params.page === "string" ? Number.parseInt(params.page, 10) : 1;

  let categories: { _id: string; name: string; slug: string }[] = [];
  try {
    const catRes = await fetchCategories();
    categories = catRes.data;
  } catch {}

  let products: any[] = [];
  let meta: any = null;
  let error = false;
  try {
    const res = await fetchProducts({
      page: currentPage,
      limit: 12,
      categoryId: activeCategory || undefined,
    });
    products = res.data;
    meta = res.meta;
  } catch {
    error = true;
  }

  return (
    <main className="oc-container py-12">
      <h1 className="text-3xl font-bold tracking-tight">Products</h1>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href="/products"
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              !activeCategory
                ? "border-gold bg-gold text-black"
                : "border-border-subtle text-muted-foreground hover:border-gold/50 hover:text-gold"
            )}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat._id}
              href={`/products?categoryId=${cat._id}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                activeCategory === cat._id
                  ? "border-gold bg-gold text-black"
                  : "border-border-subtle text-muted-foreground hover:border-gold/50 hover:text-gold"
              )}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* Product Grid */}
      {error ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <TriangleAlert className="h-5 w-5 text-gold" />
          <p className="text-muted-foreground">Something went wrong loading products.</p>
          <p className="text-xs text-muted-foreground">Please refresh the page to try again.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <Package className="h-8 w-8 text-gold" />
          <p className="text-lg text-muted-foreground">No products found.</p>
        </div>
      ) : (
        <div
          className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          style={{ contentVisibility: "auto" }}
        >
          {products.map((product, i) => (
            <ProductCard key={product._id} product={product} preload={i < 4 && currentPage <= 1} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.pages > 1 && (
        <div className="mt-12 flex justify-center gap-2">
          {Array.from({ length: meta.pages }, (_, i) => i + 1).map((page) => {
            const href = activeCategory
              ? `/products?categoryId=${activeCategory}&page=${page}`
              : `/products?page=${page}`;
            return (
              <Link
                key={page}
                href={href}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors",
                  page === currentPage
                    ? "bg-gold text-black font-medium"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                {page}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
