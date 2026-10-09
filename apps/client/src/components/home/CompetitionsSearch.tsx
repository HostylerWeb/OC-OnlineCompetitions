import { useCompetitionsFilterStore } from "@oc/api-client";
import { Search } from "@oc/icons";
import { GoldOutlineButton } from "@/components/buttons";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";

interface CompetitionsSearchProps {
  categories: Array<{ slug: string; label: string }>;
}

export function CompetitionsSearch({ categories }: CompetitionsSearchProps) {
  const { t } = useTranslation();
  const searchQuery = useCompetitionsFilterStore((s) => s.search);
  const category = useCompetitionsFilterStore((s) => s.category);
  const setSearch = useCompetitionsFilterStore((s) => s.setSearch);
  const setCategory = useCompetitionsFilterStore((s) => s.setCategory);

  const activeCategory =
    category && categories.some((cat) => cat.slug === category) ? category : "all";

  const handleCategoryChange = (slug: string) => {
    setCategory(slug === "all" ? null : slug);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSearch = () => {
    useCompetitionsFilterStore.getState().syncUrl();
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={t("home.search.placeholder")}
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 h-11 sm:h-10"
          data-umami-event="competitions:search"
          data-umami-event-query={searchQuery}
        />
      </div>
      <div
        className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible"
        role="tablist"
        aria-label={t("home.search.filterAria")}
      >
        <GoldOutlineButton
          aria-pressed={activeCategory === "all"}
          className={
            activeCategory === "all"
              ? "h-11 sm:h-9 px-4 shrink-0"
              : "h-11 sm:h-9 px-4 opacity-60 shrink-0"
          }
          onClick={() => handleCategoryChange("all")}
          data-umami-event="competitions:filter-all"
        >
          {t("home.search.all")}
        </GoldOutlineButton>
        {categories.map((cat) => (
          <GoldOutlineButton
            key={cat.slug}
            aria-pressed={activeCategory === cat.slug}
            className={
              activeCategory === cat.slug
                ? "h-11 sm:h-9 px-4 shrink-0"
                : "h-11 sm:h-9 px-4 opacity-60 shrink-0"
            }
            onClick={() => handleCategoryChange(cat.slug)}
            data-umami-event="competitions:filter-category"
            data-umami-event-category={cat.slug}
          >
            {cat.label}
          </GoldOutlineButton>
        ))}
      </div>
    </div>
  );
}

export function CompetitionsSearchSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      <Skeleton className="h-11 sm:h-10 flex-1" shimmer />
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
        <Skeleton className="h-11 w-16 shrink-0" shimmer />
        <Skeleton className="h-11 w-24 shrink-0" shimmer />
        <Skeleton className="h-11 w-20 shrink-0" shimmer />
      </div>
    </div>
  );
}
