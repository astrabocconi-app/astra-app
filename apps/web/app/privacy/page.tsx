import type { ReactNode } from "react";
import { AstraLogo } from "@/app/_ui/logo";

// Public privacy policy for the ASTRA app (App Store / Play Store requirement).
// Content reflects what the app actually does — no cookies, no analytics/ad
// SDKs, no newsletter feature. Update this if data practices change (new
// third-party processor, new data category collected, etc.).

export const metadata = {
  title: "Informativa sulla Privacy · ASTRA",
};

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-astra-primary">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-gray-700">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-astra-light text-astra-primary">
          <AstraLogo size={26} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-astra-primary">Informativa sulla Privacy</h1>
          <p className="text-xs text-gray-500">Applicazione ASTRA Bocconi</p>
        </div>
      </div>

      <p className="mt-6 text-sm italic leading-6 text-gray-500">
        Informativa resa ai sensi degli artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR) e del
        D.lgs. 196/2003 come modificato dal D.lgs. 101/2018 (Codice Privacy).
        <br />
        Ultimo aggiornamento: 27 agosto 2026
      </p>

      <Section n={1} title="Premessa">
        <p>
          La presente informativa descrive le modalità di trattamento dei dati personali degli
          utenti (di seguito &ldquo;Utente&rdquo; o &ldquo;Interessato&rdquo;) che utilizzano
          l&apos;applicazione ASTRA Bocconi (di seguito l&apos;&ldquo;App&rdquo;). L&apos;utilizzo
          dell&apos;App comporta il trattamento dei dati personali dell&apos;Utente secondo i
          principi di liceità, correttezza, trasparenza, minimizzazione e limitazione della
          conservazione previsti dal GDPR.
        </p>
      </Section>

      <Section n={2} title="Titolare del trattamento">
        <p>
          Il Titolare del trattamento è ASTRABOCCONI – APS (Associazione di Promozione Sociale),
          con sede legale in Via Roberto Sarfatti, 7 – 20136 Milano (MI).
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Codice Fiscale: 97943660155</li>
          <li>Partita IVA: 13411890968</li>
          <li>Email di contatto: info@astrabocconi.com</li>
          <li>PEC: astra.bocconi@pec.it</li>
          <li>Sito web: www.astrabocconi.com</li>
        </ul>
        <p>
          Per ogni richiesta relativa al trattamento dei dati personali è possibile scrivere
          all&apos;indirizzo email sopra indicato.
        </p>
      </Section>

      <Section n={3} title="Tipologie di dati trattati">
        <p>Attraverso l&apos;App sono trattate le seguenti categorie di dati personali.</p>
        <p>
          <strong>Dati di registrazione e autenticazione.</strong> L&apos;accesso all&apos;App
          avviene tramite l&apos;indirizzo email istituzionale dell&apos;Utente
          (@studbocconi.it o @unibocconi.it) e un codice di accesso monouso (OTP) inviato via
          email. Sono inoltre trattati nome, corso di laurea e anno accademico, se forniti
          volontariamente dall&apos;Utente nel proprio profilo.
        </p>
        <p>
          <strong>Dati relativi ai servizi dell&apos;App.</strong> Saldo punti, storico dei punti
          maturati o utilizzati, premi richiesti ed eventuale iscrizione a eventi. Per gli
          account &ldquo;locale partner&rdquo;, il codice del locale e i dati necessari
          all&apos;assegnazione dei punti ai soci.
        </p>
        <p>
          <strong>Fotocamera.</strong> Per gli account &ldquo;locale partner&rdquo;, la fotocamera
          del dispositivo è utilizzata esclusivamente per la lettura in tempo reale del codice QR
          della tessera socio. Nessuna immagine o video viene acquisito, salvato o trasmesso al
          Titolare.
        </p>
        <p>
          <strong>Notifiche push.</strong> Se l&apos;Utente acconsente alla ricezione di
          notifiche, viene trattato l&apos;identificativo tecnico del dispositivo necessario per
          l&apos;invio.
        </p>
        <p>
          <strong>Assistente virtuale &ldquo;Ask ASTRA&rdquo;.</strong> Se l&apos;Utente utilizza
          questa funzione, il testo della domanda inserita viene trattato per generare una
          risposta, secondo quanto descritto al successivo paragrafo 6.
        </p>
        <p>
          <strong>Dati tecnici di rete.</strong> Indirizzo IP e identificativi tecnici trasmessi
          implicitamente dai protocolli di comunicazione durante l&apos;uso dell&apos;App.
          L&apos;App non utilizza cookie né strumenti di analytics o tracciamento pubblicitario di
          terze parti.
        </p>
      </Section>

      <Section n={4} title="Finalità e basi giuridiche del trattamento">
        <p>
          <strong>a) Erogazione del servizio.</strong> Consentire l&apos;accesso e l&apos;utilizzo
          delle funzionalità dell&apos;App (punti, premi, eventi, materiali, assistente virtuale)
          e rispondere alle richieste di supporto inviate via email. Base giuridica: esecuzione di
          un contratto o di misure precontrattuali richieste dall&apos;Interessato (art. 6, par. 1,
          lett. b, GDPR).
        </p>
        <p>
          <strong>b) Invio di notifiche push.</strong> Invio di notifiche relative a news, eventi e
          comunicazioni di servizio, previo consenso dell&apos;Utente al momento dell&apos;attivazione
          delle notifiche sul dispositivo. Base giuridica: consenso dell&apos;interessato (art. 6,
          par. 1, lett. a, GDPR), revocabile in qualsiasi momento disattivando le notifiche dalle
          impostazioni del dispositivo o dell&apos;App.
        </p>
        <p>
          <strong>c) Sicurezza e prevenzione di abusi.</strong> Misure tecniche volte a prevenire
          accessi non autorizzati e un uso anomalo del servizio (ad esempio limiti al numero di
          richieste di codice di accesso). Base giuridica: legittimo interesse del Titolare (art.
          6, par. 1, lett. f, GDPR).
        </p>
        <p>
          <strong>d) Adempimento di obblighi di legge.</strong> Trattamenti necessari per adempiere
          a obblighi previsti dalla normativa vigente. Base giuridica: obbligo legale (art. 6, par.
          1, lett. c, GDPR).
        </p>
        <p>
          Il conferimento dei dati di cui alla lettera a) è necessario per usufruire dei servizi
          dell&apos;App; il mancato conferimento comporta l&apos;impossibilità di erogarli. Il
          consenso alle notifiche push (lettera b) è facoltativo e il rifiuto non pregiudica
          l&apos;utilizzo delle altre funzionalità dell&apos;App.
        </p>
      </Section>

      <Section n={5} title="Modalità del trattamento">
        <p>
          Il trattamento dei dati avviene mediante strumenti informatici e telematici, con logiche
          strettamente correlate alle finalità indicate e nel rispetto delle misure di sicurezza
          tecniche e organizzative adeguate previste dall&apos;art. 32 del GDPR, volte a garantire
          la riservatezza, l&apos;integrità e la disponibilità dei dati e a prevenire accessi non
          autorizzati, perdite o distruzioni.
        </p>
      </Section>

      <Section n={6} title="Destinatari dei dati">
        <p>
          I dati personali possono essere comunicati ai seguenti soggetti terzi, nominati
          Responsabili del trattamento ai sensi dell&apos;art. 28 GDPR o autonomi Titolari:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Vercel Inc.: hosting dell&apos;applicazione e delle API;</li>
          <li>Supabase Inc. e Neon Inc.: fornitori di database e archiviazione;</li>
          <li>
            Aruba S.p.A. e, in via sussidiaria, Resend: invio delle email di accesso
            (codice OTP) e delle comunicazioni di servizio;
          </li>
          <li>
            OpenAI, L.L.C.: elaborazione del testo delle domande inviate tramite
            l&apos;assistente virtuale &ldquo;Ask ASTRA&rdquo;, se utilizzato dall&apos;Utente;
          </li>
          <li>
            Mapbox, Inc.: fornitura delle mappe della sezione &ldquo;Sconti&rdquo;. Il
            caricamento delle mappe comporta il trattamento dell&apos;indirizzo IP e di dati
            tecnici del dispositivo da parte del fornitore. La raccolta di dati di utilizzo a
            fini statistici (telemetria) è disattivata nell&apos;App;
          </li>
          <li>consulenti, professionisti e autorità pubbliche, nei limiti degli obblighi di legge.</li>
        </ul>
        <p>
          L&apos;elenco aggiornato dei Responsabili del trattamento è disponibile su richiesta
          scrivendo al Titolare. I dati non sono soggetti a diffusione né a processi decisionali
          automatizzati che producano effetti giuridici sull&apos;Interessato.
        </p>
      </Section>

      <Section n={7} title="Trasferimento dei dati extra UE">
        <p>
          OpenAI, L.L.C. e Mapbox, Inc., entrambe con sede negli Stati Uniti, trattano
          rispettivamente il testo delle domande inviate tramite &ldquo;Ask ASTRA&rdquo; e i dati
          tecnici necessari al caricamento delle mappe. Tali trasferimenti avvengono sulla base
          delle garanzie adottate dai fornitori, quali le Clausole Contrattuali Standard adottate
          dalla Commissione europea e/o l&apos;adesione al Data Privacy Framework UE-USA (art. 46
          GDPR). Gli altri fornitori indicati al paragrafo 6 trattano i dati all&apos;interno dello
          Spazio Economico Europeo.
        </p>
      </Section>

      <Section n={8} title="Periodo di conservazione dei dati">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Dati di account e punti: conservati per la durata dell&apos;iscrizione dell&apos;Utente
            e per i 12 mesi successivi alla cancellazione dell&apos;account, salvo diversi obblighi
            di legge.
          </li>
          <li>Richieste di supporto inviate via email: conservate per 12 mesi dalla chiusura della richiesta.</li>
          <li>Dati trattati per adempimenti di legge: per i termini previsti dalla normativa applicabile.</li>
        </ul>
        <p>Al termine dei periodi indicati i dati sono cancellati o resi anonimi in modo irreversibile.</p>
      </Section>

      <Section n={9} title="Diritti dell'Interessato">
        <p>
          In relazione ai dati trattati, l&apos;Interessato può esercitare in qualsiasi momento i
          diritti previsti dagli artt. 15-22 del GDPR: accesso ai propri dati, rettifica dei dati
          inesatti o incompleti, cancellazione (&ldquo;diritto all&apos;oblio&rdquo;), limitazione
          del trattamento, portabilità dei dati, opposizione al trattamento e revoca del consenso in
          qualsiasi momento, senza pregiudicare la liceità del trattamento effettuato prima della
          revoca.
        </p>
        <p>
          Per esercitare tali diritti l&apos;Interessato può scrivere all&apos;indirizzo email del
          Titolare indicato al paragrafo 2. Il Titolare fornirà riscontro entro i termini di legge
          (di norma un mese, prorogabile in casi di particolare complessità).
        </p>
        <p>
          L&apos;Interessato ha inoltre il diritto di proporre reclamo al Garante per la protezione
          dei dati personali (www.garanteprivacy.it), qualora ritenga che il trattamento dei propri
          dati violi la normativa vigente.
        </p>
      </Section>

      <Section n={10} title="Minori">
        <p>
          L&apos;accesso all&apos;App richiede un indirizzo email istituzionale
          dell&apos;Università Bocconi (@studbocconi.it o @unibocconi.it), riservato a studenti
          iscritti. Il Titolare non raccoglie consapevolmente dati di minori al di fuori di questo
          contesto. Qualora si venga a conoscenza di un trattamento di dati di un minore effettuato
          senza il consenso di chi esercita la responsabilità genitoriale, i dati saranno
          cancellati senza ingiustificato ritardo.
        </p>
      </Section>

      <Section n={11} title="Modifiche alla presente informativa">
        <p>
          Il Titolare si riserva il diritto di modificare o aggiornare la presente informativa in
          qualsiasi momento, dandone comunicazione agli Utenti tramite l&apos;App. Si invita
          l&apos;Utente a consultare periodicamente questa pagina; la data dell&apos;ultimo
          aggiornamento è indicata in apertura del documento.
        </p>
      </Section>

      <p className="mt-10 text-center text-xs text-gray-400">
        ASTRA Bocconi · Informativa sulla Privacy
      </p>
    </main>
  );
}
