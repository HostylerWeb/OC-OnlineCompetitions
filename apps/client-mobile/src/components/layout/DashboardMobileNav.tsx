"use client";

import { X } from "@oc/icons";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useTranslation } from "@/lib/i18n";
import {
  DashboardMobileNavLink,
  DashboardMobileUserHeader,
  getStorefrontItems,
  useDashboardNavGroups,
} from "./dashboard-sidebar-shared";
import { MobileNavSheet } from "./mobile-nav-sheet";
import { mobileNavSectionClass } from "./mobile-nav-styles";

export function DashboardMobileNav() {
  const { t } = useTranslation();
  const { openMobile, setOpenMobile } = useSidebar();
  const navGroups = useDashboardNavGroups();

  const handleClose = () => setOpenMobile(false);

  const STOREFRONT_ITEMS = getStorefrontItems(t);

  return (
    <MobileNavSheet
      open={openMobile}
      onOpenChange={setOpenMobile}
      onClose={handleClose}
      side="left"
      title={t("header.mobile.dashboard")}
    >
      <div className="flex items-center justify-between gap-3 p-5 border-b border-gold/10">
        <DashboardMobileUserHeader />
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-full hover:bg-gold/10 shrink-0"
          onClick={handleClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain py-2">
        {navGroups.map((group) => (
          <div key={group.title} className="px-3 py-2">
            <p className={mobileNavSectionClass()}>{group.title}</p>
            {group.items.map((item) => (
              <DashboardMobileNavLink key={item.to} item={item} />
            ))}
          </div>
        ))}

        <div className="px-3 py-2 mt-2 border-t border-gold/10">
          <p className={mobileNavSectionClass()}>{t("header.mobile.storefront")}</p>
          {STOREFRONT_ITEMS.map((item) => (
            <DashboardMobileNavLink key={item.to} item={item} />
          ))}
        </div>
      </div>
    </MobileNavSheet>
  );
}
