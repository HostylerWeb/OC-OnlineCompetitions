"use client";

import { Menu } from "@oc/icons";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { DashboardAppSidebar } from "./DashboardAppSidebar";
import { DashboardMobileNav } from "./DashboardMobileNav";
import { Footer } from "./Footer";
import { DASHBOARD_SCROLL_ID } from "./header-layout";

const SCROLL_CONTAINER_ID = DASHBOARD_SCROLL_ID;

export function DashboardLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    document.getElementById(SCROLL_CONTAINER_ID)?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <DashboardMobileNav />
      <DashboardAppSidebar />

      <SidebarInset
        id={SCROLL_CONTAINER_ID}
        className="scrollbar-gutter-stable min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div className="oc-container-medium flex w-full min-w-0 flex-col gap-4 py-4 lg:gap-6 lg:py-8">
          <div className="md:hidden sticky top-0 z-20 -mx-4 self-stretch bg-background/95 px-4 pb-2 pt-0.5 backdrop-blur-sm">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-full border-gold/20 bg-card/80 px-3 text-sm hover:bg-gold/10"
              onClick={toggleSidebar}
            >
              <Menu className="size-4 text-gold" aria-hidden="true" />
              Menu
            </Button>
          </div>
          <Outlet />
        </div>
        <Footer />
      </SidebarInset>
    </div>
  );
}
