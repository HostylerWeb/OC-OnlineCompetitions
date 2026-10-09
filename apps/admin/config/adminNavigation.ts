import type { AdminRole } from "@oc/types";
import {
  Award,
  BarChart3,
  Bell,
  Clapperboard,
  CreditCard,
  FolderTree,
  GitBranch,
  Gift,
  Images,
  LayoutTemplate,
  Link2,
  Mail,
  Puzzle,
  Radio,
  Search,
  Shield,
  ShoppingBag,
  Smartphone,
  Tag,
  Ticket,
  TrendingUp,
  Trophy,
  Users,
} from "@oc/icons";
import type { ComponentType } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string | number;
  target?: string;
  keywords?: string[];
  roles?: AdminRole[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const adminNavigationGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: BarChart3,
        keywords: ["home", "stats", "command center"],
      },
    ],
  },
  {
    title: "Catalogue",
    items: [
      {
        href: "/competitions",
        label: "Competitions",
        icon: Ticket,
        keywords: ["draws", "prizes", "tickets"],
      },
      {
        href: "/instant-prizes",
        label: "Instant Prizes",
        icon: Gift,
        keywords: ["templates", "instant win", "prize template", "scratchcard", "instant prize"],
      },
      {
        href: "/bonus-awards",
        label: "Bonus Awards",
        icon: Award,
        keywords: ["milestones", "bonus draw", "auto", "bonus award"],
      },
      {
        href: "/categories",
        label: "Categories",
        icon: FolderTree,
        keywords: ["taxonomy"],
      },
    ],
  },
  {
    title: "Shop",
    items: [
      {
        href: "/shop/products",
        label: "Products",
        icon: ShoppingBag,
        keywords: ["merchandise", "items", "inventory", "shop products"],
      },
      {
        href: "/shop/categories",
        label: "Shop Categories",
        icon: FolderTree,
        keywords: ["shop categories", "taxonomy", "product categories"],
      },
      {
        href: "/shop/orders",
        label: "Shop Orders",
        icon: ShoppingBag,
        keywords: ["shop orders", "transactions", "merchandise orders"],
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        href: "/orders",
        label: "Orders",
        icon: ShoppingBag,
        keywords: ["transactions", "purchases"],
      },
      {
        href: "/promo-codes",
        label: "Promo Codes",
        icon: Tag,
        keywords: ["discounts", "coupons"],
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        href: "/users",
        label: "Users",
        icon: Users,
        keywords: ["customers", "accounts"],
      },
      {
        href: "/referrals",
        label: "Referrals",
        icon: TrendingUp,
        keywords: ["affiliate", "rewards", "referral", "commission", "tier", "referrer"],
      },
      {
        href: "/referrals/network",
        label: "Referral Network",
        icon: GitBranch,
        keywords: [
          "graph",
          "tree",
          "hierarchy",
          "visualization",
          "mindmap",
          "sourcing",
        ],
      },
    ],
  },
  {
    title: "Fulfilment",
    items: [
      {
        href: "/winners",
        label: "Winners",
        icon: Trophy,
        keywords: [
          "draws",
          "prize",
          "fulfilment",
          "winner",
          "claimed",
          "unclaimed",
          "ticket",
          "draw",
        ],
      },
      {
        href: "/instant-prize-wins",
        label: "Instant Prize Wins",
        icon: Gift,
        keywords: [
          "wins",
          "instant",
          "prize",
          "claimed",
          "free ticket",
          "fulfilment",
          "scratchcard",
        ],
      },
      {
        href: "/bonus-awards/wins",
        label: "Bonus Award Wins",
        icon: Award,
        keywords: [
          "bonus",
          "award",
          "wins",
          "milestone",
          "bonus draw",
          "claimed",
          "fulfilment",
        ],
      },
    ],
  },
  {
    title: "Library",
    items: [
      {
        href: "/media",
        label: "Media Library",
        icon: Images,
        keywords: ["images", "assets", "s3", "uploads", "files", "photos"],
      },
    ],
  },
  {
    title: "Livestream",
    items: [
      {
        href: "/livestream/draws",
        label: "Livestream Draws",
        icon: Radio,
        keywords: ["draw", "stream"],
      },
      {
        href: "/livestream/draws/full",
        label: "Draw Studio",
        icon: Clapperboard,
        target: "_blank",
        keywords: ["fullscreen", "studio"],
      },
    ],
  },
  {
    title: "Configuration",
    items: [
      {
        href: "/payment-methods",
        label: "Payment Methods",
        icon: CreditCard,
        roles: ["admin"],
        keywords: [],
      },
      {
        href: "/homepage-layout",
        label: "Homepage Layout",
        icon: LayoutTemplate,
        keywords: ["sections", "ordering"],
      },
      {
        href: "/compliance-settings",
        label: "Compliance",
        icon: Shield,
        roles: ["admin"],
        keywords: ["age", "kyc", "spend limits"],
      },
      {
        href: "/email-settings",
        label: "Email Settings",
        icon: Mail,
        roles: ["admin"],
        keywords: ["smtp", "resend"],
      },
      {
        href: "/notifications",
        label: "Notifications",
        icon: Bell,
        keywords: ["alerts", "push", "campaign"],
      },
      {
        href: "/notifications/subscriptions",
        label: "Push Subscriptions",
        icon: Smartphone,
        keywords: ["push", "subscriptions", "devices"],
      },
      {
        href: "/seo-settings",
        label: "SEO Settings",
        icon: Search,
        roles: ["admin"],
        keywords: ["seo", "og", "open graph", "social", "preview", "meta", "sharing"],
      },
      {
        href: "/conversion-tracking",
        label: "Conversion Tracking",
        icon: Link2,
        roles: ["admin"],
        keywords: ["cpa", "affiliate", "tracking", "traffic nomads", "conversion", "pixel", "gtag", "analytics"],
      },
      {
        href: "/addons",
        label: "Addons",
        icon: Puzzle,
        roles: ["admin"],
        keywords: ["plugins", "extensions", "webp", "webm", "converter", "media", "optimization", "media-converter"],
      },
    ],
  },
];
