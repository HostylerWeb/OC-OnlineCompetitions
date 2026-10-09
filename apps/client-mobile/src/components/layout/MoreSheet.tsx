"use client";

import {
  Gift,
  HelpCircle,
  Info,
  Mail,
  MailQuestion,
  ScrollText,
  Shield,
  Smartphone,
  X,
} from "@oc/icons";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import {
  mobileNavIconWrapClass,
  mobileNavItemClass,
  mobileNavSectionClass,
} from "./mobile-nav-styles";
import { NavSheetLink } from "./nav-sheet-link";

const LINKS = [
  {
    section: "main",
    items: [
      { href: "/winners", labelKey: "header.nav.winners", icon: Gift },
      { href: "/how-it-works", labelKey: "header.nav.howItWorks", icon: HelpCircle },
    ],
  },
  {
    section: "support",
    items: [
      { href: "/faq", labelKey: "header.nav.faq", icon: HelpCircle },
      { href: "/about", labelKey: "footer.aboutUs", icon: Info },
      { href: "/contact", labelKey: "footer.contactUs", icon: MailQuestion },
    ],
  },
  {
    section: "legal",
    items: [
      { href: "/terms", labelKey: "footer.termsOfService", icon: ScrollText },
      { href: "/privacy", labelKey: "footer.privacyPolicy", icon: Shield },
      { href: "/cookie-policy", labelKey: "footer.cookiePolicy", icon: Mail },
      { href: "/responsible-play", labelKey: "header.nav.responsiblePlay", icon: Shield },
      { href: "/free-postal-entry", labelKey: "footer.freePostalEntry", icon: Smartphone },
    ],
  },
] as const;

interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoreSheet({ open, onOpenChange }: MoreSheetProps) {
  const { t } = useTranslation();

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-xl bg-card outline-none"
          style={{ maxHeight: "calc(100dvh - 48px)" }}
        >
          <Drawer.Handle className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-border" />
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <p className="text-sm font-semibold text-foreground">More</p>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
          <div
            className="overflow-y-auto flex-1 px-3"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            {LINKS.map((group) => (
              <div key={group.section} className="mb-4">
                <p className={mobileNavSectionClass()}>{group.section}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavSheetLink
                      key={item.href}
                      href={item.href}
                      className={mobileNavItemClass()}
                      onClick={() => onOpenChange(false)}
                    >
                      <div className={mobileNavIconWrapClass()}>
                        <Icon className="w-4 h-4 text-gold" />
                      </div>
                      {t(item.labelKey as any)}
                    </NavSheetLink>
                  );
                })}
              </div>
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
