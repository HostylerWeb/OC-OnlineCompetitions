import { AuthProvider, QueryProvider } from "@oc/api-admin";
import { HOSTYLER_CONSOLE_NOTICE_INLINE } from "@oc/utils";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { BuildVersionWatcher } from "@/components/BuildVersionWatcher";
import { ErrorBoundary } from "@/components/error-boundary";
import { PwaInstallPrompt } from "@/components/layout/PwaInstallPrompt";
import { ScrollLockFix } from "@/components/ScrollLockFix";
import { CommandMenuProvider } from "@/components/shell/CommandMenuContext";
import { CommandMenuShortcutListener } from "@/components/shell/CommandMenuShortcutListener";
import "./globals.css";

const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: "Admin — Online Competitions",
    template: "%s — Online Competitions Admin",
  },
  description: "Online Competitions admin dashboard",
  icons: [{ rel: "icon", url: "/favicon.png", type: "image/png" }],
  manifest: "/manifest.webmanifest",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="hostyler-console-notice"
          dangerouslySetInnerHTML={{ __html: HOSTYLER_CONSOLE_NOTICE_INLINE }}
        />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <script
            defer
            src="https://umami.onlinecompetitions.co.uk/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}
        <script defer src="/sw-register.js" />
      </head>
      <body className={`${plusJakarta.variable} font-sans antialiased`}>
        <ScrollLockFix />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          storageKey="oc-theme"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary buildVersion={BUILD_VERSION}>
            <QueryProvider>
              <CommandMenuProvider>
                <BuildVersionWatcher />
                <CommandMenuShortcutListener />
                <Suspense fallback={null}>
                  <AuthProvider enableGuestSession={false}>{children}</AuthProvider>
                </Suspense>
                <PwaInstallPrompt
                  appName="Online Competitions Admin"
                  tagline="Add to your home screen for one-tap admin access"
                />
                <Toaster />
              </CommandMenuProvider>
            </QueryProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
