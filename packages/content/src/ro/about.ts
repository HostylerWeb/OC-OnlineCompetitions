import {
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_CONTACT_EMAIL,
  LEGAL_REGISTERED_OFFICE_POSTAL,
} from "@oc/utils";
import type { AboutSection } from "../content-types";

export const ABOUT_HERO = {
  title: "Despre Online Competitions",
  subtitle:
    "Misiunea noastră este să facem luxul accesibil tuturor prin concursuri corecte și transparente cu premii.",
};

export const ABOUT_SECTIONS: AboutSection[] = [
  {
    id: "mission",
    title: "Misiunea Noastră",
    icon: "Sparkles",
    paragraphs: [
      "Online Competitions a fost fondat cu o credință simplă: toată lumea merită o șansă de a câștiga premii uimitoare. Selectăm articole de lux exclusive și le oferim la prețuri accesibile pentru bilete.",
      "Fiecare concurs este desfășurat cu transparență completă, folosind generare certificată de numere aleatoare pentru a asigura corectitudinea pentru toți participanții.",
    ],
  },
  {
    id: "why-choose",
    title: "De ce să Alegi Online Competitions",
    icon: "ShieldCheck",
    iconClass: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20",
    whyChooseItems: [
      {
        title: "Corectitudinea pe Primul Loc",
        description:
          "Fiecare extragere folosește generare certificată de numere aleatoare pentru transparență completă.",
      },
      {
        title: "Plăți Instant",
        description: "Câștigă și primește premiul imediat. Fără întârzieri, fără scuze.",
      },
      {
        title: "Câștigători Verificați",
        description:
          "Toți câștigătorii sunt verificați și anunțați public. Oameni reali, premii reale.",
      },
      {
        title: "Condus de Comunitate",
        description:
          "Alătură-te miilor de jucători care au încredere în Online Competitions pentru concursuri corecte și captivante.",
      },
    ],
  },
  {
    id: "commitment",
    title: "Angajamentul Nostru",
    icon: "Heart",
    iconClass: "from-pink-500/20 to-pink-500/5 border-pink-500/20",
    paragraphs: [
      "Ne angajăm să oferim o experiență sigură, corectă și plăcută pentru toți membrii noștri. Echipa noastră lucrează neobosit pentru a asigura că fiecare concurs respectă cele mai înalte standarde de integritate.",
      "De la premiile pe care le selectăm până la extragerile pe care le conducem, fiecare pas este conceput avându-i în minte pe membrii noștri. Încrederea ta înseamnă totul pentru noi.",
    ],
  },
  {
    id: "company",
    title: "Informații despre Companie",
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
    title: "Participare Responsabilă",
    icon: "AlertTriangle",
    iconClass: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
    responsibleGambling: {
      intro:
        "Concursurile noastre sunt divertisment bazat pe abilități. Te rugăm să participi responsabil.",
      items: [
        { text: "Doar persoanele de 18 ani sau peste pot participa" },
        { text: "Tratează participările la concurs ca divertisment, nu ca investiție" },
        {
          text: "Dacă ai nevoie de suport, contactează GamCare:",
          link: { href: "tel:08088020133", label: "0808 8020 133" },
        },
        {
          text: "Vizitează begambleaware.org pentru resurse suplimentare",
          link: { href: "https://www.begambleaware.org", label: "begambleaware.org" },
        },
      ],
    },
  },
];

export const ABOUT_CTA = {
  title: "Gata să Participi?",
  subtitle: "Alătură-te miilor de jucători care încearcă deja să câștige premii premium.",
};
