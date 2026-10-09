"use client";

import { Search } from "@oc/icons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DrawQueueTabId } from "./types";

interface DrawQueueControlsProps {
  activeTab: DrawQueueTabId;
  onTabChange: (tab: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  pendingCount: number;
  drawnCount: number;
}

const tabs: { id: DrawQueueTabId; label: string; count?: number }[] = [
  { id: "queue", label: "Queue" },
  { id: "pending_draw", label: "Pending Draw" },
  { id: "drawn", label: "Drawn" },
  { id: "completed", label: "Completed" },
  { id: "recent", label: "Recent" },
];

function DrawQueueControls({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filteredCount,
  pendingCount,
  drawnCount,
}: DrawQueueControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-auto">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="relative gap-1.5"
                data-umami-event="livestream-studio:tab-change"
                data-umami-event-tab={tab.id}
              >
                {tab.label}
                {tab.id === "pending_draw" && pendingCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="size-4 rounded-full p-0 text-[10px] leading-none"
                  >
                    {pendingCount}
                  </Badge>
                )}
                {tab.id === "drawn" && drawnCount > 0 && (
                  <span className="text-xs text-muted-foreground">({drawnCount})</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              data-icon="inline-start"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search competitions..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 w-56 pl-8 text-sm"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            {filteredCount} shown
          </Badge>
        </div>
      </div>
    </div>
  );
}

export { DrawQueueControls };
