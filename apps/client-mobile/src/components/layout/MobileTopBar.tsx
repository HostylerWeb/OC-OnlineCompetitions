"use client";

import { ShoppingCart } from "@oc/icons";
import { cn, getProfileInitials } from "@oc/utils";
import { Link } from "@/components/Link";
import { BrandLogo } from "@/components/BrandLogo";
import { UserAvatar } from "@/components/user-avatar";
import { useUserState } from "@/hooks";
import { useTranslation } from "@/lib/i18n";

function CartBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-gold text-primary-foreground text-[10px] font-bold shadow-lg shadow-gold/30 ring-2 ring-card">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function MobileTopBar() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useUserState();

  const initials = getProfileInitials({
    firstName: user?.firstName,
    lastName: user?.lastName,
    email: user?.email ?? "",
  });

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-card/95 backdrop-blur-2xl border-b border-border">
      <div className="flex items-center justify-between h-12 px-4">
        <Link
          href="/"
          className="shrink-0 hover:brightness-110 transition-all"
          data-umami-event="mobile-nav:logo-click"
        >
          <BrandLogo className="text-gold" />
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/cart" className="relative" data-umami-event="mobile-nav:cart-click">
            <div className="flex items-center justify-center size-8 rounded-full border border-gold/20 bg-card/80 text-gold hover:bg-gold hover:text-black active:scale-95 transition-all duration-200 touch-manipulation">
              <ShoppingCart className="size-4" />
            </div>
          </Link>

          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="active:scale-95 transition-transform touch-manipulation"
            >
              <UserAvatar
                initials={initials}
                className="size-8"
                fallbackClassName="text-xs font-semibold"
              />
            </Link>
          ) : (
            <Link href="/auth/login">
              <div className="flex items-center justify-center h-8 px-3 rounded-full border border-gold/20 bg-card/80 text-gold text-xs font-medium hover:bg-gold hover:text-black active:scale-95 transition-all duration-200 touch-manipulation">
                Sign In
              </div>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
