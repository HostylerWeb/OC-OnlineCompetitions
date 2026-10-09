"use client";

import { Search, X } from "@oc/icons";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onClearFilters?: () => void;
  onClearAll?: () => void;
  children?: ReactNode;
}

function AdminFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  onClearFilters,
  onClearAll,
  children,
}: AdminFiltersProps) {
  const hasFilters = searchValue.length > 0 || children != null;
  const handleClear = onClearFilters ?? onClearAll;

  return (
    <div className="filters-bar">
      <div className="relative min-w-0 flex-1 max-w-xs sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 bg-background pl-9 pr-3 text-sm"
        />
      </div>

      {children ? <div className="flex flex-wrap items-end gap-3">{children}</div> : null}

      {handleClear ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={!hasFilters}
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

export type { AdminFiltersProps };
export { AdminFilters };
