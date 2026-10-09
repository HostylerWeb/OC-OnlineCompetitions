import {
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_CONTACT_EMAIL,
  LEGAL_REGISTERED_OFFICE_POSTAL,
} from "@oc/utils";
import type { AboutSection } from "./content-types";

export const ABOUT_HERO = {
  title: "About Online Competitions",
  subtitle:
    "We're on a mission to make luxury accessible to everyone through fair, transparent prize competitions.",
};

export const ABOUT_SECTIONS: AboutSection[] = [
  {
    id: "mission",
    title: "Our Mission",
    icon: "Sparkles",
    paragraphs: [
      "Online Competitions was founded with a simple belief: everyone deserves a chance to win amazing prizes. We curate exclusive luxury items and offer them at accessible ticket prices.",
      "Every competition is conducted with complete transparency, using certified random number generation to ensure fairness for all participants.",
    ],
  },
  {
    id: "why-choose",
    title: "Why Choose Online Competitions",
    icon: "ShieldCheck",
    iconClass: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20",
    whyChooseItems: [
      {
        title: "Fairness First",
        description:
          "Every draw uses certified random number generation for complete transparency.",
      },
      {
        title: "Instant Payouts",
        description: "Win and receive your prize immediately. No delays, no excuses.",
      },
      {
        title: "Verified Winners",
        description: "All winners are verified and publicly announced. Real people, real prizes.",
      },
      {
        title: "Community Driven",
        description: "Join thousands of players who trust Online Competitions for fair, exciting competitions.",
      },
    ],
  },
  {
    id: "commitment",
    title: "Our Commitment",
    icon: "Heart",
    iconClass: "from-pink-500/20 to-pink-500/5 border-pink-500/20",
    paragraphs: [
      "We are committed to providing a safe, fair, and enjoyable experience for all our members. Our team works tirelessly to ensure every competition meets the highest standards of integrity.",
      "From the prizes we select to the draws we conduct, every step is designed with our members in mind. Your trust means everything to us.",
    ],
  },
  {
    id: "company",
    title: "Company Information",
    icon: "Building",
    companyInfo: {
      name: LEGAL_COMPANY_NAME,
      number: LEGAL_COMPANY_NUMBER,
      address: LEGAL_REGISTERED_OFFICE_POSTAL,
      email: LEGAL_CONTACT_EMAIL,
    },
  },
  {
    id: "responsible",
    title: "Responsible Participation",
    icon: "AlertTriangle",
    iconClass: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
    responsibleGambling: {
      intro: "Our competitions are skill-based entertainment. Please participate responsibly.",
      items: [
        { text: "Only persons aged 18 or older may participate" },
        { text: "Treat competition entries as entertainment, not an investment" },
        {
          text: "If you need support, contact GamCare:",
          link: { href: "tel:08088020133", label: "0808 8020 133" },
        },
        {
          text: "Visit begambleaware.org for additional resources",
          link: { href: "https://www.begambleaware.org", label: "begambleaware.org" },
        },
      ],
    },
  },
];

export const ABOUT_CTA = {
  title: "Ready to Enter?",
  subtitle: "Join thousands of players already trying their luck on premium prizes.",
};
