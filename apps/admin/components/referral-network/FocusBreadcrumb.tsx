"use client";

import type { ReferralMindmapNode } from "@oc/api-referrals/mindmap";
import { ChevronRight, Crosshair } from "lucide-react";

interface FocusBreadcrumbProps {
  lineagePath: string[];
  nodeMap: Map<string, ReferralMindmapNode>;
  onFocusAncestor: (id: string) => void;
}

export function FocusBreadcrumb({ lineagePath, nodeMap, onFocusAncestor }: FocusBreadcrumbProps) {
  if (lineagePath.length <= 1) return null;

  return (
    <nav
      aria-label="Focused user lineage"
      className="flex flex-wrap items-center gap-1 rounded-lg border bg-background/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur"
    >
      <Crosshair className="h-3 w-3 text-primary" />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Path</span>
      {lineagePath.map((id, idx) => {
        const node = nodeMap.get(id);
        if (!node) return null;
        const isLast = idx === lineagePath.length - 1;
        const label = node.displayName || node.email;
        return (
          <span key={id} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60" />}
            {isLast ? (
              <span className="font-mono font-semibold text-primary">{label}</span>
            ) : (
              <button
                type="button"
                onClick={() => onFocusAncestor(id)}
                className="max-w-[120px] truncate rounded px-1 py-0.5 font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={node.email}
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
