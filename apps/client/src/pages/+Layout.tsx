import { AuthProvider, playSiteSound } from "@oc/api-client";
import type { PublicComplianceSettings, SessionUser } from "@oc/types";
import { useEffect } from "react";
import { toast, Toaster } from "sonner";
import { usePageContext } from "vike-react/usePageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HeaderMobileNavProvider } from "@/components/layout/header-mobile-nav";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PwaInstallPrompt } from "@/components/layout/PwaInstallPrompt";
import { ProfileQueryHydrator } from "@/components/providers/ProfileQueryHydrator";
import { RoutePrefetcher } from "@/components/layout/RoutePrefetcher";
import { ReferralRefGateIsland } from "@/components/providers/ReferralRefGateIsland";
import { ScrollLockFix } from "@/components/ScrollLockFix";
import { ThemeProvider } from "@/components/ThemeProvider";
import { initHydrationDiffDetector } from "@/lib/hydration-diff-detector";
import { LocaleProvider } from "@/lib/i18n";

export default function Layout({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser | null;
}) {
  const pageContext = usePageContext();
  const complianceData = (
    pageContext as { complianceFeaturesData?: { data?: PublicComplianceSettings } }
  ).complianceFeaturesData;
  const guestCheckoutEnabled = complianceData?.data?.guestCheckoutEnabled;

  useEffect(() => {
    initHydrationDiffDetector();
    const toastApi = toast as typeof toast & { __errorSound?: boolean };
    if (toastApi.__errorSound) return;
    toastApi.__errorSound = true;
    const original = toast.error.bind(toast);
    toast.error = ((message, options) => {
      playSiteSound("error");
      return original(message, options);
    }) as typeof toast.error;
  }, []);

  return (
    <ErrorBoundary>
      <LocaleProvider locale={pageContext.locale ?? "en"}>
        <ThemeProvider defaultTheme="dark" storageKey="oc-theme">
          <AuthProvider initialUser={user} guestCheckoutEnabled={guestCheckoutEnabled}>
            <ProfileQueryHydrator />
            <ReferralRefGateIsland />
            <ScrollLockFix />
            <HeaderMobileNavProvider>
              <PublicLayout>{children}</PublicLayout>
              <PwaInstallPrompt />
              <RoutePrefetcher />
              <Toaster position="bottom-right" />
            </HeaderMobileNavProvider>
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </ErrorBoundary>
  );
}
