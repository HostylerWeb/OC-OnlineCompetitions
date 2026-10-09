export default function DashboardLoading() {
  return (
    <main className="oc-container py-12">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800/50" />

      {/* Account info skeleton */}
      <div className="mt-8 space-y-4">
        <div className="rounded-xl border border-border-subtle bg-card p-6">
          <div className="h-4 w-12 animate-pulse rounded bg-zinc-800/50" />
          <div className="mt-2 h-5 w-40 animate-pulse rounded bg-zinc-800/50" />
        </div>
        <div className="rounded-xl border border-border-subtle bg-card p-6">
          <div className="h-4 w-12 animate-pulse rounded bg-zinc-800/50" />
          <div className="mt-2 h-5 w-52 animate-pulse rounded bg-zinc-800/50" />
        </div>
      </div>

      {/* Recent Orders skeleton */}
      <section className="mt-12">
        <div className="h-6 w-36 animate-pulse rounded bg-zinc-800/50" />

        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-card p-4"
            >
              <div className="flex flex-col gap-1">
                <div className="h-3 w-20 animate-pulse rounded bg-zinc-800/50" />
                <div className="h-3 w-24 animate-pulse rounded bg-zinc-800/50" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-5 w-14 animate-pulse rounded-full bg-zinc-800/50" />
                <div className="h-4 w-12 animate-pulse rounded bg-zinc-800/50" />
                <div className="h-8 w-14 animate-pulse rounded-lg bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
