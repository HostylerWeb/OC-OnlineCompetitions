import type { HomeFeature } from "../content-types";

export const HOME_BUILT_DIFFERENT = {
  title: "Construit Altfel",
  subtitle: "Transparență, corectitudine și entuziasm - integrate în fiecare concurs.",
};

export const HOME_FEATURES: HomeFeature[] = [
  {
    id: "fairness",
    title: "Corectitudine și Siguranță",
    description:
      "Fiecare extragere este alimentată de un generator de numere aleatoare certificat. Fără manipulare, fără reguli ascunse - doar corectitudine pură și verificabilă.",
    icon: "Shield",
    variant: "featured",
    badges: [
      { label: "Sigur", color: "green" },
      { label: "Verificat", color: "gold" },
    ],
  },
  {
    id: "payouts",
    title: "Plăți Instant",
    description: "Câștigă și primește premiul imediat. Fără întârzieri, fără scuze.",
    icon: "Zap",
    variant: "side",
  },
  {
    id: "community",
    title: "Comunitatea pe Primul Loc",
    description:
      "Alătură-te miilor de jucători care au încredere în Online Competitions pentru concursuri corecte și captivante.",
    icon: "Users",
    variant: "side",
  },
];

export const HOME_CTA = {
  title: "Gata să Câștigi?",
  subtitle: "Alătură-te miilor de jucători care încearcă deja să câștige premii premium.",
  trustBadges: [
    { icon: "Shield" as const, label: "Extragere Aleatorie" },
    { icon: "Users" as const, label: "47.821+ Membri" },
    { icon: "Zap" as const, label: "Câștigători Verificați" },
  ],
};
