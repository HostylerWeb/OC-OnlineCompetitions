import { QueryProvider } from "@oc/api-client";
import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollLockFix } from "@/components/ScrollLockFix";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useRouteChangeHaptics } from "@/hooks/useRouteChangeHaptics";
import { LocaleProvider, resolveInitialLocale } from "@/lib/i18n";
import { AppRoutes } from "@/routes";

function AppInner() {
  useRouteChangeHaptics();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="oc-theme">
        <LocaleProvider locale={resolveInitialLocale()}>
          <QueryProvider>
            <ScrollLockFix />
            <Suspense fallback={null}>
              <AppRoutes />
            </Suspense>
            <Toaster position="bottom-center" />
          </QueryProvider>
        </LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
