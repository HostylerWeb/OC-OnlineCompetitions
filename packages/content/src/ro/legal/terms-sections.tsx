import type { LegalSection } from "../../content-types";
import {
  BRAND_NAME,
  CompanyEmailLink,
  CONTACT_PHONE_DISPLAY,
  LEGAL_COMPANY_NAME,
  LEGAL_COMPANY_NUMBER,
  LEGAL_REGISTERED_OFFICE,
  LEGAL_WEBSITE,
  LEGAL_WEBSITE_URL,
} from "../../legal/company-legal";

export const termsSections = [
  {
    id: "promotor",
    title: "1. PROMOTORUL ȘI CINE SUNTEM",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          SUNTEM {LEGAL_COMPANY_NAME}, o companie înregistrată în Scoția cu numărul de companie {LEGAL_COMPANY_NUMBER}. Sediu nostru social este la {LEGAL_REGISTERED_OFFICE}.
          Suntem &ldquo;Promotorul&rdquo; extragerii cu premii (&ldquo;Extragerea&rdquo;) operată la
          OC &ndash; Site-ul Oficial {BRAND_NAME} &ndash; Donează și câștigă mașini,
          bani, premii instant ({LEGAL_WEBSITE}) (&ldquo;Site-ul Web&rdquo;), ceea ce înseamnă că suntem
          responsabili pentru buna și corecta desfășurare a acesteia.
        </p>
        <p>
          Acești Termeni se aplică ție ca participant la Extragere și ca client al nostru ("tu", "al
          tău") și guvernează modul în care funcționează Extragerea.
        </p>
      </div>
    ),
  },
  {
    id: "terms",
    title: "2. ACEȘTI TERMENI ȘI CONDIȚII",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          2.1. Acești termeni și condiții ("Termenii") te informează despre cum operăm fiecare
          Extragere și regulile de participare.
        </p>
        <p>
          2.2. Ar trebui să citești întotdeauna acești Termeni pentru a te asigura că îi înțelegi
          înainte de a participa la orice Extragere.
        </p>
        <p>
          2.3. Putem modifica acești Termeni din când în când, așa că ar trebui să verifici această
          pagină de fiecare dată când participi la o Extragere. Te vom anunța pe Site-ul nostru Web
          dacă am actualizat Termenii și orice modificări se vor aplica de la data publicării lor pe
          Site-ul nostru Web.
        </p>
        <p>
          2.4. Prin participarea la orice Extragere, accepți că înțelegi acești Termeni și Politica
          noastră de Confidențialitate și ești de acord să fii obligat legal de aceștia. Politica
          noastră de Confidențialitate poate fi găsită aici{" "}
          <a href="/privacy" className="text-gold hover:underline">
            {LEGAL_WEBSITE_URL}/privacy
          </a>
          .
        </p>
        <p>
          2.5. Dacă ai întrebări, nelămuriri sau reclamații legate de o Extragere, te rugăm să ne
          contactezi la{" "}
          <CompanyEmailLink />{" "}
          sau {CONTACT_PHONE_DISPLAY}.
        </p>
        <p>
          2.6. Dacă întâmpini dificultăți în accesarea sau participarea la această promoție, te
          rugăm să ne contactezi la{" "}
          <CompanyEmailLink />{" "}
          sau {CONTACT_PHONE_DISPLAY}.
        </p>
        <p>
          2.7. Dacă dorești acești termeni și condiții într-un alt format (de exemplu: audio,
          caractere mari, braille), te rugăm să ne contactezi și vom încerca să ți-l oferim.
        </p>
      </div>
    ),
  },
  {
    id: "entry-rules",
    title: "3. REGULI DE PARTICIPARE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>3.1.0 Este permis un singur Cont per Gospodărie.</p>
        <p>
          3.1. Fiecare Extragere este deschisă tuturor persoanelor cu vârsta de 18 ani și peste care
          sunt rezidente în Anglia, Țara Galilor și Scoția.
        </p>
        <p>3.2. Prin participarea la o Extragere, confirmi că:</p>
        <p>3.2.1. ai cel puțin 18 ani;</p>
        <p>3.2.2. ai capacitatea legală de a participa la Extragere;</p>
        <p>
          3.2.3. Respecți toate cerințele legale din țara ta de rezidență cu privire la participarea
          la acest concurs cu premii și la concursurile cu premii în general și ești în mod legal
          eligibil să participi la Extragere (și îți recomandăm să soliciți consiliere juridică
          și/sau să verifici cu autoritățile relevante în acest sens);
        </p>
        <p>
          3.2.4. Accepți acești Termeni și alte cerințe ale Extragerii, conform detaliilor de pe
          Site-ul nostru Web.
        </p>
        <p>3.3. Următoarele persoane nu sunt eligibile să participe:</p>
        <p>
          3.3.1. angajații sau lucrătorii noștri, sau angajații sau lucrătorii oricărei companii din
          grupul nostru;
        </p>
        <p>
          3.3.2. angajații sau lucrătorii oricărei organizații implicate în operarea sau
          administrarea Extragerii, inclusiv furnizorii de premii și agențiile de publicitate; și
        </p>
        <p>3.3.3. membrii familiilor lor directe.</p>
        <p>3.4. Participările vor fi nule dacă:</p>
        <p>3.4.1. nu respectă acești Termeni;</p>
        <p>3.4.2. sunt incomplete sau ilizibile;</p>
        <p>
          3.4.3. sunt participări poștale trimise cu taxă poștală incorectă sau la o adresă
          incorectă;
        </p>
        <p>3.4.4. sunt primite după data și ora de închidere a fiecărei Extrageri;</p>
        <p>
          3.4.5. sunt considerate de Promotor ca făcând parte dintr-o încercare de a manipula sau
          influența în mod neloial rezultatul Extragerii.
        </p>
        <p>
          3.5. Putem solicita dovada vârstei, rezidenței sau eligibilității. Întârzierea sau
          nefurnizarea dovezii la satisfacția noastră rezonabilă poate duce la anularea participării
          sau la pierderea unui premiu.
        </p>
        <p>
          3.6. Decizia noastră cu privire la eligibilitatea unui participant (sau a participării
          sale) pentru Extragere este finală și nu suntem obligați să furnizăm niciun motiv pentru
          descalificare.
        </p>
      </div>
    ),
  },
  {
    id: "how-to-enter",
    title: "4. CUM SĂ PARTICIPI",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>Poți participa la această promoție în oricare dintre următoarele moduri:</p>
        <p>
          <strong>Online</strong> Completează pașii de participare online pe Site-ul nostru Web la
          OC – Site-ul Oficial Online Competitions – Donează și câștigă mașini, bani, premii
          instant ({LEGAL_WEBSITE}). Costul participării va fi afișat pe Site-ul nostru Web.
        </p>
        <p>
          <strong>Poștă</strong> Poți participa prin poștă, dar va trebui mai întâi să-ți
          înregistrezi un cont la noi (vezi clauza 4.1 de mai jos).
        </p>
        <p>
          Te rugăm să trimiți o carte poștală cu numele tău, numărul de cont Online Competitions, adresa poștală,
          data nașterii, adresa de email și numărul de telefon și numele concursului la care
          participi la {LEGAL_REGISTERED_OFFICE}.
        </p>
        <p>Participările gratuite valide vor fi găsite în istoricul contului tău.</p>
        <p>O participare per carte poștală pentru fiecare Extragere.</p>
        <p>
          Participările poștale trebuie primite până la data și ora de închidere afișate pentru
          fiecare Extragere pentru a fi procesate înainte de Extragere. Participările poștale
          primite după data și ora de închidere nu vor fi incluse în Extragere.
        </p>
        <p>
          4.1. Pentru a participa la o Extragere, va trebui să creezi un cont la noi prin
          intermediul Site-ului nostru Web. Te rugăm să urmezi instrucțiunile de pe ecran. Trebuie
          să ne furnizezi numele tău și detaliile de contact, care trebuie să includă emailul și
          adresa poștală. Este foarte important ca aceste detalii să fie corecte, exacte și
          actualizate, astfel încât să te putem contacta despre Extragere dacă este necesar. Nu
          putem fi responsabili sau răspunzători față de tine în acest sens dacă ne-ai furnizat
          informații inexacte.
        </p>
        <p>
          4.2. Vei crea un nume de utilizator și o parolă pentru contul tău. Este responsabilitatea
          ta să păstrezi aceste detalii în siguranță și să nu alegi o parolă care poate fi ușor
          ghicită, iar noi nu suntem responsabili sau răspunzători față de tine în acest sens. Dacă
          crezi că altcineva îți folosește contul, te rugăm să ne contactezi.
        </p>
        <p>
          4.3. După ce ai plătit pentru fiecare participare, vei primi un email pentru a confirma
          participarea ta la Extragere, împreună cu numerele tale de Extragere.
        </p>
        <p>
          4.4. Dacă participi prin Poștă, îți vom aloca un număr de Extragere disponibil selectat
          aleatoriu.
        </p>
        <p>4.1.5 Când Premiul este un vehicul:</p>
        <p>
          Promotorul va, cu excepția cazurilor specificate altfel, se va asigura că acesta vine cu
          un MOT valid (dacă este necesar);
        </p>
        <p>
          nicio asigurare nu este inclusă cu Premiul și este responsabilitatea Câștigătorului să se
          asigure că vehiculul este asigurat corespunzător înainte de a circula pe drumurile publice
          (dacă este legal să facă acest lucru);
        </p>
        <p>
          Promotorul nu are nicio responsabilitate pentru Premiu(-uri) odată ce acesta a fost
          livrat. Câștigătorul este singurul responsabil pentru respectarea tuturor legilor și
          reglementărilor relevante referitoare la vehicul, operarea acestuia și asigurarea că îl
          operează într-un mod sigur și responsabil;
        </p>
        <p>nu este inclusă nicio taxă de vehicul/rutieră; și</p>
        <p>
          Câștigătorul este singurul responsabil pentru a se asigura că are tot echipamentul de
          siguranță necesar și îmbrăcămintea (de exemplu, căști, bocanci și mănuși) și pentru a le
          purta în timpul operării vehiculului.
        </p>
        <p>
          4.5. Te rugăm să reții că atunci când participi la Extragere fie Online și/sau prin Poștă,
          nu vei fi considerat că ai participat la Extragere până când nu am confirmat participarea
          ta la Extragere prin email și prin confirmare în contul tău, autentificându-te în contul
          tău și verificând în secțiunea "Contul Meu". Ți se va solicita apoi să introduci data
          nașterii pentru a confirma că ai peste 18 ani și că ai citit și înțeles acești Termeni și
          Politica noastră de Confidențialitate.
        </p>
        <p>
          4.6. Ne rezervăm dreptul de a refuza sau descalifica participarea ta dacă avem motive
          rezonabile să credem că ai acționat în încălcarea acestor Termeni și vei fi răspunzător
          pentru returnarea și/sau rambursarea tuturor și oricăror premii (după cum sunt definite
          mai jos) către noi.
        </p>
        <p>
          4.7. Ne rezervăm dreptul de a respinge participările care sunt ilegale, indecente,
          rasiste, inflamatorii, defăimătoare sau pe care le considerăm a fi altfel dăunătoare.
          Avem, de asemenea, dreptul de a suspenda sau anula contul tău.
        </p>
        <p>
          4.8. Nu acceptăm nicio responsabilitate pentru participările întârziate, pierdute sau
          direcționate greșit, inclusiv dar fără a se limita la participările neprimite din cauza
          întreruperilor tehnice, congestiei rețelei, pierderii serviciului mecanismelor de
          participare online, erorii computerului în tranzit, întârzierii serviciilor poștale sau
          oricărui alt motiv.
        </p>
        <p>
          4.9. Va exista o singură Extragere în funcțiune la un moment dat pentru fiecare concurs.
        </p>
        <p>
          4.10. Extragerea se va închide când data de închidere și ceasul numărătorii inverse s-au
          încheiat și cel puțin 80% dintre bilete au fost vândute.
        </p>
        <p>
          4.11. Premiul pentru fiecare Extragere ("Premiul") va fi afișat pe Site-ul nostru Web.
        </p>
        <p>4.12. Va exista un singur câștigător pentru fiecare Extragere.</p>
        <p>
          4.13. Trebuie să creezi contul tău online și să participi la Extragere doar în nume
          propriu. Nu ai voie să participi la o Extragere în numele altcuiva.
        </p>
        <p>
          4.14. Poți participa de maximum numărul de ori afișat în secțiunea de descriere a
          concursului relevant.
        </p>
      </div>
    ),
  },
  {
    id: "the-draw",
    title: "5. EXTRAGEREA",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          5.1. Numerele de Extragere vor fi introduse folosind generatorul de numere aleatoare
          Google sau un alt generator de numere aleatoare folosit din când în când. Numărul de
          Extragere selectat aleatoriu va fi considerat câștigătorul Extragerii ("Câștigătorul").
        </p>
        <p>
          5.2. Va exista un singur Câștigător per Extragere, cu excepția cazurilor specificate pe
          Site-ul nostru Web.
        </p>
        <p>
          5.3. Extragerea va fi efectuată și transmisă în direct pe Facebook, pe pagina noastră
          "Online Competitions" și/sau pe o altă platformă de social media pe care o decidem.
        </p>
        <p>
          5.4. Câștigătorul va fi notificat cât mai curând posibil. Vom încerca inițial să contactăm
          Câștigătorul folosind adresa de email și detaliile de contact furnizate la momentul
          creării contului. Este responsabilitatea ta să te asiguri că detaliile furnizate nouă sunt
          corecte și actualizate. Este, de asemenea, responsabilitatea ta să te asiguri că un email
          de la noi nu a ajuns în folderele de spam sau junk. Nu vom fi responsabili sau
          răspunzători dacă ai furnizat detalii inexacte sau dacă nu ai reușit să ne contactezi ca
          răspuns la unul dintre emailurile noastre în termen de 5 zile de la data emailului nostru
          către tine.
        </p>
        <p>
          5.5. Dacă nu putem contacta un Câștigător în termen de 5 zile (pe care le putem prelungi
          la discreția noastră absolută și exclusivă) de la data Extragerii, sau Câștigătorul nu
          răspunde sau Câștigătorul a încălcat acești Termeni, Câștigătorul va pierde Premiul și
          Extragerea va fi re-efectuată din participările rămase, în conformitate cu clauzele 5.2 și
          5.3 de mai sus.
        </p>
        <p>
          5.6. Câștigătorul ne va furniza două forme valide de identificare (dintre care una trebuie
          să fie identificare cu fotografie) înainte de a primi orice Premiu. Nefurnizarea unei
          identificări care este acceptabilă pentru noi va însemna că Câștigătorul pierde
          participarea și Premiul, iar Extragerea va fi re-efectuată în conformitate cu clauzele 5.1
          și 5.2 de mai sus.
        </p>
        <p>
          5.7. După verificarea cu succes a Câștigătorului (și ne rezervăm dreptul de a verifica
          Câștigătorul la discreția noastră exclusivă și absolută), te vom contacta pentru a aranja
          livrarea gratuită a Premiului tău la adresa din Marea Britanie, conform mențiunilor din
          contul tău.
        </p>
        <p>
          5.8. Ne vom strădui să transferăm Premiile în numerar către Câștigător în termen de 30 de
          zile de la data Extragerii.
        </p>
        <p>
          5.9. În toate celelalte cazuri, vom furniza Câștigătorului instrucțiuni despre cum să
          rezerve sau să obțină Premiul său.
        </p>
        <p>
          5.10. Unele Premii, inclusiv, dar fără a se limita la Premii personalizate și/sau făcute
          la comandă, sunt supuse disponibilității.
        </p>
        <p>
          5.11. Câștigătorul este responsabil pentru orice costuri sau cheltuieli implicate în
          revendicarea sau utilizarea Premiului, altele decât cele care sunt declarate în mod expres
          ca fiind incluse ca parte a Premiului.
        </p>
        <p>
          5.12. Nu suntem răspunzători pentru nicio daună sau pierdere a unui Premiu cauzată de o
          terță parte. Dacă un Premiu este deteriorat sau nu poate fi livrat, nu avem obligația de a
          furniza un Premiu de înlocuire.
        </p>
        <p>
          5.13. Câștigătorii vor fi responsabili pentru toate impozitele și alte taxe care s-ar
          putea aplica ca urmare a primirii unui Premiu și ar trebui să solicite consiliere
          financiară independentă. Nu vom avea nicio responsabilitate sau răspundere față de tine
          sau orice autoritate fiscală în acest sens.
        </p>
        <p>
          5.14. Premiul poate fi supus unor Termeni suplimentari impuși de furnizor sau altă
          organizație conectată la această promoție.
        </p>
        <p>
          5.15. Dacă este necesar din cauza unor circumstanțe independente de voința noastră, putem
          (la opțiunea noastră) înlocui Premiul cu:
        </p>
        <p>5.15.1. un echivalent rezonabil de valoare egală sau mai mare; sau</p>
        <p>5.15.2. o Alternativă în Numerar.</p>
        <p>
          5.16. Premiul este destinat exclusiv câștigătorului numit și nu poate fi dat sau
          transferat altei persoane.
        </p>
        <p>
          5.17. Detaliile parțiale ale Câștigătorului pot fi obținute trimițându-ne un email la{" "}
          <CompanyEmailLink />{" "}
          și vor fi publicate la OC – Site-ul Oficial Online Competitions – Donează și câștigă
          mașini, bani, premii instant ({LEGAL_WEBSITE}) la 6 luni după data și ora de închidere.
        </p>
        <p>
          5.18. Participanții care nu doresc ca detaliile lor să fie incluse în lista Câștigătorilor
          menționată mai sus trebuie să ne notifice într-un termen rezonabil înainte de data și ora
          de închidere a acestei promoții.
        </p>
        <p>
          5.19. Tuturor Câștigătorilor li se va solicita publicitate post-Extragere, care poate
          include interviuri cu presa, furnizarea sau realizarea de fotografii și/sau videoclipuri
          pentru utilizare în presă și pe platformele de social media. Te rugăm să vezi secțiunea
          noastră Informații Personale mai jos. Te rugăm să reții că fotografia ta actuală de profil
          de pe social media poate fi afișată pe Site-ul nostru Web în secțiunea Câștigători.
        </p>
      </div>
    ),
  },
  {
    id: "personal-information",
    title: "6. INFORMAȚII PERSONALE ȘI PROTECȚIA DATELOR",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          6.1. Colectăm și folosim informații personale pe care ni le furnizezi când participi la o
          Extragere și când vizitezi Site-ul nostru Web, în conformitate cu Politica noastră de
          Confidențialitate. Aceste informații vor fi folosite de noi și de terții noștri care ne
          asistă cu operarea și administrarea Extragerii.
        </p>
        <p>
          6.2. Ar trebui să citești cu atenție Politica noastră de Confidențialitate înainte de a
          participa la o Extragere, pentru ca utilizarea informațiilor tale personale de către noi
          să fie acceptabilă pentru tine. Vom folosi informațiile tale personale doar în
          conformitate cu Politica noastră de Confidențialitate.
        </p>
        <p>
          6.3. Prin participarea la o Extragere, ești de acord și consimți ca noi să folosim și/sau
          să publicăm numele tău, județul, ocupația, caracterul, aspectul și asemănarea fără nicio
          contraprestație sau plată către tine, în conformitate cu Politica noastră de
          Confidențialitate.
        </p>
        <p>
          6.4. Ne vom asigura că îți protejăm informațiile personale în conformitate cu legile
          aplicabile privind protecția datelor, inclusiv, dar fără a se limita la Data Protection
          Act 2018 și UK GDPR.
        </p>
      </div>
    ),
  },
  {
    id: "intellectual-property",
    title:
      "7. DREPTURILE TALE DE PROPRIETATE INTELECTUALĂ ȘI FOLOSIREA PARTICIPĂRII TALE DE CĂTRE NOI",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          7.1. Vei păstra proprietatea asupra tuturor drepturilor de proprietate intelectuală
          (inclusiv drepturile de autor) în participarea ta, dar ești de acord să ne acorzi o
          licență de utilizare a acesteia pentru orice scop legat de această promoție.
        </p>
        <p>
          7.2. Licența va dura pe durata dreptului de proprietate intelectuală relevant și include
          dreptul nostru de a:
        </p>
        <p>
          7.2.1. edita sau modifica participarea ta (inclusiv redimensionarea, ajustarea culorii și
          adăugarea de elemente precum textul);
        </p>
        <p>7.2.2. adapta sau încorpora în alte materiale;</p>
        <p>
          7.2.3. sublicenția către terți sau companii din grupul nostru pentru a fi utilizată în
          scopurile descrise în acești Termeni; și
        </p>
        <p>
          7.2.4. republica (sau orice versiune modificată în modul descris mai sus) pe orice media
          oriunde în lume.
        </p>
        <p>7.3. Confirmi că participarea ta:</p>
        <p>
          7.3.1. este propria ta lucrare originală și nu încalcă drepturile de proprietate
          intelectuală ale vreunei terțe părți (de exemplu, prin includerea mărcii comerciale a unei
          companii fără permisiune);
        </p>
        <p>
          7.3.2. nu este defăimătoare, ofensatoare, amenințătoare, discriminatorie, de prost gust,
          pornografică sau ilegală;
        </p>
        <p>
          7.3.3. poate fi trimisă nouă și utilizată fără a încălca nicio obligație contractuală față
          de nicio persoană; și
        </p>
        <p>
          7.3.4. nu conține nimic care ar putea fi confidențial sau sensibil din punct de vedere
          comercial.
        </p>
        <p>
          7.4. Dacă participarea ta conține fotografii sau imagini video cu persoane, trebuie să te
          asiguri că le informezi că intenționezi să folosești materialul în scopurile acestei
          promoții și să obții consimțământul lor.
        </p>
        <p>
          7.5. Putem să-ți solicităm dovezi ale unui astfel de consimțământ și ne rezervăm dreptul
          de a descalifica participarea ta dacă nu poți să le furnizezi sau dacă avem îndoieli cu
          privire la caracterul adecvat al acestora.
        </p>
        <p>
          7.6. Nu ai dreptul la nicio taxă pentru acordarea licenței și nu ai dreptul să o reziliezi
          decât dacă suntem de acord în scris.
        </p>
      </div>
    ),
  },
  {
    id: "legal-information",
    title: "8. INFORMAȚII LEGALE IMPORTANTE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p className="font-medium">
          Este foarte important să acorzi o atenție deosebită acestei clauze, deoarece conține
          informații legale importante.
        </p>
        <p>8.1. Participarea la o Extragere este nerambursabilă.</p>
        <p>
          8.2. Nu acceptăm nicio responsabilitate sau răspundere față de tine pentru motive
          independente de controlul nostru, inclusiv (dar fără a se limita la) defecțiuni tehnice,
          disfuncționalități, accesibilitatea sau disponibilitatea internetului, congestia web, acte
          sau omisiuni ale oricărui furnizor de servicii, intervenție neautorizată, virus
          informatic, manipulare, fraudă sau orice alt motiv care afectează desfășurarea,
          integritatea, corectitudinea sau administrarea Extragerii în orice mod și nicio
          compensație sau daune nu îți vor fi plătibile.
        </p>
        <p>
          8.3. Ne rezervăm dreptul, la discreția noastră absolută și exclusivă, de a suspenda, anula
          sau termina Extragerea în circumstanțe excepționale și de a descalifica orice persoană de
          la acea Extragere și de la Extragerile viitoare care a cauzat direct sau indirect sau care
          cauzează terminarea, anularea, întârzierea sau suspendarea Extragerii.
        </p>
        <p>
          8.4. Putem modifica acești Termeni sau termina, anula, întârzia sau suspenda o Extragere
          în orice moment, la discreția noastră absolută și exclusivă, dacă considerăm că este
          rezonabil să facem acest lucru. Dacă terminăm, anulăm, întârziem sau suspendăm o
          Extragere, nu vom fi răspunzători față de tine și nu va fi oferită nicio compensație.
        </p>
        <p>8.5. Decizia noastră în legătură cu orice Extragere este finală.</p>
        <p>
          8.6. Nu oferim nicio garanție cu privire la calitatea, adecvarea și/sau potrivirea pentru
          orice scop particular a vreunui Premiu. În cea mai mare măsură permisă de lege, toate
          condițiile, garanțiile și declarațiile exprese sau implicite de lege sunt prin prezenta
          excluse în mod expres.
        </p>
        <p>
          8.7. În cea mai mare măsură permisă de lege, nu vom avea nicio răspundere față de tine sau
          de orice Câștigător în legătură cu sau care decurge din orice Extragere, indiferent de
          cauză, inclusiv costuri, cheltuieli, daune și orice alte răspunderi, cu condiția că nimic
          în această clauză nu limitează răspunderea noastră pentru vătămări corporale sau deces
          cauzate de neglijența noastră.
        </p>
        <p>
          8.8. Răspunderea noastră totală maximă agregată față de fiecare Câștigător se va limita la
          valoarea totală a oricărui singur Premiu.
        </p>
        <p>
          8.9. Răspunderea noastră totală maximă agregată pentru ne-câștigători se va limita la suma
          plătită pentru a participa la Extragere.
        </p>
        <p>
          8.10. Cu excepția oricărei responsabilități legale pe care nu o putem exclude prin lege
          (cum ar fi pentru deces sau vătămare corporală) sau care decurge din legile aplicabile
          referitoare la protecția informațiilor tale personale, nu suntem răspunzători legal
          pentru:
        </p>
        <p>
          8.10.1. pierderile care nu erau previzibile pentru tine și pentru noi când acești Termeni
          au fost formați;
        </p>
        <p>8.10.2. pierderile care nu au fost cauzate de nicio încălcare din partea noastră;</p>
        <p>8.10.3. pierderile de afaceri; și</p>
        <p>8.10.4. pierderile către non-consumatori.</p>
        <p>8.11. Nimic în acești Termeni nu afectează drepturile tale legale.</p>
        <p>
          8.12. Dacă orice prevedere sau parte a unei prevederi a acestor Termeni este sau devine
          invalidă, ilegală sau neexecutabilă, va fi considerată ștearsă, dar aceasta nu va afecta
          valabilitatea și executabilitatea celorlalți Termeni.
        </p>
        <p>
          8.13. Dacă dorești să ne contactezi despre această promoție sau ai o reclamație, ne poți
          contacta prin:
        </p>
        <p>8.13.1. Telefon: {CONTACT_PHONE_DISPLAY}</p>
        <p>
          8.13.2. email:{" "}
          <CompanyEmailLink />{" "}
          ; sau
        </p>
        <p>8.13.3. {LEGAL_REGISTERED_OFFICE}</p>
        <p>
          8.14. Acești Termeni și orice dispută sau revendicare (inclusiv dispute sau revendicări
          necontractuale) care decurg din sau în legătură cu aceștia sau obiectul sau formarea lor
          vor fi guvernate și interpretate în conformitate cu legile Angliei și Țării Galilor, iar
          instanța din țara în care rezi în Marea Britanie va avea jurisdicție exclusivă pentru a
          soluționa orice dispută sau revendicare care decurge din sau în legătură cu acești
          Termeni.
        </p>
      </div>
    ),
  },
  {
    id: "website-terms",
    title: "9. INFORMAȚII SUPLIMENTARE DESPRE TERMENII SITE-ULUI NOSTRU WEB",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          9.1. Următorii Termeni explică cum poți folosi acest Site Web și orice conținut al său.
        </p>
        <p>
          9.2. Ar trebui să citești acești Termeni cu atenție înainte de a folosi Site-ul Web. Prin
          utilizarea Site-ului Web sau prin indicarea altfel a consimțământului tău, ești de acord
          să respecți acești Termeni. Dacă nu ești de acord cu vreunul dintre acești Termeni, ar
          trebui să încetezi imediat utilizarea Site-ului Web.
        </p>
        <p>
          9.3. Acești Termeni se aplică oricăror părți ale Site-ului Web, funcționalității și
          conținutului furnizat ție gratuit, doar în scopuri de divertisment.
        </p>
      </div>
    ),
  },
  {
    id: "using-website",
    title: "10. FOLOSIREA SITE-ULUI WEB",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>10.1. Site-ul Web este doar pentru uzul tău personal și necomercial.</p>
        <p>
          10.2. Ești de acord că ești singurul responsabil pentru toate costurile și cheltuielile pe
          care le poți suporta în legătură cu utilizarea Site-ului Web.
        </p>
        <p>
          10.3. Nu promitem că Site-ul Web este adecvat sau disponibil pentru utilizare în locații
          din afara Marii Britanii. Dacă alegi să accesezi Site-ul Web din locații din afara Marii
          Britanii, recunoști că o faci din proprie inițiativă și ești responsabil pentru
          conformitatea cu legile locale acolo unde se aplică.
        </p>
        <p>
          10.4. Încercăm să facem Site-ul Web cât mai accesibil posibil. Dacă întâmpini dificultăți
          în utilizarea Site-ului Web, te rugăm să ne contactezi folosind detaliile de contact din
          partea de sus a acestei pagini.
        </p>
        <p>10.5. Ca o condiție a utilizării Site-ului Web, ești de acord să nu:</p>
        <p>
          10.5.1. utilizezi abuziv sau ataci Site-ul nostru Web prin introducerea deliberată de
          viruși, troieni, viermi, bombe logice sau orice alt material malițios sau dăunător din
          punct de vedere tehnologic (cum ar fi printr-un atac de tip denial-of-service), sau
        </p>
        <p>
          10.5.2. încerci să obții acces neautorizat la Site-ul nostru Web, la serverul pe care este
          stocat Site-ul nostru Web sau la orice server, computer sau bază de date conectată la
          Site-ul nostru Web.
        </p>
        <p>
          10.6. Putem preveni sau suspenda accesul tău la Site-ul Web dacă nu respecți acești
          Termeni sau orice lege aplicabilă.
        </p>
      </div>
    ),
  },
  {
    id: "registration",
    title: "11. ÎNREGISTRAREA ȘI SECURITATEA PAROLEI",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          11.1. Utilizarea Site-ului Web necesită înregistrare, în special pentru a accesa zona
          contului tău de pe Site-ul Web.
        </p>
        <p>
          11.2. Nu suntem obligați să permitem oricui să se înregistreze pe Site-ul Web și putem
          refuza, rezilia sau suspenda înregistrarea oricui în orice moment.
        </p>
        <p>
          11.3. Ești responsabil pentru a te asigura că parola ta și orice alte detalii ale contului
          sunt păstrate în siguranță și confidențial.
        </p>
        <p>
          11.4. Dacă avem motive să credem că există probabilitatea unei încălcări de securitate sau
          a unei utilizări abuzive a Site-ului Web prin contul tău sau prin utilizarea parolei tale,
          te putem notifica și solicita să-ți schimbi parola, sau putem suspenda sau rezilia contul
          tău.
        </p>
      </div>
    ),
  },
  {
    id: "infringing-content",
    title: "12. CONȚINUT CARE ÎNCALCĂ DREPTURILE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>12.1. Vom depune eforturi rezonabile pentru a:</p>
        <p>
          12.1.1. șterge conturile care sunt utilizate într-un mod neadecvat sau cu încălcarea
          acestor Termeni; și
        </p>
        <p>
          12.1.2. identifica și elimina orice conținut care este neadecvat, defăimător, încalcă
          drepturile de proprietate intelectuală sau este altfel, la opinia noastră rezonabilă,
          inacceptabil pentru noi
        </p>
        <p>
          când suntem notificați, dar nu putem fi răspunzători dacă nu ne-ai furnizat informațiile
          relevante.
        </p>
        <p>
          12.2. Dacă crezi că orice conținut care este distribuit sau publicat de Site-ul Web este
          neadecvat, defăimător sau încalcă drepturile de proprietate intelectuală, ar trebui să ne
          contactezi imediat folosind detaliile de contact din partea de sus a acestei pagini.
        </p>
      </div>
    ),
  },
  {
    id: "ownership",
    title:
      "13. PROPRIETATEA, FOLOSIREA ȘI DREPTURILE DE PROPRIETATE INTELECTUALĂ ASUPRA SITE-ULUI WEB",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          13.1. Drepturile de proprietate intelectuală asupra Site-ului Web și asupra oricărui text,
          imagini, video, audio sau alt conținut multimedia, software sau alte informații sau
          materiale trimise sau accesibile de pe Site-ul Web (Conținutul) sunt deținute de noi și de
          licențiatorii noștri.
        </p>
        <p>
          13.2. Noi și licențiatorii noștri ne rezervăm toate drepturile de proprietate intelectuală
          (inclusiv, dar fără a se limita la, toate drepturile de autor, mărcile comerciale, numele
          de domeniu, drepturile de design, drepturile de bază de date, brevetele și toate celelalte
          drepturi de proprietate intelectuală de orice fel), înregistrate sau neînregistrate,
          oriunde în lume. Aceasta înseamnă, de exemplu, că rămânem proprietarii lor și suntem
          liberi să le folosim după cum considerăm potrivit.
        </p>
        <p>
          13.3. Nimic în acești Termeni nu îți acordă vreun drept legal asupra Site-ului Web sau a
          Conținutului, altul decât cel necesar pentru a-l accesa. Ești de acord să nu ajustezi, să
          încerci să ocolești sau să ștergi vreo notificare conținută pe Site-ul Web sau în Conținut
          (inclusiv orice notificare de proprietate intelectuală) și, în special, în orice drepturi
          digitale sau altă tehnologie de securitate încorporată sau conținută în Site-ul Web sau în
          Conținut.
        </p>
        <p>
          13.4. Mărci comerciale: Online Competitions este marca noastră comercială. Alte mărci comerciale și
          nume comerciale pot fi, de asemenea, utilizate pe Site-ul Web sau în Conținut. Utilizarea
          de către tine a oricăror mărci comerciale de pe Site-ul Web sau din Conținut este strict
          interzisă, cu excepția cazului în care ai permisiunea noastră scrisă prealabilă.
        </p>
      </div>
    ),
  },
  {
    id: "submitting-information",
    title: "14. TRIMITEREA DE INFORMAȚII CĂTRE SITE-UL WEB",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          14.1. Deși încercăm să ne asigurăm că Site-ul Web este sigur, nu monitorizăm sau verificăm
          în mod activ dacă informațiile furnizate nouă prin intermediul Site-ului Web sunt
          confidențiale, sensibile din punct de vedere comercial sau valoroase.
        </p>
        <p>
          14.2. Cu excepția informațiilor personale care vor fi tratate în conformitate cu Politica
          noastră de Confidențialitate, nu garantăm că informațiile furnizate nouă prin intermediul
          Site-ului Web vor fi păstrate confidențiale și le putem folosi pe o bază nelimitată și
          gratuită, după cum considerăm rezonabil de potrivit.
        </p>
      </div>
    ),
  },
  {
    id: "accuracy",
    title: "15. ACURATEȚEA INFORMAȚIILOR ȘI DISPONIBILITATEA SITE-ULUI WEB",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          15.1. Încercăm să ne asigurăm că Site-ul Web este corect, actualizat și fără erori, dar nu
          putem promite că va fi. Mai mult, nu putem promite că Site-ul Web va fi potrivit sau
          adecvat pentru orice scop. Orice încredere pe care o acorzi informațiilor de pe Site-ul
          Web este pe propriul tău risc.
        </p>
        <p>
          15.2. Putem suspenda sau întrerupe accesul sau operarea Site-ului Web în orice moment,
          după cum considerăm potrivit.
        </p>
        <p>
          15.3. Orice Conținut este furnizat doar în scopuri generale de informare și pentru a te
          informa despre noi și despre produsele și noutățile, funcționalitățile, serviciile și alte
          site-uri web care ar putea fi de interes, dar nu a fost personalizat pentru cerințele sau
          circumstanțele tale specifice. Nu constituie sfat tehnic, financiar sau juridic sau orice
          alt tip de sfat și nu ar trebui să te bazezi pe el în niciun scop. Ar trebui să folosești
          întotdeauna propria judecată independentă când folosești Site-ul nostru Web și Conținutul
          său.
        </p>
        <p>
          15.4. Deși încercăm să ne asigurăm că Site-ul Web este disponibil pentru utilizarea ta, nu
          promitem că Site-ul Web va fi disponibil în orice moment sau că utilizarea ta a Site-ului
          Web va fi neîntreruptă.
        </p>
      </div>
    ),
  },
  {
    id: "hyperlinks",
    title: "16. HIPERLINKURI ȘI SITE-URI TERȚE",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Site-ul Web poate conține hiperlinkuri sau referințe către publicitate terță și site-uri
          web altele decât Site-ul Web. Orice astfel de hiperlinkuri sau referințe sunt furnizate
          doar pentru confortul tău. Nu avem control asupra publicității terțe sau a site-urilor web
          și nu acceptăm nicio responsabilitate legală pentru niciun conținut, material sau
          informație conținută în acestea. Afișarea oricărui hiperlink sau referință către orice
          publicitate terță sau site web nu înseamnă că susținem site-ul web, produsele sau
          serviciile acelei terțe părți. Utilizarea de către tine a unui site terț poate fi
          guvernată de Termenii acelui site terț și este pe propriul tău risc.
        </p>
      </div>
    ),
  },
  {
    id: "events-beyond-control",
    title: "17. EVENIMENTE INDEPENDENTE DE CONTROLUL NOSTRU",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Nu suntem răspunzători față de tine dacă nu reușim să respectăm acești Termeni din cauza
          unor circumstanțe independente de controlul nostru rezonabil, inclusiv, dar fără a se
          limita la, greve, lock-out-uri sau alte dispute industriale; defecțiuni ale sistemelor sau
          accesului la rețea; incendiu, inundație, explozie sau accident; sau epidemii sau pandemii.
        </p>
      </div>
    ),
  },
  {
    id: "third-party-rights",
    title: "18. DREPTURILE TERȚILOR",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          Nicio altă persoană decât o parte la acești Termeni nu are dreptul de a pune în aplicare
          vreunul dintre acești Termeni.
        </p>
      </div>
    ),
  },
  {
    id: "variation",
    title: "19. MODIFICAREA",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          19.1. Nicio modificare a acestor Termeni nu este validă sau nu are efect decât dacă este
          convenită de noi în scris sau făcută în conformitate cu această clauză.
        </p>
        <p>
          19.2. Ne rezervăm dreptul de a modifica acești Termeni din când în când. Termenii noștri
          actualizați vor fi afișați pe Site-ul Web și, prin continuarea utilizării și accesării
          Site-ului Web după astfel de modificări, ești de acord să respecți orice modificare făcută
          de noi. Este responsabilitatea ta să verifici acești Termeni din când în când pentru a
          verifica astfel de modificări.
        </p>
      </div>
    ),
  },
  {
    id: "disputes",
    title: "20. LITIGII",
    content: (
      <div className="space-y-3 text-muted-foreground">
        <p>
          20.1. Vom încerca să rezolvăm orice litigiu cu tine rapid și eficient. Dacă nu ești
          mulțumit de noi, te rugăm să ne contactezi cât mai curând posibil, folosind datele de
          contact stabilite în partea de sus a acestei pagini.
        </p>
        <p>
          20.2. Dacă un litigiu nu poate fi soluționat sau nu ești mulțumit de rezultat, poți dori
          să folosești soluționarea alternativă a litigiilor ("SAL"). SAL este un proces de
          soluționare a litigiilor între tine și noi care nu implică mersul în instanță.
        </p>
        <p>
          20.3. Dacă nu dorești să folosești SAL sau nu ești mulțumit de rezultatul SAL, poți totuși
          introduce proceduri judiciare.
        </p>
        <p>
          20.4. Legile Angliei și Țării Galilor se vor aplica acestor Termeni. Dacă dorești să
          introduci proceduri judiciare, instanțele relevante din Anglia și Țara Galilor vor avea
          jurisdicție exclusivă în legătură cu acești Termeni.
        </p>
      </div>
    ),
  },
];

export type { LegalSection };
