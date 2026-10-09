import type { ContentFeature, HowItWorksAltPath, HowItWorksStep } from "./content-types";


export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    stepNumber: 1,
    title: "Browse Competitions",
    description: "Explore our luxury competitions and find a prize that excites you.",
    icon: "Search",
  },
  {
    stepNumber: 2,
    title: "Select Your Tickets",
    description: "Choose how many tickets you'd like - more tickets increase your chances.",
    icon: "Ticket",
  },
  {
    stepNumber: 3,
    title: "Skill Question (when required)",
    description:
      "Some competitions ask one multiple-choice question. Answer correctly to complete your entry.",
    icon: "Gamepad2",
  },
  {
    stepNumber: 4,
    title: "Complete Purchase",
    description: "Quick and secure checkout with card, Apple Pay or Google Pay.",
    icon: "CreditCard",
  },
  {
    stepNumber: 5,
    title: "Await the Draw",
    description: "Sit back and watch the countdown. Winners are selected at random.",
    icon: "Clock",
  },
  {
    stepNumber: 6,
    title: "Win & Celebrate",
    description: "Winners are notified by email and prizes dispatched within 14 days.",
    icon: "Trophy",
  },
];

export const HOW_IT_WORKS_ALT_PATHS: HowItWorksAltPath[] = [
  {
    title: "Free Postal Entry",
    description:
      "Prefer not to pay online? Send a free postal entry for any active competition.",
    icon: "Mail",
    href: "/free-postal-entry",
  },
  {
    title: "Refer Friends",
    description: "Share Online Competitions and earn free tickets when friends enter.",
    icon: "Users",
    href: "/dashboard/referrals",
  },
];

export const HOW_IT_WORKS_FEATURES: ContentFeature[] = [
  {
    title: "Verified Random Draws",
    description: "Every winner is selected using certified random number generation.",
    icon: "Shield",
  },
  {
    title: "Secure Payments",
    description: "Encrypted checkout with fraud protection on every order.",
    icon: "Lock",
  },
  {
    title: "Dedicated Support",
    description: "Our team is here to help every day during business hours.",
    icon: "Headphones",
  },
];
