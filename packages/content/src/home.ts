import type { HomeFeature } from "./content-types";

export const HOME_BUILT_DIFFERENT = {
  title: "Built Different",
  subtitle: "Transparency, fairness, and excitement - built into every competition.",
};

export const HOME_FEATURES: HomeFeature[] = [
  {
    id: "fairness",
    title: "Fairness & Security",
    description:
      "Every draw is powered by a certified random number generator. No manipulation, no hidden rules - just pure, verifiable fairness.",
    icon: "Shield",
    variant: "featured",
    badges: [
      { label: "Secure", color: "green" },
      { label: "Verified", color: "gold" },
    ],
  },
  {
    id: "payouts",
    title: "Instant Payouts",
    description: "Win and receive your prize immediately. No delays, no excuses.",
    icon: "Zap",
    variant: "side",
  },
  {
    id: "community",
    title: "Community First",
    description: "Join thousands of players who trust Online Competitions for fair, exciting competitions.",
    icon: "Users",
    variant: "side",
  },
];

export const HOME_CTA = {
  title: "Ready to Win?",
  subtitle: "Join thousands of players already trying their luck on premium prizes.",
  trustBadges: [
    { icon: "Shield" as const, label: "Random Draw" },
    { icon: "Users" as const, label: "47,821+ Members" },
    { icon: "Zap" as const, label: "Verified Winners" },
  ],
};
