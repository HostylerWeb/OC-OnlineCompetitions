export default function ProductsLoading() {
  return (
    <main className="oc-container py-12">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-800/50" />

      {/* Category filter skeleton */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="h-8 w-16 animate-pulse rounded-full bg-zinc-800/50" />
        <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-800/50" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-zinc-800/50" />
        <div className="h-8 w-18 animate-pulse rounded-full bg-zinc-800/50" />
      </div>

      {/* Product grid skeleton */}
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border-subtle bg-card p-4">
            <div className="aspect-square animate-pulse rounded-lg bg-zinc-800/50" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-5 w-1/3 animate-pulse rounded bg-zinc-800/50" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
