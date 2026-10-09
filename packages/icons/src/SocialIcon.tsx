import { cn, type SocialIconName } from "@oc/utils";
import type { SVGProps } from "react";
import {
  FacebookIcon,
  InstagramIcon,
  TelegramIcon,
  TikTokIcon,
  WhatsAppIcon,
  YouTubeIcon,
} from "./social/icons";

interface SocialIconProps extends SVGProps<SVGSVGElement> {
  name: SocialIconName;
}

const ICONS = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  telegram: TelegramIcon,
  tiktok: TikTokIcon,
  whatsapp: WhatsAppIcon,
  youtube: YouTubeIcon,
} as const;

export function SocialIcon({ name, className = "size-4", ...props }: SocialIconProps) {
  const Icon = ICONS[name];

  return <Icon className={cn("shrink-0", className)} {...props} />;
}
