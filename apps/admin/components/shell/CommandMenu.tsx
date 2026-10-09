"use client";

import { type SearchResultGroup, useAdminSearch, useAuth } from "@oc/api-admin";
import {
  CreditCard,
  FolderTree,
  Gift,
  GitBranch,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
  Ticket,
  TrendingUp,
  Trophy,
  Users,
} from "@oc/icons";
import { AlertCircle, Search } from "lucide-react";
import type { AdminRole } from "@oc/types";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { adminNavigationGroups } from "@/config/adminNavigation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { filterNavGroups, isItemAllowed } from "@/lib/nav-permissions";
import { useCommandMenu } from "./CommandMenuContext";

// ---------------------------------------------------------------------------
// Generic CommandMenu primitive — the visible palette.
// ---------------------------------------------------------------------------

export interface CommandMenuItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect?: () => void;
  keywords?: string[];
  shortcut?: string;
  badge?: string;
  roles?: AdminRole[];
}

export interface CommandMenuGroup {
  heading: string;
  items: CommandMenuItem[];
}

export interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandMenuGroup[];
  placeholder?: string;
  emptyMessage?: string;
  searchResults?: CommandMenuGroup[];
  onSearchChange?: (value: string) => void;
  isSearching?: boolean;
  searchError?: boolean;
  onSearchRetry?: () => void;
}

function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Search failed</p>
        <p className="text-xs text-muted-foreground">
          We couldn&rsquo;t complete the search. Please try again.
        </p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:border-gold/40"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function CommandMenu({
  open,
  onOpenChange,
  groups,
  placeholder = "Search commands…",
  emptyMessage = "No results found.",
  searchResults,
  onSearchChange,
  isSearching,
  searchError,
  onSearchRetry,
}: CommandMenuProps) {
  const router = useRouter();
  const listRef = React.useRef<HTMLDivElement>(null);
  const navigatingRef = React.useRef(false);
  const [inputValue, setInputValue] = React.useState("");
  const [cmdValue, setCmdValue] = React.useState<string | undefined>(undefined);

  const firstResultLabel = React.useMemo(() => {
    return searchResults?.[0]?.items?.[0]?.label;
  }, [searchResults]);

  React.useEffect(() => {
    if (!open) {
      navigatingRef.current = false;
      setInputValue("");
      setCmdValue(undefined);
    }
  }, [open]);

  React.useEffect(() => {
    if (firstResultLabel && inputValue.trim()) {
      setCmdValue(`db:${firstResultLabel} ${inputValue}`);
      const id = requestAnimationFrame(() => setCmdValue(undefined));
      return () => cancelAnimationFrame(id);
    }
  }, [firstResultLabel]);

  React.useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTo({ top: 0, behavior: searchResults?.length ? "smooth" : "auto" });
  }, [open, searchResults]);

  const hasQuery = inputValue.trim().length > 0;
  const showErrorMessage = searchError && hasQuery;

  const runItem = React.useCallback(
    (item: CommandMenuItem) => {
      navigatingRef.current = true;
      onOpenChange(false);
      if (item.onSelect) {
        item.onSelect();
        return;
      }
      if (item.href) {
        router.push(item.href);
      }
    },
    [onOpenChange, router]
  );

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (navigatingRef.current && !next) return;
      onOpenChange(next);
    },
    [onOpenChange]
  );

  const handleInputChange = React.useCallback(
    (value: string) => {
      setInputValue(value);
      onSearchChange?.(value);
    },
    [onSearchChange]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      commandValue={cmdValue}
      onCommandValueChange={setCmdValue}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <CommandInput
          placeholder={placeholder}
          value={inputValue}
          onValueChange={handleInputChange}
          autoFocus
        />
        <kbd className="hidden h-5 shrink-0 items-center rounded border border-border bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ESC
        </kbd>
      </div>

      <CommandList ref={listRef}>
        {showErrorMessage ? <ErrorState onRetry={onSearchRetry} /> : null}

        {searchResults?.map((group) => (
          <React.Fragment key={group.heading}>
            <CommandSeparator className="bg-border/60" />
            <CommandGroup heading={group.heading}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={`db:${item.label} ${inputValue}`}
                    onSelect={() => runItem(item)}
                    className="flex items-start gap-3"
                  >
                    {Icon ? (
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium leading-none">
                          {item.label}
                        </span>
                        {item.badge ? (
                          <Badge
                            variant="outline"
                            className="h-5 shrink-0 rounded-sm border-border/50 px-1.5 text-[10px] font-normal leading-none text-muted-foreground"
                          >
                            {item.badge}
                          </Badge>
                        ) : null}
                      </div>
                      {item.description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}

        {groups.map((group, idx) => {
          const isFirst = idx === 0;
          const hasSearchAbove = searchResults && searchResults.length > 0;
          return (
            <React.Fragment key={group.heading}>
              {!isFirst || hasSearchAbove ? <CommandSeparator className="bg-border/60" /> : null}
              <CommandGroup heading={group.heading}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                      onSelect={() => runItem(item)}
                    >
                      {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut ? <CommandShortcut>{item.shortcut}</CommandShortcut> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </React.Fragment>
          );
        })}

        {hasQuery ? (
          <CommandEmpty>
            <span>No results for &ldquo;{inputValue}&rdquo;</span>
          </CommandEmpty>
        ) : !isSearching && !searchError ? (
          <CommandEmpty>{emptyMessage}</CommandEmpty>
        ) : null}
      </CommandList>

      <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 font-mono text-[9px]">
              ↑↓
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-background px-1 font-mono text-[9px]">
              ↵
            </kbd>
            select
          </span>
        </div>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-background px-1 font-mono text-[9px]">
            esc
          </kbd>
          close
        </span>
      </div>
    </CommandDialog>
  );
}

export function useCommandMenuShortcut(onTrigger: () => void, enabled = true): void {
  React.useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onTrigger();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onTrigger, enabled]);
}

// ---------------------------------------------------------------------------
// Admin-specific wrapper that wires the palette to admin nav + search.
// ---------------------------------------------------------------------------

const SEARCH_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  competitions: Ticket,
  orders: ShoppingBag,
  users: Users,
  promo_codes: Tag,
  categories: FolderTree,
  winners: Trophy,
  instant_prize_wins: Gift,
  instant_prizes: Sparkles,
  referral_purchases: TrendingUp,
  tickets: Ticket,
  balance_transactions: CreditCard,
};

const SEARCH_TYPE_BADGE_LABELS: Record<string, string> = {
  competitions: "Competition",
  orders: "Order",
  users: "User",
  promo_codes: "Promo",
  categories: "Category",
  winners: "Winner",
  instant_prize_wins: "Instant Win",
  instant_prizes: "Prize",
  referral_purchases: "Referral",
  tickets: "Ticket",
  balance_transactions: "Transaction",
};

export function GlobalCommandMenu() {
  const { open, setOpen } = useCommandMenu();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const { role } = useAuth();

  const {
    data: searchData,
    isLoading: isSearching,
    isError: searchError,
    refetch: refetchSearch,
  } = useAdminSearch(debouncedQuery);

  useEffect(() => {
    if (open) setSearchQuery("");
  }, [open]);

  const searchResults = useMemo<CommandMenuGroup[]>(() => {
    if (!searchData?.data?.results) return [];

    return searchData.data.results.map((group: SearchResultGroup) => ({
      heading: group.label,
      items: [
        ...group.items.map((item: SearchResultGroup["items"][number]) => {
          const Icon = SEARCH_TYPE_ICONS[item.type];
          return {
            id: `db:${item.type}:${item.id}`,
            label: item.label,
            description: item.description,
            href: item.url,
            icon: Icon ?? (item.type === "promo_codes" ? Tag : undefined),
            badge: SEARCH_TYPE_BADGE_LABELS[item.type] ?? item.type,
            keywords: [],
          } satisfies CommandMenuItem;
        }),
        {
          id: `db:${group.type}:view-all`,
          label: `View all ${group.label.toLowerCase()}`,
          href: group.searchUrl,
          icon: SEARCH_TYPE_ICONS[group.type],
          keywords: [],
        } satisfies CommandMenuItem,
      ],
    }));
  }, [searchData]);

  const groups = useMemo<CommandMenuGroup[]>(() => {
    const navGroups: CommandMenuGroup[] = filterNavGroups(role).map((g) => ({
      heading: g.title,
      items: g.items.map((item) => ({
        id: `nav:${item.href}`,
        label: item.label,
        href: item.href,
        icon: item.icon,
        keywords: item.keywords,
      })),
    }));

    const quickActions: CommandMenuGroup = {
      heading: "Quick actions",
      items: [
        {
          id: "qa:create-competition",
          label: "Create competition",
          href: "/competitions?create=1",
          icon: Plus,
          roles: ["admin"] satisfies AdminRole[],
        },
        {
          id: "qa:create-instant-prize",
          label: "Create instant prize",
          href: "/instant-prizes?create=1",
          icon: Sparkles,
          roles: ["admin"] satisfies AdminRole[],
        },
        {
          id: "qa:add-winner",
          label: "Add winner",
          href: "/winners?create=1",
          icon: Plus,
          roles: ["admin"] satisfies AdminRole[],
        },
        {
          id: "qa:create-promo",
          label: "Create promo code",
          href: "/promo-codes?create=1",
          icon: Plus,
          roles: ["admin"] satisfies AdminRole[],
        },
        {
          id: "qa:assign-instant-prize-win",
          label: "Assign instant prize win",
          href: "/instant-prize-wins?create=1",
          icon: Gift,
          roles: ["admin"] satisfies AdminRole[],
        },
        {
          id: "qa:view-referrals",
          label: "View referrals",
          href: "/referrals",
          icon: TrendingUp,
        },
        {
          id: "qa:view-referral-network",
          label: "Referral network",
          href: "/referrals/network",
          icon: GitBranch,
        },
      ].filter((item) => isItemAllowed(item, role)),
    };

    return [quickActions, ...navGroups];
  }, [role]);

  return (
    <CommandMenu
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearchQuery("");
      }}
      groups={groups}
      searchResults={searchResults}
      onSearchChange={setSearchQuery}
      isSearching={isSearching}
      searchError={searchError}
      onSearchRetry={() => refetchSearch()}
      placeholder="Search pages, actions…"
    />
  );
}

/**
 * Visible trigger button — clicks open the palette via shared context state.
 */
export function CommandMenuTrigger({
  className,
  ...props
}: { className?: string } & React.ComponentPropsWithoutRef<"button">) {
  const { setOpen } = useCommandMenu();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={
        className ??
        "group inline-flex h-9 items-center gap-2 rounded-md border border-border bg-muted/30 px-3 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
      }
      {...props}
    >
      <span className="animate-[pulse_4s_ease-in-out_infinite] group-hover:animate-none">
        Search…
      </span>
      <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
