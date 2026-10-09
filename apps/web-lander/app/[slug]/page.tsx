import { BRAND_LOGO_PATH } from "@oc/utils";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CompetitionLanding } from "@/components/competition/competition-landing";
import { ErrorDisplay } from "@/components/competition/error-display";
import { CompetitionLoadingSkeleton } from "@/components/competition/loading-skeleton";
import { fetchCompetitionLandingPage } from "@/lib/api";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const landerUrl = process.env.NEXT_PUBLIC_APP_URL || "https://agro.onlinecompetitions.co.uk";
  try {
    const { competition } = await fetchCompetitionLandingPage(slug);

    const imageUrl = competition.heroImageUrl || competition.prizeImageUrl || BRAND_LOGO_PATH;
    const imageSecureUrl = imageUrl.startsWith("http")
      ? imageUrl
      : `${landerUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;

    return {
      title: competition.title,
      description:
        competition.shortDescription ??
        competition.description ??
        `Enter to win ${competition.title} on Online Competitions.`,
      openGraph: {
        title: competition.title,
        description: competition.shortDescription ?? competition.description,
        url: `${landerUrl}/${slug}`,
        images: [
          {
            url: imageUrl,
            secureUrl: imageSecureUrl,
            type: "image/png",
            width: 1200,
            height: 630,
          },
        ],
        siteName: "Online Competitions",
        type: "website",
      },
    };
  } catch {
    return {
      title: "Competition",
      description: "Enter to win on Online Competitions.",
    };
  }
}

async function CompetitionPage({ slug }: { slug: string }) {
  try {
    const { competition, availability, instantPrizes, winners, winnerStats, otherCompetitions } =
      await fetchCompetitionLandingPage(slug);

    return (
      <CompetitionLanding
        competition={competition}
        availability={availability}
        instantPrizes={instantPrizes}
        winners={winners}
        winnerStats={winnerStats}
        otherCompetitions={otherCompetitions}
      />
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";

    const is404 = message.includes("404") || message.toLowerCase().includes("not found");

    return (
      <ErrorDisplay
        message={
          is404
            ? "This competition could not be found. It may have ended or the link may be incorrect."
            : message
        }
        retryHref={`/${slug}`}
      />
    );
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<CompetitionLoadingSkeleton />}>
      <CompetitionPage slug={slug} />
    </Suspense>
  );
}
