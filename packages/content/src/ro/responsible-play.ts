export interface ResponsiblePlaySection {
  id: string;
  title: string;
  content: string;
}

export const RESPONSIBLE_PLAY_SECTIONS: ResponsiblePlaySection[] = [
  {
    id: "age",
    title: "Verificarea vârstei",
    content:
      "Trebuie să ai 18 ani sau peste pentru a participa la concursurile Online Competitions. Verificăm vârsta folosind data ta de naștere la înregistrare și înainte de finalizare. Furnizorii terți de identitate ar putea fi introduși în viitor pentru a întări verificarea.",
  },
  {
    id: "credit-cap",
    title: "Plafon lunar de £250 pentru cardul de credit",
    content:
      "Conform Codului Voluntar din Regatul Unit, limităm cheltuielile cu cardul de credit la £250 pe lună calendaristică pentru toate concursurile. Cardurile de debit, Apple Pay și Google Pay nu sunt supuse acestui plafon. Alocația rămasă este afișată la finalizare când limita se aplică.",
  },
  {
    id: "instant-win",
    title: "Restricții de plată pentru câștigurile instant",
    content:
      "Când coșul tău include un concurs cu câștig instant, cardurile de credit nu pot fi folosite. Cardurile de debit și portofelele digitale rămân disponibile.",
  },
  {
    id: "spend-limits",
    title: "Limite personale de cheltuială",
    content:
      "Poți seta o limită lunară de cheltuială în panoul de bord, sub secțiunea Joc Responsabil. Scăderile intră în vigoare imediat; creșterile se aplică după o perioadă de răcire de 24 de ore. Încurajăm stabilirea unei limite înainte de alte intrări după prima achiziție.",
  },
  {
    id: "self-exclusion",
    title: "Auto-excludere",
    content:
      "Te poți auto-exclude pentru 6 luni, 1 an, 5 ani sau permanent. În timpul excluderii, contul tău este suspendat, emailurile de marketing se opresc și nu poți participa la concursuri. Contactează-ne dacă ai nevoie de ajutor pentru a anula o excludere temporară după expirare.",
  },
  {
    id: "postal",
    title: "Participare gratuită prin poștă",
    content:
      "Participarea gratuită prin poștă este disponibilă pentru concursurile active. Trimite participarea ta la adresa afișată pe pagina noastră de Participare gratuită prin poștă, incluzând emailul contului tău Online Competitions și detaliile concursului. Participările gratuite și plătite sunt tratate în mod egal la extragere.",
  },
  {
    id: "draws",
    title: "Integritatea extragerii",
    content:
      "Extragerile premiilor principale folosesc selecție aleatorie verificabilă în timpul livestream-ului nostru. Datele extragerii și premiile publicitate nu sunt reduse din cauza vânzărilor de bilete. Participările poștale sunt procesate manual și incluse corect alături de participările plătite.",
  },
];

export const SUPPORT_ORGANISATIONS = [
  {
    name: "GamCare",
    url: "https://www.gamcare.org.uk/",
    description:
      "Informații gratuite, sfaturi și suport pentru oricine este afectat de jocurile de noroc.",
  },
  {
    name: "Linia Națională de Jocuri de Noroc",
    url: "tel:08088020133",
    description: "Sună la 0808 8020 133 - gratuit, confidențial, 24/7.",
  },
  {
    name: "Citizens Advice",
    url: "https://www.citizensadvice.org.uk/",
    description: "Ajutor cu datorii, bani și probleme ale consumatorilor.",
  },
  {
    name: "Money Advice Trust",
    url: "https://www.moneyadvicetrust.org/",
    description: "Linia Națională a Datoriilor și îndrumare financiară.",
  },
];
