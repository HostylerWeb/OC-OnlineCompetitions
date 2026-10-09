import type { LegalSection } from "../../content-types";
import { CompanyEmailLink, LEGAL_COMPANY_REGISTRY_RO, CONTACT_PHONE_DISPLAY, LEGAL_COMPANY_NAME, LEGAL_COMPANY_NUMBER, LEGAL_REGISTERED_OFFICE, LEGAL_REGISTERED_OFFICE_POSTAL, BRAND_NAME, LEGAL_WEBSITE } from "../../legal/company-legal";

export const cookiePolicySections = [
  {
    id: "what-are-cookies",
    title: "1. Ce Sunt Cookie-urile?",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Cookie-urile sunt fișiere text mici care sunt plasate pe dispozitivul tău când vizitezi un
          site web. Acestea ajută site-urile să își amintească preferințele tale, să înțeleagă cum
          folosești site-ul și să îți îmbunătățească experiența generală de navigare.
        </p>
        <p>
          Cookie-urile sunt utilizate pe scară largă pe internet, iar site-ul nostru folosește
          cookie-uri pentru a-ți oferi o experiență sigură, eficientă și personalizată.
        </p>
      </div>
    ),
  },
  {
    id: "how-we-use",
    title: "2. Cum Folosim Cookie-urile",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Folosim cookie-uri în mai multe scopuri:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Menținerea sesiunii tale și păstrarea autentificării</li>
          <li>Amintirea preferințelor tale (cum ar fi limba și articolele din coș)</li>
          <li>Înțelegerea modului în care folosești site-ul nostru prin analize</li>
          <li>Îmbunătățirea performanței site-ului și a experienței utilizatorului</li>
          <li>Furnizarea de reclame targetate (cu consimțământul tău)</li>
        </ul>
      </div>
    ),
  },
  {
    id: "types",
    title: "3. Tipurile de Cookie-uri pe Care le Folosim",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Site-ul nostru folosește următoarele categorii de cookie-uri:</p>

        <h4 className="font-semibold text-foreground mt-4">Cookie-uri Necesare</h4>
        <p>
          Aceste cookie-uri sunt esențiale pentru funcționarea site-ului nostru. Acestea includ, de
          exemplu, cookie-uri care te mențin autentificat și care îți amintesc articolele din coș.
        </p>

        <h4 className="font-semibold text-foreground mt-4">Cookie-uri de Analiză</h4>
        <p>
          Aceste cookie-uri ne ajută să înțelegem cum vizitatorii interacționează cu site-ul nostru,
          oferindu-ne informații despre paginile vizitate, timpul petrecut pe site și erorile
          întâlnite.
        </p>

        <h4 className="font-semibold text-foreground mt-4">Cookie-uri Funcționale</h4>
        <p>
          Aceste cookie-uri permit site-ului nostru să rețină alegerile pe care le faci (cum ar fi
          limba sau regiunea) și să ofere funcții îmbunătățite.
        </p>

        <h4 className="font-semibold text-foreground mt-4">Cookie-uri de Publicitate</h4>
        <p>
          Aceste cookie-uri sunt folosite pentru a-ți afișa reclame relevante în funcție de
          interesele tale. De asemenea, ele limitează de câte ori vezi o reclamă și ajută la
          măsurarea eficacității campaniilor publicitare.
        </p>
      </div>
    ),
  },
  {
    id: "third-party",
    title: "4. Cookie-uri Terțe",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Folosim servicii terțe care plasează propriile cookie-uri pe dispozitivul tău:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Google Analytics</strong> — Analiza traficului și comportamentului
            utilizatorilor
          </li>
          <li>
            <strong>Google Ads</strong> — Publicitate targetată și remarketing
          </li>
          <li>
            <strong>Microsoft Clarity</strong> — Înregistrarea sesiunilor utilizatorilor și hărți
            termice
          </li>
          <li>
            <strong>Klaviyo</strong> — Marketing prin email și preferințele clienților
          </li>
          <li>
            <strong>Sentry</strong> — Monitorizarea erorilor aplicației
          </li>
        </ul>
        <p className="mt-3">
          Cookie-urile terțe sunt guvernate de politicile de confidențialitate respective ale
          fiecărui furnizor.
        </p>
      </div>
    ),
  },
  {
    id: "managing-preferences",
    title: "5. Gestionarea Preferințelor Tale",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Când vizitezi site-ul nostru pentru prima dată, ți se va afișa un banner de consimțământ
          pentru cookie-uri unde poți alege ce categorii de cookie-uri accepți.
        </p>
        <p>Poți modifica preferințele oricând:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Făcând clic pe "Preferințe Cookie" în subsolul paginii</li>
          <li>
            Revenind la bannerul de consimțământ (ștergerea preferințelor salvate îl va afișa din
            nou)
          </li>
          <li>Ajutând setările browserului pentru a gestiona sau bloca cookie-urile</li>
        </ul>
        <p className="mt-3">
          Te rugăm să reții că dezactivarea anumitor cookie-uri poate afecta funcționalitatea
          site-ului nostru.
        </p>
      </div>
    ),
  },
  {
    id: "updates",
    title: "6. Actualizări ale Acestei Politici",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Este posibil să actualizăm această Politică de Cookie-uri din când în când pentru a
          reflecta modificări în utilizarea cookie-urilor sau cerințe legale. Orice modificări vor
          fi postate pe această pagină cu o dată actualizată a ultimei modificări.
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    title: "7. Contactează-ne",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Dacă ai întrebări despre utilizarea cookie-urilor de către noi, te rugăm să ne contactezi:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            Email:{" "}
            <CompanyEmailLink />
          </li>
          <li>Companie: {LEGAL_COMPANY_REGISTRY_RO}</li>
          <li>Sediu social: {LEGAL_REGISTERED_OFFICE_POSTAL}</li>
        </ul>
      </div>
    ),
  },
];

export type { LegalSection };
