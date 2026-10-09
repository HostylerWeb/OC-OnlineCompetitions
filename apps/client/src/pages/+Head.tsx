import "../index.css";
import type { ApiResponse, Profile } from "@oc/types";
import { getEnv } from "@oc/env/vike";
import {
  BRAND_FAVICON_PATH,
  brandLogoUrl,
  HOSTYLER_CONSOLE_NOTICE_INLINE,
  withAssetCacheVersion,
} from "@oc/utils";
import { usePageContext } from "vike-react/usePageContext";

const DEFAULT_DESC =
  "Enter competitions on Online Competitions to win incredible prizes, from premium electronics and designer fashion to unforgettable luxury experiences. Play skill-based contests and try instant win games.";

export function Head() {
  const pageContext = usePageContext();
  const locale = pageContext.locale ?? "en";
  const localeData = pageContext.localeData as Record<string, unknown> | null;
  const headData = localeData?.head as Record<string, string> | undefined;

  const description = pageContext.defaultDescription ?? headData?.description ?? DEFAULT_DESC;
  const umamiId = getEnv("UMAMI_WEBSITE_ID");
  const siteName = headData?.siteName ?? "Online Competitions";
  const baseUrl = getEnv("APP_URL");
  const profileInitialData = (pageContext as { profileInitialData?: ApiResponse<Profile> | null })
    .profileInitialData;
  const avatarPreloadHref = profileInitialData?.data?.avatarUrl
    ? withAssetCacheVersion(profileInitialData.data.avatarUrl, profileInitialData.data.updatedAt)
    : null;

  return (
    <>
      <script
        id="hostyler-console-notice"
        dangerouslySetInnerHTML={{ __html: HOSTYLER_CONSOLE_NOTICE_INLINE }}
      />
      <html lang={locale} />
      <meta name="description" content={description} />
      <meta name="theme-color" content="#C9A84C" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@500;600&display=swap"
        rel="stylesheet"
      />
      <link rel="icon" type="image/png" href={BRAND_FAVICON_PATH} />
      {avatarPreloadHref ? (
        <link rel="preload" as="image" href={avatarPreloadHref} fetchPriority="high" />
      ) : null}

      {pageContext.nonce && <style nonce={pageContext.nonce} />}

      {umamiId && (
        <script defer src="https://umami.onlinecompetitions.co.uk/script.js" data-website-id={umamiId} />
      )}

      <script defer src="/sw-register.js" />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: siteName,
            url: baseUrl,
            logo: brandLogoUrl(baseUrl),
          }),
        }}
      />
    </>
  );
}
