import { BRAND_LOGO_PATH, brandLogoUrl } from "@oc/utils";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ErrorDisplay } from "@/components/competition/error-display";
import { CompetitionLoadingSkeleton } from "@/components/competition/loading-skeleton";
import { IndexPage } from "@/components/index/index-page";
import { fetchGlobalStats, fetchLandingPageCompetitions } from "@/lib/api";

const landerUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agro.onlinecompetitions.co.uk";

export const metadata: Metadata = {
  title: "Win Premium Prizes — Online Competitions",
  description:
    "Enter to win incredible prizes with Online Competitions. Browse active competitions, answer skill questions, and win instantly.",
  openGraph: {
    title: "Win Premium Prizes — Online Competitions",
    description:
      "Enter to win incredible prizes with Online Competitions. Browse active competitions, answer skill questions, and win instantly.",
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
    siteName: "Online Competitions",
  },
};

async function HomePageContent() {
  try {
    const [competitionsRes, stats] = await Promise.all([
      fetchLandingPageCompetitions({ limit: 50 }),
      fetchGlobalStats(),
    ]);

    const competitions = competitionsRes.data;

    return <IndexPage competitions={competitions} stats={stats} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return <ErrorDisplay message={message} retryHref="/" />;
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={<CompetitionLoadingSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}
