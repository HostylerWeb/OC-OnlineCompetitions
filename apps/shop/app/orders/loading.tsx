export default function OrdersLoading() {
  return (
    <main className="oc-container py-12">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-800/50" />

      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-border-subtle bg-card p-5"
          >
            <div className="flex flex-col gap-2">
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-3 w-20 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-3 w-16 animate-pulse rounded bg-zinc-800/50" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-6 w-16 animate-pulse rounded-full bg-zinc-800/50" />
              <div className="h-5 w-12 animate-pulse rounded bg-zinc-800/50" />
              <div className="h-9 w-16 animate-pulse rounded-lg bg-zinc-800/50" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
