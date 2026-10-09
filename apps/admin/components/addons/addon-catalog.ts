import type { ComponentType } from "react";
import { Film } from "@oc/icons";

export type AddonCatalogStatus = "available" | "coming_soon";

export interface AddonCatalogEntry {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  status: AddonCatalogStatus;
  tags: string[];
}

export const ADDON_CATALOG: AddonCatalogEntry[] = [
  {
    id: "media-converter",
    title: "Media converter",
    description:
      "Optimize uploads on the way to storage: WebP for images, WebM for videos, with quality and scope controls.",
    href: "/addons/media-converter",
    icon: Film,
    status: "available",
    tags: ["Images", "Video", "CDN"],
  },
];

export function getAddonById(id: string): AddonCatalogEntry | undefined {
  return ADDON_CATALOG.find((a) => a.id === id);
}
