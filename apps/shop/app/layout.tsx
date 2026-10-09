import type { Metadata, Viewport } from "next";
import {
  BRAND_FAVICON_PATH,
  BRAND_LOGO_PATH,
  brandLogoUrl,
  HOSTYLER_CONSOLE_NOTICE_INLINE,
} from "@oc/utils";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { BuildVersionWatcher } from "@/components/build-version-watcher";
import { ErrorBoundary } from "@/components/error-boundary";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "./globals.css";

const BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const viewport: Viewport = {
  themeColor: "#C9A84C",
};

const shopUrl =
  process.env.NEXT_PUBLIC_SHOP_URL || process.env.APP_URL || "https://shop.onlinecompetitions.co.uk";

export const metadata: Metadata = {
  title: {
    default: "Shop  -  Online Competitions",
    template: "%s  -  Online Competitions Shop",
  },
  description: "Online Competitions official merchandise store  -  premium apparel and accessories.",
  icons: [
    { rel: "icon", url: BRAND_FAVICON_PATH, type: "image/png" },
    { rel: "apple-touch-icon", url: BRAND_LOGO_PATH, type: "image/png" },
  ],
  manifest: "/manifest.json",
  openGraph: {
    title: "Shop  -  Online Competitions",
    description: "Online Competitions official merchandise store  -  premium apparel and accessories.",
    siteName: "Online Competitions Shop",
    type: "website",
    locale: "en_GB",
    url: shopUrl,
    images: [
      {
        url: BRAND_LOGO_PATH,
        secureUrl: brandLogoUrl(shopUrl),
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable}`}>
      <head>
        <script
          id="hostyler-console-notice"
          dangerouslySetInnerHTML={{ __html: HOSTYLER_CONSOLE_NOTICE_INLINE }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Online Competitions",
              url: shopUrl,
              logo: brandLogoUrl(shopUrl),
            }),
          }}
        />
        <link rel="preconnect" href="https://assets.onlinecompetitions.co.uk" />
        <link rel="preconnect" href="https://assets.staging.onlinecompetitions.co.uk" />
        <link rel="dns-prefetch" href="https://assets.onlinecompetitions.co.uk" />
        <link rel="dns-prefetch" href="https://assets.staging.onlinecompetitions.co.uk" />
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <script
            defer
            src="https://umami.onlinecompetitions.co.uk/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}
        <AuthProvider>
          <ErrorBoundary buildVersion={BUILD_VERSION}>
            <BuildVersionWatcher />
            <Header />
            {children}
            <Footer />
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
