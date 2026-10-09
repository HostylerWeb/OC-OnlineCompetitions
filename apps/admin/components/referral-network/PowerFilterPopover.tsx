"use client";

import type { ReferralMindmapNode } from "@oc/api-referrals/mindmap";
import { Filter, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  COUNTRY_FILTER_PREFIX,
  type PowerFilterKey,
  SPEND_MIN_FILTER_PREFIX,
  TIER_MIN_FILTER_PREFIX,
} from "./focus";

interface PowerFilterPopoverProps {
  nodes: ReferralMindmapNode[];
  activeFilters: PowerFilterKey[];
  onToggle: (key: PowerFilterKey) => void;
  onClear: () => void;
}

function parseTier(value: PowerFilterKey | undefined): number | null {
  if (!value) return null;
  if (!value.startsWith(TIER_MIN_FILTER_PREFIX)) return null;
  const n = Number(value.slice(TIER_MIN_FILTER_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

function parseSpend(value: PowerFilterKey | undefined): number | null {
  if (!value) return null;
  if (!value.startsWith(SPEND_MIN_FILTER_PREFIX)) return null;
  const n = Number(value.slice(SPEND_MIN_FILTER_PREFIX.length));
  return Number.isFinite(n) ? n : null;
}

export function PowerFilterPopover({
  nodes,
  activeFilters,
  onToggle,
  onClear,
}: PowerFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [tierInput, setTierInput] = useState<string>("");
  const [spendInput, setSpendInput] = useState<string>("");

  const activeCountries = useMemo(
    () =>
      activeFilters
        .filter((f): f is `country:${string}` => f.startsWith(COUNTRY_FILTER_PREFIX))
        .map((f) => f.slice(COUNTRY_FILTER_PREFIX.length)),
    [activeFilters]
  );

  const activeTier = parseTier(activeFilters.find((f) => f.startsWith(TIER_MIN_FILTER_PREFIX)));
  const activeSpend = parseSpend(activeFilters.find((f) => f.startsWith(SPEND_MIN_FILTER_PREFIX)));

  const countries = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of nodes) {
      const c = n.country;
      if (!c) continue;
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [nodes]);

  const activeCount =
    activeCountries.length + (activeTier !== null ? 1 : 0) + (activeSpend !== null ? 1 : 0);

  function toggleCountry(country: string) {
    const key = `${COUNTRY_FILTER_PREFIX}${country}` as PowerFilterKey;
    onToggle(key);
  }

  function commitTierMin() {
    const trimmed = tierInput.trim();
    if (!trimmed) return;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return;
    const existing = activeFilters.find((f) => f.startsWith(TIER_MIN_FILTER_PREFIX));
    if (existing) onToggle(existing);
    onToggle(`${TIER_MIN_FILTER_PREFIX}${n}` as PowerFilterKey);
    setTierInput("");
  }

  function commitSpendMin() {
    const trimmed = spendInput.trim();
    if (!trimmed) return;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return;
    const existing = activeFilters.find((f) => f.startsWith(SPEND_MIN_FILTER_PREFIX));
    if (existing) onToggle(existing);
    onToggle(`${SPEND_MIN_FILTER_PREFIX}${n}` as PowerFilterKey);
    setSpendInput("");
  }

  function resetCustom() {
    for (const f of activeFilters) {
      if (f.startsWith(COUNTRY_FILTER_PREFIX)) onToggle(f);
      if (f.startsWith(TIER_MIN_FILTER_PREFIX)) onToggle(f);
      if (f.startsWith(SPEND_MIN_FILTER_PREFIX)) onToggle(f);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          data-active={activeCount > 0}
        >
          <Filter className="h-3 w-3" />
          Custom
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex items-center justify-between">
          <PopoverTitle>Custom filters</PopoverTitle>
          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetCustom}
              className="h-6 gap-1 px-1.5 text-[11px]"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Countries
            </Label>
            <div className="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto rounded border bg-muted/30 p-2">
              {countries.length === 0 ? (
                <p className="col-span-2 text-[11px] text-muted-foreground">No country data.</p>
              ) : (
                countries.map(([country, count]) => {
                  const checked = activeCountries.includes(country);
                  const id = `rfn-country-${country}`;
                  return (
                    <label
                      key={country}
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-background"
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={() => toggleCountry(country)}
                      />
                      <span className="flex-1 truncate">{country || "—"}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Min tier
              {activeTier !== null && <span className="ml-1 text-primary">· {activeTier}</span>}
            </Label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={20}
                placeholder="e.g. 1"
                value={tierInput}
                onChange={(e) => setTierInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTierMin();
                  }
                }}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={commitTierMin}
                className="h-7 px-2 text-xs"
              >
                Set
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Min spend (£)
              {activeSpend !== null && <span className="ml-1 text-primary">· £{activeSpend}</span>}
            </Label>
            <div className="flex gap-1.5">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                placeholder="e.g. 5"
                value={spendInput}
                onChange={(e) => setSpendInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitSpendMin();
                  }
                }}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={commitSpendMin}
                className="h-7 px-2 text-xs"
              >
                Set
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <X className="h-3 w-3" /> Clear all
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-7 px-3 text-xs"
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
