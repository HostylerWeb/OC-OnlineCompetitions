import { LEGAL_CONTACT_EMAIL } from "@oc/utils";
import type { FaqCategory, FaqItem } from "../content-types";

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: "general", name: "General" },
  { id: "competitions", name: "Concursuri" },
  { id: "instant", name: "Câștiguri instant" },
  { id: "milestones", name: "Etape și premii bonus" },
  { id: "responsible", name: "Joc responsabil" },
  { id: "referrals", name: "Recomandări" },
  { id: "payment", name: "Plată" },
  { id: "delivery", name: "Livrare" },
];

export const FAQS_BY_CATEGORY: Record<string, FaqItem[]> = {
  general: [
    {
      question: "Cum particip la un concurs?",
      answer:
        "Navighează prin concursurile noastre, selectează premiul dorit, alege câte bilete dorești să cumperi și finalizează procesul de comandă. Vei primi un email de confirmare cu numerele biletelor tale.",
    },
    {
      question: "Cum sunt selectați câștigătorii?",
      answer:
        "Câștigătorii sunt selectați folosind un generator de numere aleatoare verificat (RNG) care alege un număr de bilet câștigător după încheierea concursului. Câștigătorul este notificat prin email în termen de 7 zile de la extragere.",
    },
    {
      question: "Când va avea loc extragerea?",
      answer:
        "Fiecare pagină de concurs arată data și ora programată a extragerii. Data anunțată nu este devansată pentru că biletele se vând repede. Extragerea are loc la momentul anunțat, prin selecție aleatorie verificabilă.",
    },
    {
      question: "Cum voi ști dacă am câștigat?",
      answer:
        "Vom trimite un email câștigătorului la adresa folosită în timpul achiziției. Numele și premiul câștigătorului vor fi afișate și pe pagina noastră de Câștigători. Asigură-te că emailul contului tău este actualizat.",
    },
    {
      question: "Cât durează livrarea premiului?",
      answer:
        "Odată ce verificarea câștigătorului este completă, premiile sunt de obicei expediate în termen de 14 zile lucrătoare. Livrările în Regatul Unit ajung de obicei în 5-7 zile lucrătoare.",
    },
    {
      question: "Pot primi o rambursare pentru biletele mele?",
      answer:
        "Toate achizițiile de bilete sunt finale și nerambursabile. Participările la concurs rămân valabile chiar dacă data extragerii se modifică.",
    },
    {
      question: "Există restricții de vârstă?",
      answer:
        "Da, trebuie să ai 18 ani sau peste pentru a participa la orice concurs. Verificăm vârsta la înregistrare și la finalizare și ne rezervăm dreptul de a verifica câștigătorii.",
    },
    {
      question: "Pot participa gratuit prin poștă?",
      answer:
        "Da. Participarea gratuită prin poștă este disponibilă pentru concursurile active. Vizitează pagina noastră de Participare gratuită prin poștă pentru adresa poștală și ce trebuie să incluzi (numele complet, adresa, datele de contact, numele concursului și emailul contului Online Competitions). Participările incomplete nu pot fi acceptate.",
    },
    {
      question: "Pot cumpăra bilete pentru altcineva?",
      answer:
        "Da, poți cumpăra bilete ca cadou. Biletele vor fi atribuite contului tău, dar ne poți notifica după extragere pentru a actualiza detaliile de livrare.",
    },
  ],
  competitions: [
    {
      question: "Ce este întrebarea de abilități?",
      answer:
        "Unele concursuri cer o întrebare cu variante multiple înainte să poți finaliza participarea. Răspunde corect pentru a încheia comanda. Concursurile care nu afișează o întrebare nu o cer.",
    },
    {
      question: "Unde văd numerele biletelor mele?",
      answer:
        "După o achiziție reușită primești un email de confirmare. Participările tale apar și în panoul de control, la Biletele mele.",
    },
    {
      question: "Ce se întâmplă dacă concursul nu se vinde integral?",
      answer:
        "Extragerea are loc tot la data și ora anunțate. Biletele nevândute nu anulează premiul și nu mută extragerea mai devreme.",
    },
  ],
  instant: [
    {
      question: "Ce este un câștig instant?",
      answer:
        "Un câștig instant este un premiu separat, dezvăluit odată cu participarea ta, pe lângă premiul principal. Pagina concursului arată câte premii instant sunt disponibile și câte au fost revendicate.",
    },
    {
      question: "Pot plăti un concurs cu câștig instant cu cardul de credit?",
      answer:
        "Nu. Dacă coșul include un concurs cu câștig instant, cardurile de credit nu pot fi folosite. Cardurile de debit, Apple Pay și Google Pay rămân disponibile.",
    },
  ],
  milestones: [
    {
      question: "Ce este o etapă (milestone)?",
      answer:
        "O etapă este un premiu suplimentar deblocat când un concurs atinge un procent stabilit de bilete vândute. Pagina concursului listează fiecare etapă și dacă a fost atinsă.",
    },
    {
      question: "Cum se acordă premiile bonus?",
      answer:
        "Un câștig bonus este înregistrat în contul tău. Echipa noastră îl onorează după confirmare.",
    },
  ],
  responsible: [
    {
      question: "Există o limită pentru cheltuielile cu cardul de credit?",
      answer:
        "Da. Cheltuielile cu cardul de credit sunt limitate la 250 £ pe lună calendaristică, pentru toate concursurile. Cardurile de debit, Apple Pay și Google Pay nu intră în această limită. La finalizare vezi suma rămasă când limita se aplică.",
    },
    {
      question: "Pot seta propria limită de cheltuieli?",
      answer:
        "Da. În panoul de control, deschide Joc responsabil și setează o limită lunară. O limită mai mică se aplică imediat. O limită mai mare se aplică după o perioadă de răcire de 24 de ore.",
    },
    {
      question: "Cum funcționează autoexcluderea?",
      answer:
        "Te poți autoexclude pentru 6 luni, 1 an, 5 ani sau permanent din Joc responsabil, în panoul de control. Cât ești exclus, contul este suspendat, emailurile de marketing se opresc și nu poți participa la concursuri. Contactează-ne dacă ai nevoie de ajutor după ce o excludere temporară expiră.",
    },
  ],
  referrals: [
    {
      question: "Cum funcționează recomandările?",
      answer:
        "Distribuie linkul tău de recomandare din panoul de control. Când un prieten se înscrie cu linkul tău și face o achiziție care se califică, poți primi bilete gratuite.",
    },
    {
      question: "Unde ajung biletele gratuite din recomandări?",
      answer:
        "Sunt adăugate în portofelul de bilete din recomandări. La finalizare poți aplica acele bilete pe articolele din coș înainte să plătești.",
    },
  ],
  payment: [
    {
      question: "Ce metode de plată acceptați?",
      answer:
        "Acceptăm toate cardurile de credit și debit majore, inclusiv Visa, Mastercard și American Express. Apple Pay și Google Pay sunt, de asemenea, acceptate pentru o finalizare mai rapidă.",
    },
    {
      question: "Informațiile mele de plată sunt sigure?",
      answer:
        "Absolut. Toate plățile sunt procesate prin platforma noastră securizată de plată. Nu stocăm niciodată detaliile cardului tău.",
    },
    {
      question: "Pot folosi un cod promoțional?",
      answer:
        "Da, poți introduce un cod promoțional la finalizare pentru reduceri sau bilete bonus. Codurile promoționale nu pot fi combinate cu alte oferte și au date de expirare.",
    },
  ],
  delivery: [
    {
      question: "Expediați internațional?",
      answer:
        "Da, expediem în majoritatea țărilor din întreaga lume. Costurile și timpii de livrare internațională variază în funcție de destinație. Toate taxele vamale și impozitele de import sunt responsabilitatea destinatarului.",
    },
    {
      question: "Ce se întâmplă dacă nu sunt acasă la livrare?",
      answer:
        "Curierul va încerca de obicei livrarea de două ori înainte de a returna coletul. Recomandăm să furnizezi o locație sigură sau o adresă de birou pentru livrarea premiilor.",
    },
  ],
};

export const FAQ_SUPPORT_EMAIL = LEGAL_CONTACT_EMAIL;
