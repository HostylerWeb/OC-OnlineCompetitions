import type { LegalSection } from "../../content-types";
import { CompanyEmailLink, LEGAL_COMPANY_REGISTRY_RO, CONTACT_PHONE_DISPLAY, LEGAL_COMPANY_NAME, LEGAL_COMPANY_NUMBER, LEGAL_REGISTERED_OFFICE, LEGAL_REGISTERED_OFFICE_POSTAL, BRAND_NAME, LEGAL_WEBSITE } from "../../legal/company-legal";

export const privacySections = [
  {
    id: "introduction",
    title: "1. Introducere",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          {LEGAL_COMPANY_NAME} (&quot;noi&quot;, &quot;al nostru&quot; sau &quot;nouă&quot;) se
          angajează să protejeze și să respecte confidențialitatea ta. Această Politică de
          Confidențialitate explică cum colectăm, folosim, dezvăluim și protejăm informațiile tale
          când folosești site-ul și serviciile noastre.
        </p>
        <p>
          Această politică este conformă cu Regulamentul General privind Protecția Datelor din
          Regatul Unit (UK GDPR) și cu Data Protection Act 2018. Te rugăm să citești cu atenție
          această Politică de Confidențialitate. Prin accesarea sau folosirea serviciilor noastre,
          confirmi că ai citit, înțeles și ești de acord să respecți toți termenii acestei Politici
          de Confidențialitate.
        </p>
      </div>
    ),
  },
  {
    id: "data-collected",
    title: "2. Informațiile pe Care le Colectăm",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Colectăm următoarele tipuri de informații:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Numele complet, adresa de email, numărul de telefon și adresa poștală</li>
          <li>Data nașterii și informații de verificare a vârstei</li>
          <li>Informații de plată și tranzacții (procesate în siguranță)</li>
          <li>Istoricul participărilor la concursuri și al achizițiilor de bilete</li>
          <li>Preferințe de comunicare și consimțământ de marketing</li>
          <li>
            Date de utilizare și analize când vizitezi site-ul nostru (inclusiv informații despre
            dispozitiv, istoric de navigare și statistici de sesiune)
          </li>
          <li>
            Identificatori unici pentru publicitate (Google Advertiser ID, IDFA) pentru scopuri de
            publicitate bazată pe interese
          </li>
        </ul>
        <p>
          Cu excepția cazurilor specificate altfel, toate Datele solicitate de acest Site Web sunt
          obligatorii, iar nedezvăluirea acestor Date poate face imposibilă furnizarea serviciilor
          de către acest Site Web.
        </p>
      </div>
    ),
  },
  {
    id: "how-used",
    title: "3. Cum Folosim Informațiile Tale",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Folosim informațiile tale pentru:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Procesarea participărilor la concursuri și a achizițiilor de bilete</li>
          <li>Notificarea câștigătorilor și aranjarea livrării premiilor</li>
          <li>Furnizarea de asistență clienți și răspunsul la întrebări</li>
          <li>Trimiterea de comunicări promoționale (cu consimțământul tău)</li>
          <li>Îmbunătățirea site-ului și serviciilor noastre</li>
          <li>Detectarea și prevenirea fraudei și activităților malițioase</li>
          <li>
            Analizarea tendințelor de utilizare și determinarea eficacității campaniilor
            promoționale
          </li>
        </ul>
        <p className="font-semibold text-foreground mt-4">
          Nu vindem niciodată informațiile tale personale.
        </p>
      </div>
    ),
  },
  {
    id: "legal-basis",
    title: "4. Baza Legală pentru Procesare",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Procesăm datele tale pe următoarele baze legale:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Contract:</strong> Pentru a îndeplini acordul cu tine când achiziționezi bilete
          </li>
          <li>
            <strong>Consimțământ:</strong> Pentru comunicările de marketing la care ai optat
          </li>
          <li>
            <strong>Interese legitime:</strong> Pentru prevenirea fraudei, securitate, îmbunătățirea
            serviciilor și anumite activități de marketing direct
          </li>
          <li>
            <strong>Obligație legală:</strong> Pentru a respecta legile și reglementările aplicabile
          </li>
        </ul>
        <p className="mt-3">
          Când procesăm informațiile tale personale pentru interesele noastre legitime, ne asigurăm
          că luăm în considerare și echilibrăm orice impact potențial asupra ta (atât pozitiv, cât
          și negativ), precum și drepturile tale în temeiul legilor de protecție a datelor.
        </p>
      </div>
    ),
  },
  {
    id: "data-sharing",
    title: "5. Partajarea Datelor și Servicii Terțe",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Putem partaja datele tale cu următorii furnizori terți de servicii:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>PayPal</strong> - Procesare plăți. Politica lor de confidențialitate guvernează
            utilizarea datelor tale.
          </li>
          <li>
            <strong>Resend</strong> - Serviciu de livrare email pentru emailuri tranzacționale și de
            marketing.
          </li>
          <li>
            <strong>Google Analytics 4</strong> - Analiză site web. Date personale procesate: număr
            de Utilizatori, statistici de sesiune, Trackere, Date de Utilizare.{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Politica de Confidențialitate
            </a>
          </li>
          <li>
            <strong>Meta Pixel</strong> - Urmărirea conversiilor publicitare. Date personale
            procesate: Trackere, Date de Utilizare.{" "}
            <a
              href="https://www.facebook.com/privacy/policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Politica de Confidențialitate
            </a>
          </li>
          <li>
            <strong>Microsoft Clarity</strong> - Hărți termice și înregistrare sesiuni. Date
            personale procesate: Date de Utilizare.{" "}
            <a
              href="https://privacy.microsoft.com/privacystatement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Politica de Confidențialitate
            </a>
          </li>
          <li>
            <strong>Klaviyo</strong> - Marketing prin email. Date personale procesate: țara, adresa
            de email, prenumele, numele, numărul de telefon, istoricul achizițiilor.{" "}
            <a
              href="https://www.klaviyo.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Politica de Confidențialitate
            </a>
          </li>
          <li>
            <strong>Sentry</strong> - Monitorizare erori și infrastructură.{" "}
            <a
              href="https://sentry.io/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              Politica de Confidențialitate
            </a>
          </li>
          <li>
            <strong>Google Fonts</strong> - Serviciu de vizualizare a fonturilor pentru afișarea
            conținutului.
          </li>
          <li>
            <strong>Google Cloud CDN</strong> - Optimizare și distribuire trafic.
          </li>
        </ul>
        <p className="mt-3">
          De asemenea, partajăm date cu autoritățile legale când este cerut de lege și cu partenerii
          de concurs pentru onorarea premiilor.
        </p>
        <p className="mt-3">
          Solicităm tuturor terților să gestioneze datele tale în siguranță și în conformitate cu
          legile aplicabile.
        </p>
      </div>
    ),
  },
  {
    id: "advertising",
    title: "6. Publicitate Bazată pe Interese",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Folosim tehnologii de urmărire și servicii publicitare pentru a afișa reclame
          personalizate bazate pe interesele tale. Acestea includ:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>Urmărirea conversiilor prin reclame Meta (Meta Pixel)</li>
          <li>Microsoft Advertising Universal Event Tracking</li>
          <li>Serviciul publicitar Taboola</li>
          <li>Serviciul publicitar Adalyser</li>
        </ul>
        <p className="mt-3">
          Poți renunța la publicitatea bazată pe interese vizitând secțiunile relevante de renunțare
          din Politica noastră de Cookie-uri sau contactându-ne la{" "}
          <CompanyEmailLink />
          .
        </p>
      </div>
    ),
  },
  {
    id: "rights",
    title: "7. Drepturile Tale",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>În temeiul UK GDPR și al Data Protection Act 2018, ai următoarele drepturi:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Acces:</strong> Obținerea unei copii a datelor personale pe care le deținem
            despre tine
          </li>
          <li>
            <strong>Rectificare:</strong> Corectarea oricăror informații inexacte sau incomplete
          </li>
          <li>
            <strong>Ștergere:</strong> Solicitarea ștergerii datelor tale (sub rezerva cerințelor
            legale)
          </li>
          <li>
            <strong>Restricționare:</strong> Solicitarea restricționării procesării datelor tale
          </li>
          <li>
            <strong>Opoziție:</strong> Opoziția față de anumite activități de procesare, inclusiv
            marketingul direct
          </li>
          <li>
            <strong>Portabilitate:</strong> Primirea datelor tale într-un format structurat,
            utilizat în mod obișnuit
          </li>
          <li>
            <strong>Retragerea consimțământului:</strong> Retragerea consimțământului în orice
            moment când procesarea se bazează pe consimțământul tău
          </li>
          <li>
            <strong>Depunerea unei plângeri:</strong> Contactarea Information Commissioner&apos;s
            Office (ICO) dacă crezi că nu am gestionat corect datele tale - vizitează{" "}
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              ico.org.uk
            </a>
          </li>
        </ul>
        <p className="mt-3">
          Pentru a exercita oricare dintre aceste drepturi, contactează-ne la{" "}
          <CompanyEmailLink />
          . Vom răspunde în termen de o lună.
        </p>
      </div>
    ),
  },
  {
    id: "cookies",
    title: "8. Cookie-uri",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Folosim cookie-uri și tehnologii similare (Trackere) pentru a menține starea sesiunii, a
          reține preferințele tale, a înțelege cum folosești site-ul nostru și a livra publicitate
          relevantă.
        </p>
        <p>
          Când vizitezi site-ul nostru pentru prima dată, ți se va afișa un banner de consimțământ
          pentru cookie-uri unde poți alege ce categorii de cookie-uri accepți.
        </p>
        <p>
          Cookie-urile esențiale sunt necesare pentru funcționarea corectă a site-ului și sunt
          întotdeauna active. Cookie-urile opționale necesită consimțământul tău și pot fi
          gestionate prin setările browserului sau prin revizuirea preferințelor tale de cookie-uri.
        </p>
        <p>
          Pentru detalii complete despre cookie-urile pe care le folosim și cum să-ți gestionezi
          preferințele, te rugăm să vezi{" "}
          <a href="/cookie-policy" className="text-gold hover:underline">
            Politica de Cookie-uri
          </a>
          .
        </p>
      </div>
    ),
  },
  {
    id: "security",
    title: "9. Securitatea Datelor",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Implementăm măsuri de securitate adecvate pentru a proteja datele tale personale împotriva
          accesului neautorizat, dezvăluirii, modificării sau distrugerii. Acestea includ criptare
          SSL, servere securizate și audituri regulate de securitate.
        </p>
        <p>
          Deși ne străduim să protejăm informațiile tale, nicio metodă de transmisie pe internet nu
          este 100% sigură. Nu putem garanta securitatea absolută.
        </p>
      </div>
    ),
  },
  {
    id: "retention",
    title: "10. Păstrarea Datelor",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Păstrăm datele tale personale doar atât timp cât este necesar pentru a îndeplini scopurile
          pentru care au fost colectate, inclusiv pentru a satisface orice cerințe legale, contabile
          sau de raportare.
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>Participări la concursuri și istoric achiziții:</strong> Păstrate timp de 7 ani
            după ultima ta activitate în scopuri legale și contabile
          </li>
          <li>
            <strong>Datele contului:</strong> Păstrate până când soliciți ștergerea sau închizi
            contul
          </li>
          <li>
            <strong>Preferințe de marketing:</strong> Păstrate până când retragi consimțământul sau
            soliciți ștergerea
          </li>
          <li>
            <strong>Înregistrări de comunicare:</strong> Păstrate timp de 3 ani după ultima
            comunicare
          </li>
        </ul>
        <p className="mt-3">
          După aceste perioade, datele sunt șterse sau anonimizate în siguranță, în conformitate cu
          politica noastră de păstrare a datelor. Dreptul de acces, dreptul de ștergere, dreptul de
          rectificare și dreptul la portabilitatea datelor nu pot fi exercitate după expirarea
          perioadei de păstrare.
        </p>
      </div>
    ),
  },
  {
    id: "international",
    title: "11. Transferuri Internaționale de Date",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Datele tale personale pot fi transferate și procesate în țări diferite de a ta. Când
          transferăm date la nivel internațional, ne asigurăm că există garanții adecvate, cum ar fi
          Clauzele Contractuale Standard sau decizii de adecvare ale Guvernului Regatului Unit.
        </p>
        <p>
          Ai dreptul să afli despre baza legală pentru transferurile de Date în străinătate,
          inclusiv către orice organizație internațională guvernată de dreptul public internațional.
        </p>
      </div>
    ),
  },
  {
    id: "changes",
    title: "12. Modificări ale Acestei Politici",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Putem actualiza această Politică de Confidențialitate din când în când. Orice modificări
          vor fi postate pe această pagină cu o dată actualizată a ultimei modificări. Te încurajăm
          să revizuiești periodic această politică pentru a fi informat despre cum îți protejăm
          informațiile.
        </p>
        <p>
          Dacă modificările afectează activitățile de procesare efectuate pe baza consimțământului
          tău, vom colecta un nou consimțământ de la tine acolo unde este necesar.
        </p>
      </div>
    ),
  },
  {
    id: "contact",
    title: "13. Contactează-ne",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Dacă ai orice întrebări despre această Politică de Confidențialitate sau despre practicile
          noastre privind datele, te rugăm să ne contactezi:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            Email:{" "}
            <CompanyEmailLink />
          </li>
          <li>
            Poștă: {BRAND_NAME}, {LEGAL_REGISTERED_OFFICE_POSTAL}
          </li>
          <li>Companie: {LEGAL_COMPANY_REGISTRY_RO}</li>
        </ul>
      </div>
    ),
  },
];

export type { LegalSection };
