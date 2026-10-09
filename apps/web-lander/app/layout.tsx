import type { Metadata, Viewport } from "next";
import { BRAND_FAVICON_PATH, BRAND_LOGO_PATH, brandLogoUrl, HOSTYLER_CONSOLE_NOTICE_INLINE } from "@oc/utils";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const landerUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agro.onlinecompetitions.co.uk";

export const metadata: Metadata = {
  title: {
    default: "Win Premium Prizes  -  Online Competitions",
    template: "%s  -  Online Competitions",
  },
  description:
    "Enter to win incredible prizes with Online Competitions. Browse active competitions, answer skill questions, and win instantly.",
  icons: [{ rel: "icon", url: BRAND_FAVICON_PATH, type: "image/png" }],
  openGraph: {
    siteName: "Online Competitions",
    type: "website",
    locale: "en_GB",
    url: landerUrl,
    images: [
      {
        url: BRAND_LOGO_PATH,
        secureUrl: brandLogoUrl(landerUrl),
        type: "image/png",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[var(--color-bg-deep)] font-body font-display">
      <head>
        <script
          id="hostyler-console-notice"
          dangerouslySetInnerHTML={{ __html: HOSTYLER_CONSOLE_NOTICE_INLINE }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Online Competitions",
              url: "https://onlinecompetitions.co.uk",
              logo: brandLogoUrl("https://onlinecompetitions.co.uk"),
            }),
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&family=Space+Mono&display=swap"
        />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
