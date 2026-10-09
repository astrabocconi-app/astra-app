// The privacy policy text, in both languages. Keep the two in step: every section
// exists in EN and IT, in the same order. Update `UPDATED` whenever the text or the
// real data practices change (new processor, new data category, new retention rule).

export type Block =
  | { p: string; lead?: string }
  | { ul: string[] };

export interface Section {
  title: string;
  blocks: Block[];
}

export interface Policy {
  lang: "en" | "it";
  title: string;
  subtitle: string;
  legal: string;
  updatedLabel: string;
  updated: string;
  sections: Section[];
  footer: string;
}

/** ISO date of the last substantive change. */
export const UPDATED = "2026-10-09";

const CONTROLLER_LINES_EN = [
  "Tax code: 97943660155",
  "VAT number: 13411890968",
  "Contact email: info@astrabocconi.com",
  "Certified email (PEC): astra.bocconi@pec.it",
  "Website: www.astrabocconi.com",
];
const CONTROLLER_LINES_IT = [
  "Codice Fiscale: 97943660155",
  "Partita IVA: 13411890968",
  "Email di contatto: info@astrabocconi.com",
  "PEC: astra.bocconi@pec.it",
  "Sito web: www.astrabocconi.com",
];

export const EN: Policy = {
  lang: "en",
  title: "Privacy Policy",
  subtitle: "ASTRA Bocconi app (myAstra) and website",
  legal:
    "Notice under articles 13 and 14 of Regulation (EU) 2016/679 (GDPR) and Legislative Decree 196/2003 as amended by Legislative Decree 101/2018.",
  updatedLabel: "Last updated",
  updated: "9 October 2026",
  footer: "ASTRA Bocconi · Privacy Policy",
  sections: [
    {
      title: "Introduction",
      blocks: [
        {
          p: "This notice explains how personal data of people who use the ASTRA Bocconi app (the “App”) and the astrabocconi web pages that serve it (the “Website”) is processed. We follow the principles of lawfulness, fairness, transparency, minimisation and storage limitation set out in the GDPR.",
        },
      ],
    },
    {
      title: "Data controller",
      blocks: [
        {
          p: "The data controller is ASTRABOCCONI – APS (Associazione di Promozione Sociale), registered office Via Roberto Sarfatti, 7 – 20136 Milan (MI), Italy.",
        },
        { ul: CONTROLLER_LINES_EN },
        { p: "For any request about your personal data, write to the contact email above." },
      ],
    },
    {
      title: "What data we process",
      blocks: [
        {
          lead: "Account and sign-in.",
          p: "Your university email address (@studbocconi.it or @unibocconi.it) and the one-time code we email you to sign in. There is no password. We also store your name if you give it, and a randomly chosen avatar seed (a short random string that selects your cartoon profile picture; it is not derived from your name or email).",
        },
        {
          lead: "Study profile.",
          p: "If you provide it: degree programme, track, year of study and class. It is used to show you the right content and to target notifications.",
        },
        {
          lead: "Points, rewards and activity.",
          p: "Your points balance and history, rewards you redeem (including any voucher or pick-up code), events you register for or get tickets to, discounts used at partner venues, and your rotating membership card QR code.",
        },
        {
          lead: "Support messages.",
          p: "If you write to us from the app’s support screen: your message, its category, the app version and your phone platform (iOS or Android), linked to your account so we can reply.",
        },
        {
          lead: "Device and session data.",
          p: "When you sign in we store a session record that includes your IP address and your browser or app user agent (device and operating-system details). If you allow notifications we store a push token that identifies your device for delivery, with its platform.",
        },
        {
          lead: "Crash and performance data.",
          p: "The app sends crash reports and performance traces to our error-monitoring provider (Sentry): device model, operating-system and app version, the screen you were on and the technical error. We do not attach your name, email or account identifier to these reports. The provider sees your IP address as part of the connection.",
        },
        {
          lead: "Camera (partner venue accounts only).",
          p: "The camera is used only to read the QR code on a member’s card in real time. No image or video is saved or sent to us.",
        },
        {
          lead: "Location.",
          p: "The App does not collect your location. The “Discounts” map shows venue positions; loading map tiles discloses your IP address to the map provider.",
        },
        {
          lead: "Stored only on your phone.",
          p: "The grade calculator keeps your exams and grades on your device. They are not sent to ASTRA.",
        },
        {
          lead: "Website visitors.",
          p: "The public pages (home, privacy, support) use a privacy-friendly analytics tool (Umami) run by ASTRA. It uses no cookies and builds no profile of individual visitors; it records page views and general technical details such as browser and country. The staff dashboard and sign-in page do not load analytics.",
        },
      ],
    },
    {
      title: "Why we process it and on what legal basis",
      blocks: [
        {
          lead: "a) Providing the service",
          p: "Sign-in, points, rewards, events, materials, discounts, your card and support. Legal basis: performance of a contract or pre-contractual steps requested by you (art. 6(1)(b) GDPR). Providing this data is necessary to use the App.",
        },
        {
          lead: "b) Push notifications",
          p: "News, events and service messages, only if you allow notifications on your device. Legal basis: consent (art. 6(1)(a)). You can withdraw it at any time in your phone settings; the rest of the App keeps working.",
        },
        {
          lead: "c) Security and reliability",
          p: "Preventing abuse and unauthorised access (for example limits on sign-in code requests) and finding and fixing crashes. Legal basis: our legitimate interest (art. 6(1)(f)).",
        },
        {
          lead: "d) Legal obligations",
          p: "Processing required by law. Legal basis: legal obligation (art. 6(1)(c)).",
        },
        {
          p: "We do not sell personal data, show advertising, or take decisions about you by automated means that have legal or similarly significant effects.",
        },
      ],
    },
    {
      title: "Who receives your data (processors and recipients)",
      blocks: [
        { p: "We use the following providers, appointed as processors under art. 28 GDPR or acting as independent controllers where noted:" },
        {
          ul: [
            "Vercel Inc.: hosting of the App’s API and of the Website (servers in Frankfurt, EU).",
            "Neon Inc.: the main database (accounts, points, rewards, events, support messages), in the same EU region.",
            "Supabase Inc.: storage of the course handouts and guides catalogue. These files are publicly downloadable and contain no personal data about you.",
            "Aruba S.p.A.: the mail service that sends your sign-in codes and service emails.",
            "Mapbox, Inc.: maps in the “Discounts” section (receives your IP address and technical device data when maps load; the provider’s usage telemetry is switched off in the App).",
            "Expo (650 Industries, Inc.) with Apple (APNs) and Google (FCM): delivery of push notifications. They receive your push token and the notification text.",
            "Functional Software, Inc. (Sentry): crash and performance monitoring, as described above.",
            "Eventbrite, Inc.: ticket sales. When you tap “Get tickets” you leave the App and buy on Eventbrite under its own privacy policy; payment data goes to Eventbrite, never to ASTRA. For in-app discounts ASTRA creates a single-use discount code on Eventbrite for you; we do not send your identity to Eventbrite.",
            "DiceBear (api.dicebear.com): generates the cartoon avatar image. It is called only by our servers, with the random avatar seed; it receives no name, email, account identifier or your IP address.",
            "OpenAI, L.L.C.: only for the “Ask ASTRA” virtual assistant, which is currently switched off and not available in the App. If it is enabled again, the text of the questions you type would be sent to OpenAI to produce an answer, and this notice will be updated first.",
            "Advisers, professionals and public authorities, within the limits of the law.",
          ],
        },
        {
          p: "The up-to-date list of processors is available on request. Data is not disseminated to the public.",
        },
      ],
    },
    {
      title: "Transfers outside the EU",
      blocks: [
        {
          p: "Some providers (for example Sentry, Expo, Mapbox, Eventbrite, Apple, Google) are based in the United States or may process data there. Such transfers rely on the safeguards in art. 44-46 GDPR: the EU-US Data Privacy Framework where the provider is certified, or the European Commission’s Standard Contractual Clauses. Our hosting and database run in the EU.",
        },
      ],
    },
    {
      title: "How long we keep data",
      blocks: [
        {
          ul: [
            "Account, profile and activity: while your account exists. If you delete your account, they are removed or anonymised straight away, as described in the next section.",
            "Sign-in sessions (including IP address and user agent): until they expire or you sign out, and deleted when the account is deleted.",
            "Push tokens: until you turn notifications off, replace the device or delete the account.",
            "Support messages: while your account exists. They are deleted when you delete your account.",
            "Crash reports: kept by our monitoring provider for a limited period (by default 90 days).",
            "Technical server logs (including IP address): short-lived, held by our hosting provider for a limited period.",
            "Data we must keep by law: for the terms the law sets.",
          ],
        },
      ],
    },
    {
      title: "Deleting your account: what is removed and what is kept",
      blocks: [
        {
          p: "You can delete your account yourself in the App (Profile, Delete my account). Deletion takes effect immediately and cannot be undone.",
        },
        {
          lead: "Removed or anonymised immediately:",
          p: "your email address (replaced by an unusable placeholder, which also frees it for a future sign-up), name, avatar, study profile, all sign-in sessions and credentials, push tokens, event registrations and tickets, in-app discount codes, material access records, partner-discount usage records, memberships and consents. Your support messages are deleted, and the personal discount codes ASTRA created for you on Eventbrite are revoked.",
        },
        {
          lead: "Kept, without identifying you:",
          p: "the points ledger and your reward redemptions. Ledger entries cannot be changed by design (this protects the integrity of the points system), so they stay attached to an anonymous account that has no name, email or other personal details and can never be signed into. The staff audit log (who changed what in the staff dashboard) is also kept. We also keep a one-way fingerprint (a cryptographic hash) of your email address on that anonymous account, so that deleting and re-registering cannot be used to claim the one-time signup bonus again; the address cannot be recovered from it. Legal basis: our legitimate interest in preventing abuse (art. 6(1)(f)).",
        },
        {
          lead: "Backups:",
          p: "database backups held by our provider are overwritten on their own short rolling schedule; deleted data is not restored into the live service.",
        },
        {
          p: "If you cannot sign in, email us from your university address and we will delete the account for you.",
        },
      ],
    },
    {
      title: "Your rights",
      blocks: [
        {
          p: "You may at any time exercise the rights in articles 15-22 GDPR: access, rectification, erasure, restriction, data portability, objection, and withdrawal of consent (without affecting processing done before withdrawal).",
        },
        {
          p: "To exercise them, email the controller at the address above. We will answer within the legal deadline (normally one month, extendable in complex cases).",
        },
        {
          p: "You also have the right to lodge a complaint with the Italian data protection authority, the Garante per la protezione dei dati personali (www.garanteprivacy.it).",
        },
      ],
    },
    {
      title: "Children",
      blocks: [
        {
          p: "Signing in requires a Bocconi University email address, reserved for enrolled students. We do not knowingly collect data from children outside this context. If we learn that data of a minor was processed without the consent of a person with parental responsibility, we will delete it without undue delay.",
        },
      ],
    },
    {
      title: "Changes to this notice",
      blocks: [
        {
          p: "We may update this notice, for example when we add a provider or a new kind of data. The date of the last update is shown at the top. For material changes we will tell users through the App.",
        },
      ],
    },
  ],
};

export const IT: Policy = {
  lang: "it",
  title: "Informativa sulla Privacy",
  subtitle: "App ASTRA Bocconi (myAstra) e sito web",
  legal:
    "Informativa resa ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR) e del D.lgs. 196/2003 come modificato dal D.lgs. 101/2018 (Codice Privacy).",
  updatedLabel: "Ultimo aggiornamento",
  updated: "9 ottobre 2026",
  footer: "ASTRA Bocconi · Informativa sulla Privacy",
  sections: [
    {
      title: "Premessa",
      blocks: [
        {
          p: "La presente informativa descrive come sono trattati i dati personali di chi utilizza l’applicazione ASTRA Bocconi (l’“App”) e le pagine web di astrabocconi che la supportano (il “Sito”). Il trattamento avviene nel rispetto dei principi di liceità, correttezza, trasparenza, minimizzazione e limitazione della conservazione previsti dal GDPR.",
        },
      ],
    },
    {
      title: "Titolare del trattamento",
      blocks: [
        {
          p: "Il Titolare del trattamento è ASTRABOCCONI – APS (Associazione di Promozione Sociale), con sede legale in Via Roberto Sarfatti, 7 – 20136 Milano (MI).",
        },
        { ul: CONTROLLER_LINES_IT },
        {
          p: "Per ogni richiesta relativa al trattamento dei dati personali è possibile scrivere all’indirizzo email sopra indicato.",
        },
      ],
    },
    {
      title: "Quali dati trattiamo",
      blocks: [
        {
          lead: "Account e accesso.",
          p: "L’indirizzo email istituzionale (@studbocconi.it o @unibocconi.it) e il codice monouso che ti inviamo via email per accedere. Non c’è nessuna password. Conserviamo anche il tuo nome, se lo fornisci, e un seme per l’avatar scelto in modo casuale (una breve stringa casuale che seleziona la tua immagine del profilo a fumetto; non deriva dal tuo nome né dalla tua email).",
        },
        {
          lead: "Profilo di studio.",
          p: "Se lo fornisci: corso di laurea, indirizzo, anno di corso e classe. Serve a mostrarti i contenuti giusti e a indirizzare le notifiche.",
        },
        {
          lead: "Punti, premi e attività.",
          p: "Saldo e storico dei punti, premi riscattati (compreso l’eventuale codice voucher o di ritiro), eventi a cui ti iscrivi o per cui ottieni biglietti, sconti usati presso i locali partner e il codice QR rotante della tua tessera socio.",
        },
        {
          lead: "Messaggi di supporto.",
          p: "Se ci scrivi dalla schermata di supporto dell’App: il messaggio, la categoria, la versione dell’App e la piattaforma del telefono (iOS o Android), collegati al tuo account per poterti rispondere.",
        },
        {
          lead: "Dati del dispositivo e delle sessioni.",
          p: "All’accesso conserviamo una sessione che include il tuo indirizzo IP e lo user agent del browser o dell’App (dettagli su dispositivo e sistema operativo). Se consenti le notifiche conserviamo un token push che identifica il tuo dispositivo ai fini della consegna, con la relativa piattaforma.",
        },
        {
          lead: "Dati di crash e prestazioni.",
          p: "L’App invia report di arresto anomalo e tracce sulle prestazioni al nostro fornitore di monitoraggio degli errori (Sentry): modello del dispositivo, sistema operativo e versione dell’App, schermata in uso ed errore tecnico. A questi report non colleghiamo il tuo nome, la tua email né l’identificativo del tuo account. Il fornitore vede il tuo indirizzo IP come parte della connessione.",
        },
        {
          lead: "Fotocamera (solo account locale partner).",
          p: "La fotocamera è usata esclusivamente per leggere in tempo reale il codice QR della tessera di un socio. Nessuna immagine o video viene salvato o inviato al Titolare.",
        },
        {
          lead: "Posizione.",
          p: "L’App non raccoglie la tua posizione. La mappa “Sconti” mostra la posizione dei locali; il caricamento delle mappe comunica il tuo indirizzo IP al fornitore delle mappe.",
        },
        {
          lead: "Dati solo sul tuo telefono.",
          p: "Il calcolatore dei voti conserva esami e voti sul tuo dispositivo. Non vengono inviati ad ASTRA.",
        },
        {
          lead: "Visitatori del Sito.",
          p: "Le pagine pubbliche (home, privacy, supporto) usano uno strumento di analisi rispettoso della privacy (Umami) gestito da ASTRA. Non usa cookie e non crea profili dei singoli visitatori; registra le visualizzazioni di pagina e dati tecnici generali come browser e paese. La dashboard dello staff e la pagina di accesso non caricano strumenti di analisi.",
        },
      ],
    },
    {
      title: "Finalità e basi giuridiche",
      blocks: [
        {
          lead: "a) Erogazione del servizio",
          p: "Accesso, punti, premi, eventi, materiali, sconti, tessera e assistenza. Base giuridica: esecuzione di un contratto o di misure precontrattuali richieste dall’Interessato (art. 6, par. 1, lett. b, GDPR). Il conferimento di questi dati è necessario per usare l’App.",
        },
        {
          lead: "b) Notifiche push",
          p: "News, eventi e comunicazioni di servizio, solo se consenti le notifiche sul dispositivo. Base giuridica: consenso (art. 6, par. 1, lett. a). Puoi revocarlo in qualsiasi momento dalle impostazioni del telefono; il resto dell’App continua a funzionare.",
        },
        {
          lead: "c) Sicurezza e affidabilità",
          p: "Prevenzione di abusi e accessi non autorizzati (ad esempio limiti alle richieste del codice di accesso) e individuazione e correzione degli arresti anomali. Base giuridica: legittimo interesse del Titolare (art. 6, par. 1, lett. f).",
        },
        {
          lead: "d) Obblighi di legge",
          p: "Trattamenti richiesti dalla legge. Base giuridica: obbligo legale (art. 6, par. 1, lett. c).",
        },
        {
          p: "Non vendiamo i dati personali, non mostriamo pubblicità e non assumiamo decisioni basate unicamente su trattamenti automatizzati che producano effetti giuridici o incidano in modo analogo sulla tua persona.",
        },
      ],
    },
    {
      title: "Chi riceve i dati (responsabili e destinatari)",
      blocks: [
        { p: "Ci avvaliamo dei seguenti fornitori, nominati Responsabili del trattamento ai sensi dell’art. 28 GDPR o, dove indicato, autonomi Titolari:" },
        {
          ul: [
            "Vercel Inc.: hosting delle API dell’App e del Sito (server a Francoforte, UE).",
            "Neon Inc.: database principale (account, punti, premi, eventi, messaggi di supporto), nella stessa regione UE.",
            "Supabase Inc.: archiviazione del catalogo di dispense e guide. I file sono scaricabili pubblicamente e non contengono dati personali che ti riguardano.",
            "Aruba S.p.A.: servizio di posta che invia i codici di accesso e le email di servizio.",
            "Mapbox, Inc.: mappe della sezione “Sconti” (riceve il tuo indirizzo IP e dati tecnici del dispositivo quando le mappe si caricano; la telemetria di utilizzo del fornitore è disattivata nell’App).",
            "Expo (650 Industries, Inc.) con Apple (APNs) e Google (FCM): consegna delle notifiche push. Ricevono il token push e il testo della notifica.",
            "Functional Software, Inc. (Sentry): monitoraggio di arresti anomali e prestazioni, come descritto sopra.",
            "Eventbrite, Inc.: vendita dei biglietti. Toccando “Acquista biglietti” esci dall’App e acquisti su Eventbrite, con la sua informativa; i dati di pagamento vanno a Eventbrite, mai ad ASTRA. Per gli sconti in-app ASTRA crea su Eventbrite un codice sconto monouso per te; non inviamo a Eventbrite la tua identità.",
            "DiceBear (api.dicebear.com): genera l’immagine dell’avatar a fumetto. È chiamato solo dai nostri server, con il seme casuale dell’avatar; non riceve nome, email, identificativo dell’account né il tuo indirizzo IP.",
            "OpenAI, L.L.C.: solo per l’assistente virtuale “Ask ASTRA”, che al momento è disattivato e non disponibile nell’App. Se verrà riattivato, il testo delle domande inserite sarebbe inviato a OpenAI per generare la risposta e questa informativa sarà aggiornata prima.",
            "Consulenti, professionisti e autorità pubbliche, nei limiti degli obblighi di legge.",
          ],
        },
        {
          p: "L’elenco aggiornato dei Responsabili è disponibile su richiesta. I dati non sono soggetti a diffusione.",
        },
      ],
    },
    {
      title: "Trasferimenti extra UE",
      blocks: [
        {
          p: "Alcuni fornitori (ad esempio Sentry, Expo, Mapbox, Eventbrite, Apple, Google) hanno sede negli Stati Uniti o possono trattare i dati in quel Paese. Tali trasferimenti si basano sulle garanzie degli artt. 44-46 GDPR: il Data Privacy Framework UE-USA, se il fornitore è certificato, oppure le Clausole Contrattuali Standard della Commissione europea. L’hosting e il database sono nell’UE.",
        },
      ],
    },
    {
      title: "Per quanto tempo conserviamo i dati",
      blocks: [
        {
          ul: [
            "Account, profilo e attività: finché esiste il tuo account. Se lo elimini, sono rimossi o resi anonimi subito, come descritto nella sezione successiva.",
            "Sessioni di accesso (compresi indirizzo IP e user agent): fino alla scadenza o alla disconnessione, e cancellate con l’eliminazione dell’account.",
            "Token push: finché non disattivi le notifiche, cambi dispositivo o elimini l’account.",
            "Messaggi di supporto: finché esiste il tuo account. Vengono cancellati quando elimini l’account.",
            "Report di arresto anomalo: conservati dal fornitore di monitoraggio per un periodo limitato (di default 90 giorni).",
            "Log tecnici dei server (compreso l’indirizzo IP): di breve durata, conservati dal fornitore di hosting per un periodo limitato.",
            "Dati che dobbiamo conservare per legge: per i termini previsti dalla normativa.",
          ],
        },
      ],
    },
    {
      title: "Eliminazione dell’account: cosa viene rimosso e cosa resta",
      blocks: [
        {
          p: "Puoi eliminare l’account direttamente dall’App (Profilo, Elimina il mio account). L’eliminazione ha effetto immediato e non può essere annullata.",
        },
        {
          lead: "Rimossi o resi anonimi subito:",
          p: "indirizzo email (sostituito da un segnaposto inutilizzabile, che libera l’indirizzo per una futura registrazione), nome, avatar, profilo di studio, tutte le sessioni e le credenziali di accesso, token push, iscrizioni agli eventi e biglietti, codici sconto in-app, registri di accesso ai materiali, registri di utilizzo degli sconti partner, appartenenze e consensi. I tuoi messaggi di supporto vengono cancellati e i codici sconto personali creati da ASTRA per te su Eventbrite vengono revocati.",
        },
        {
          lead: "Conservati, senza identificarti:",
          p: "il registro dei punti e i premi riscattati. Le voci del registro non possono essere modificate per progetto (a tutela dell’integrità del sistema punti), quindi restano collegate a un account anonimo, privo di nome, email e altri dati personali, al quale non è più possibile accedere. Viene conservato anche il registro delle attività dello staff (chi ha modificato cosa nella dashboard). Su quell’account anonimo conserviamo inoltre un’impronta unidirezionale (hash crittografico) del tuo indirizzo email, in modo che eliminare l’account e registrarsi di nuovo non permetta di riottenere il bonus di benvenuto una tantum; dall’impronta non è possibile risalire all’indirizzo. Base giuridica: legittimo interesse del Titolare a prevenire abusi (art. 6, par. 1, lett. f).",
        },
        {
          lead: "Backup:",
          p: "i backup del database detenuti dal fornitore vengono sovrascritti secondo il loro breve ciclo di rotazione; i dati eliminati non vengono ripristinati nel servizio attivo.",
        },
        {
          p: "Se non riesci ad accedere, scrivici dal tuo indirizzo universitario e provvederemo noi all’eliminazione.",
        },
      ],
    },
    {
      title: "I tuoi diritti",
      blocks: [
        {
          p: "Puoi esercitare in qualsiasi momento i diritti previsti dagli artt. 15-22 GDPR: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e revoca del consenso (senza pregiudicare la liceità del trattamento precedente alla revoca).",
        },
        {
          p: "Per esercitarli scrivi al Titolare all’indirizzo email indicato sopra. Risponderemo entro i termini di legge (di norma un mese, prorogabile nei casi complessi).",
        },
        {
          p: "Hai inoltre il diritto di proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).",
        },
      ],
    },
    {
      title: "Minori",
      blocks: [
        {
          p: "L’accesso richiede un indirizzo email dell’Università Bocconi, riservato a studenti iscritti. Non raccogliamo consapevolmente dati di minori al di fuori di questo contesto. Se veniamo a conoscenza di un trattamento di dati di un minore senza il consenso di chi esercita la responsabilità genitoriale, li cancelleremo senza ingiustificato ritardo.",
        },
      ],
    },
    {
      title: "Modifiche alla presente informativa",
      blocks: [
        {
          p: "Possiamo aggiornare questa informativa, ad esempio quando aggiungiamo un fornitore o un nuovo tipo di dato. La data dell’ultimo aggiornamento è indicata in apertura. In caso di modifiche rilevanti avviseremo gli utenti tramite l’App.",
        },
      ],
    },
  ],
};

export const POLICIES = { en: EN, it: IT } as const;
export type Lang = keyof typeof POLICIES;
