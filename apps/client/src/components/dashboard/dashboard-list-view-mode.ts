import type { LucideIcon } from "@oc/icons";
import { Grid3X3, List, Rows3 } from "@oc/icons";

export type DashboardListViewMode = "card" | "compact" | "grid";

export const DASHBOARD_LIST_VIEW_MODES: {
  id: DashboardListViewMode;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "card", label: "Card", icon: Rows3 },
  { id: "compact", label: "List", icon: List },
  { id: "grid", label: "Grid", icon: Grid3X3 },
];

export function dashboardListLayoutClass(viewMode: DashboardListViewMode): string {
  switch (viewMode) {
    case "card":
      return "flex flex-col gap-3";
    case "compact":
      return "flex flex-col gap-2";
    case "grid":
      return "grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4";
  }
}
