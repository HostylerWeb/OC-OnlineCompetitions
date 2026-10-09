"use client";

import type { ReferralMindmapNode } from "@oc/api-referrals/mindmap";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CircleDot,
  Infinity as InfinityIcon,
  RotateCcw,
  X,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  type FocusDirection,
  type FocusState,
  type PowerFilterKey,
  type SimplePowerFilterKey,
} from "./focus";
import { PowerFilterPopover } from "./PowerFilterPopover";

interface FocusToolbarProps {
  state: FocusState;
  nodes: ReferralMindmapNode[];
  focusedNodeNames: string[];
  focusedNodeCount: number;
  focusedEdgeCount: number;
  truncated: boolean;
  onSetRadius: (r: number) => void;
  onSetDirection: (d: FocusDirection) => void;
  onToggleFilter: (key: PowerFilterKey) => void;
  onClearFilters: () => void;
  onClearFocus: () => void;
  onResetAll: () => void;
  onRemoveFocusedNode: (id: string) => void;
}

const SIMPLE_LABELS: Record<SimplePowerFilterKey, string> = {
  ticket_earners: "Ticket earners",
  inactive_referrers: "Inactive",
  admins: "Admins",
  verified: "Verified",
  subscribers: "Subscribers",
  recent: "Recent (30d)",
};

const RADIUS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: Number.POSITIVE_INFINITY, label: "∞" },
];

export function FocusToolbar({
  state,
  nodes,
  focusedNodeNames,
  focusedNodeCount,
  focusedEdgeCount,
  truncated,
  onSetRadius,
  onSetDirection,
  onToggleFilter,
  onClearFilters,
  onClearFocus,
  onResetAll,
  onRemoveFocusedNode,
}: FocusToolbarProps) {
  const simpleActive = useMemo(
    () => new Set(state.filters.filter((f): f is SimplePowerFilterKey => !f.includes(":"))),
    [state.filters]
  );

  const hasFilters = state.filters.length > 0;
  const hasFocus = state.focusedNodeIds.length > 0;
  const hasAny = hasFocus || hasFilters;

  if (!hasAny && focusedNodeCount === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
        <CircleDot className="h-3 w-3" />
        Right-click any node to focus its subtree. Filters work without focus.
      </div>
    );
  }

  return (
    <div className="flex max-w-full flex-col gap-1.5 rounded-lg border bg-background/90 p-2 text-xs shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        {hasFocus && (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="inline-flex h-5 items-center rounded-full bg-primary/15 px-2 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Focused
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {focusedNodeNames.map((name, idx) => (
                <span
                  key={`${name}-${idx}`}
                  className="inline-flex max-w-[160px] items-center gap-1 rounded-md bg-foreground/5 px-1.5 py-0.5 font-mono"
                >
                  <span className="truncate">{name}</span>
                  {state.focusedNodeIds.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove ${name} from focus`}
                      onClick={() => onRemoveFocusedNode(state.focusedNodeIds[idx]!)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {focusedNodeCount} nodes · {focusedEdgeCount} edges
              {truncated && (
                <span className="ml-1 rounded bg-amber-500/15 px-1 text-[9px] text-amber-600">
                  capped
                </span>
              )}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Radius</span>
          <ToggleGroup
            type="single"
            value={Number.isFinite(state.radius) ? String(state.radius) : "inf"}
            onValueChange={(v) => {
              if (v === "inf") onSetRadius(Number.POSITIVE_INFINITY);
              else if (v) onSetRadius(Number(v));
            }}
            spacing={0}
            variant="outline"
            size="sm"
          >
            {RADIUS_OPTIONS.map((opt) => (
              <ToggleGroupItem
                key={opt.label}
                value={Number.isFinite(opt.value) ? String(opt.value) : "inf"}
                aria-label={`Radius ${opt.label}`}
                className="h-6 min-w-[28px] px-1.5 text-[10px]"
              >
                {opt.label === "∞" ? <InfinityIcon className="h-3 w-3" /> : opt.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Dir</span>
          <ToggleGroup
            type="single"
            value={state.direction}
            onValueChange={(v) => v && onSetDirection(v as FocusDirection)}
            spacing={0}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem
              value="down"
              aria-label="Downstream"
              className="h-6 min-w-[28px] px-1.5"
            >
              <ArrowDown className="h-3 w-3" />
            </ToggleGroupItem>
            <ToggleGroupItem value="up" aria-label="Upstream" className="h-6 min-w-[28px] px-1.5">
              <ArrowUp className="h-3 w-3" />
            </ToggleGroupItem>
            <ToggleGroupItem value="both" aria-label="Both" className="h-6 min-w-[28px] px-1.5">
              <ArrowUpDown className="h-3 w-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="all"
              aria-label="All directions"
              className="h-6 min-w-[28px] px-1.5"
            >
              <CircleDot className="h-3 w-3" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Filters</span>
        {(Object.keys(SIMPLE_LABELS) as SimplePowerFilterKey[]).map((key) => {
          const active = simpleActive.has(key);
          return (
            <Button
              key={key}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              onClick={() => onToggleFilter(key)}
              className={cn("h-6 px-2 text-[11px]", active && "shadow-inner")}
            >
              {SIMPLE_LABELS[key]}
            </Button>
          );
        })}
        <PowerFilterPopover
          nodes={nodes}
          activeFilters={state.filters}
          onToggle={onToggleFilter}
          onClear={onClearFilters}
        />
        {hasAny && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="ml-auto h-6 gap-1 px-2 text-[11px]"
          >
            <RotateCcw className="h-3 w-3" />
            Reset all
          </Button>
        )}
        {hasFocus && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFocus}
            className="h-6 gap-1 px-2 text-[11px]"
          >
            <X className="h-3 w-3" />
            Clear focus
          </Button>
        )}
      </div>
    </div>
  );
}
