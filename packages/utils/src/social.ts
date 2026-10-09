export type SocialIconName =
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "telegram"
  | "tiktok"
  | "youtube";

export interface SocialLink {
  /** Display label (domain). */
  label: string;
  href: string;
  icon: SocialIconName;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { label: "facebook.com", href: "https://www.facebook.com/", icon: "facebook" },
  { label: "instagram.com", href: "https://www.instagram.com/", icon: "instagram" },
  { label: "whatsapp.com", href: "https://www.whatsapp.com/", icon: "whatsapp" },
  { label: "telegram.org", href: "https://telegram.org/", icon: "telegram" },
  { label: "tiktok.com", href: "https://www.tiktok.com/", icon: "tiktok" },
  { label: "youtube.com", href: "https://www.youtube.com/", icon: "youtube" },
];

/** Default social URLs for email settings / footers (platform homepages, not profiles). */
export const DEFAULT_SOCIAL_URLS = {
  facebook: SOCIAL_LINKS.find((l) => l.icon === "facebook")!.href,
  instagram: SOCIAL_LINKS.find((l) => l.icon === "instagram")!.href,
  whatsapp: SOCIAL_LINKS.find((l) => l.icon === "whatsapp")!.href,
  telegram: SOCIAL_LINKS.find((l) => l.icon === "telegram")!.href,
  tiktok: SOCIAL_LINKS.find((l) => l.icon === "tiktok")!.href,
} as const;
