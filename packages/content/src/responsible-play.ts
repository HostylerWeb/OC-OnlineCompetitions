export interface ResponsiblePlaySection {
  id: string;
  title: string;
  content: string;
}

export const RESPONSIBLE_PLAY_SECTIONS: ResponsiblePlaySection[] = [
  {
    id: "age",
    title: "Age verification",
    content:
      "You must be 18 or over to enter Online Competitions competitions. We verify age using your date of birth at sign-up and before checkout. Third-party identity providers may be introduced in future to strengthen verification.",
  },
  {
    id: "credit-cap",
    title: "£250 monthly credit card limit",
    content:
      "In line with the UK Voluntary Code, we limit credit card spend to £250 per calendar month across all competitions. Debit cards, Apple Pay, and Google Pay are not subject to this cap. Your remaining allowance is shown at checkout when the limit applies.",
  },
  {
    id: "instant-win",
    title: "Instant win payment restrictions",
    content:
      "When your basket includes an instant-win competition, credit cards cannot be used. Debit cards and digital wallets remain available.",
  },
  {
    id: "spend-limits",
    title: "Personal spend limits",
    content:
      "You can set a monthly spend limit in your dashboard under Responsible Play. Decreases take effect immediately; increases apply after a 24-hour cooling-off period. We encourage setting a limit before further entries after your first purchase.",
  },
  {
    id: "self-exclusion",
    title: "Self-exclusion",
    content:
      "You can self-exclude for 6 months, 1 year, 5 years, or permanently. During exclusion your account is suspended, marketing emails stop, and you cannot enter competitions. Contact us if you need help reversing a temporary exclusion after it expires.",
  },
  {
    id: "postal",
    title: "Free postal entry",
    content:
      "Free postal entry is available for active competitions. Send your entry to the address shown on our Free Postal Entry page, including your Online Competitions account email and competition details. Free and paid entries are treated equally in the draw.",
  },
  {
    id: "draws",
    title: "Draw integrity",
    content:
      "Main prize draws use verifiable random selection during our livestream. Draw dates and advertised prizes are not reduced because of ticket sales. Postal entries are processed manually and included fairly alongside paid entries.",
  },
];

export const SUPPORT_ORGANISATIONS = [
  {
    name: "GamCare",
    url: "https://www.gamcare.org.uk/",
    description: "Free information, advice and support for anyone affected by gambling.",
  },
  {
    name: "National Gambling Helpline",
    url: "tel:08088020133",
    description: "Call 0808 8020 133 — free, confidential, 24/7.",
  },
  {
    name: "Citizens Advice",
    url: "https://www.citizensadvice.org.uk/",
    description: "Help with debt, money and consumer issues.",
  },
  {
    name: "Money Advice Trust",
    url: "https://www.moneyadvicetrust.org/",
    description: "National Debtline and money guidance.",
  },
] as const;
