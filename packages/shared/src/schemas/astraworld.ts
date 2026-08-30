import { z } from "zod";

/**
 * The editable content of the ASTRAWORLD screen.
 *
 * Shaped like the screen rather than like a generic CMS: the event has a fixed
 * layout and a fixed lifespan, and the point is that someone can correct a time
 * or a speaker without an App Store update. Anything the layout does not vary
 * (the poster, the colours) stays in the app bundle.
 *
 * Both languages are carried side by side so the screen stays bilingual when it
 * is edited — an editor who fills in only Italian would otherwise silently
 * blank the screen for anyone reading in English.
 */

const bilingual = z.object({
  en: z.string().trim().max(2000),
  it: z.string().trim().max(2000),
});

/** A row in the programme. Panels carry the extra detail shown on tap. */
export const astraWorldSlot = z.object({
  time: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM, e.g. 15:00"),
  label: bilingual,
  /** Highlighted as ASTRA's own moment. */
  ours: z.boolean().default(false),
  /** Present only for panels; omit for ordinary slots. */
  panel: z
    .object({
      org: z.string().trim().min(1).max(80),
      window: z.string().trim().min(1).max(40),
      title: bilingual,
      hook: bilingual,
      speakers: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
    })
    .nullish(),
});
export type AstraWorldSlot = z.infer<typeof astraWorldSlot>;

export const astraWorldContent = z.object({
  /** Shown even when the event is over, so the tab never looks broken. */
  visible: z.boolean().default(true),
  date: bilingual,
  dateShort: z.string().trim().min(1).max(12),
  hours: z.string().trim().min(1).max(40),
  venue: z.string().trim().min(1).max(120),
  entry: bilingual,
  tagline: bilingual,
  intro: bilingual,
  dayTitle: bilingual,
  dayParagraphs: z.array(bilingual).max(6).default([]),
  programmeTitle: bilingual,
  programmeNote: bilingual,
  slots: z.array(astraWorldSlot).max(30).default([]),
  villageTitle: bilingual,
  villageBody: bilingual,
  communitiesTitle: bilingual,
  communitiesBody: bilingual,
  partnersTitle: bilingual,
  partnerGroups: z
    .array(
      z.object({
        label: bilingual,
        names: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
      }),
    )
    .max(6)
    .default([]),
  partnersNote: bilingual,
  /** Address handed to the maps app. */
  mapsQuery: z.string().trim().min(1).max(200),
});
export type AstraWorldContent = z.infer<typeof astraWorldContent>;

/**
 * The content the app ships with, and the seed the backoffice editor starts
 * from when nothing has been saved yet.
 *
 * Lives here rather than in the app so both sides read the same source: the
 * editor would otherwise have to reproduce it, and the two copies would drift
 * the first time anyone corrected a typo in one of them.
 *
 * Generated from the app i18n dictionaries, then validated against the schema
 * above, so it cannot be a shape the app would reject.
 */
export const ASTRAWORLD_DEFAULT: AstraWorldContent = {
  "visible": true,
  "date": {
    "en": "4 September 2026",
    "it": "4 settembre 2026"
  },
  "dateShort": "04.09",
  "hours": "12:00 – 23:00",
  "venue": "Parco delle Memorie Industriali",
  "entry": {
    "en": "Free entry",
    "it": "Ingresso libero"
  },
  "tagline": {
    "en": "Music, culture, people.",
    "it": "Musica, cultura, persone."
  },
  "intro": {
    "en": "ASTRAWORLD is a free, full-day festival built by the Astra Network community with the support of Nova Students. One space, from noon until late, where live music, conversation and dj sets follow one another without a break. From day to night, with one shared goal: having fun together.",
    "it": "ASTRAWORLD è un festival gratuito di un giorno intero, costruito dalla community del Network Astra con il supporto di Nova Students. Un solo spazio, dalle 12:00 fino a notte, in cui musica dal vivo, confronto e dj set si susseguono senza interruzioni. Dal giorno alla notte, con un unico obiettivo: divertirsi insieme."
  },
  "dayTitle": {
    "en": "The day",
    "it": "La giornata"
  },
  "dayParagraphs": [
    {
      "en": "It starts at 12:00 with the festival presentation and institutional greetings. From 13:00 the stage goes to emerging artists from the student community: almost two hours dedicated to new projects and to those looking for a real place to play in front of an audience.",
      "it": "Si comincia alle 12:00 con la presentazione del festival e i saluti istituzionali. Dalle 13:00 il palco passa agli artisti emergenti della comunità studentesca: quasi due ore dedicate a nuovi progetti e a chi cerca uno spazio reale in cui suonare davanti a un pubblico."
    },
    {
      "en": "At 15:00 the tone shifts with three fifty-minute panels. Not lectures, but open conversations between guests, professionals and students on the questions that matter most to people deciding what to do with their path.",
      "it": "Dalle 15:00 si cambia registro con tre panel da cinquanta minuti l'uno. Non lezioni frontali, ma conversazioni aperte tra ospiti, professionisti e studenti su temi che riguardano da vicino chi sta scegliendo cosa fare del proprio percorso."
    },
    {
      "en": "At 17:50 the Astra app presentation closes the afternoon. Then, from 18:00 to 23:00, the Funky Express takeover brings the party.",
      "it": "Alle 17:50 la presentazione dell'app Astra chiude il pomeriggio. Poi, dalle 18:00 alle 23:00, si balla con il takeover di Funky Express."
    }
  ],
  "programmeTitle": {
    "en": "Programme",
    "it": "Programma"
  },
  "programmeNote": {
    "en": "The village, bar and food area stay open all day.",
    "it": "Villaggio, bar e area food restano aperti tutto il giorno."
  },
  "slots": [
    {
      "time": "12:00",
      "label": {
        "en": "ASTRAWORLD presentation and institutional greetings",
        "it": "Presentazione di ASTRAWORLD e saluti istituzionali"
      },
      "ours": false
    },
    {
      "time": "13:00",
      "label": {
        "en": "Emerging artists live",
        "it": "Live degli artisti emergenti"
      },
      "ours": false
    },
    {
      "time": "15:00",
      "label": {
        "en": "Funding a startup, for real",
        "it": "Finanziare una startup, davvero"
      },
      "ours": false,
      "panel": {
        "org": "Start Lab · UniCredit",
        "window": "15:00 – 15:50",
        "title": {
          "en": "How a startup actually gets funded: what nobody tells you before you begin",
          "it": "Come si finanzia davvero una startup: cosa nessuno ti dice prima di partire"
        },
        "hook": {
          "en": "Two founders with opposite businesses, one digital and scalable, the other physical and rooted in the city. Both on the moment the money was running out, and what they actually did about it. Alongside them, the person who decides who gets funded and who doesn't, on the most common mistake young founders make when they ask.",
          "it": "Due founder con imprese opposte, una digitale e scalabile, l'altra fisica e radicata in città. Entrambi sul momento in cui i soldi stavano finendo, e su cosa hanno fatto davvero. Accanto a loro, chi decide quali startup vengono finanziate e quali no, sull'errore più comune di chi si presenta a chiedere."
        },
        "speakers": [
          "Chiara Airoldi · Co-Founder & COO, Cloov",
          "Stefano Frosi · Co-Founder & CEO, OpenStage",
          "Start Lab (UniCredit)"
        ]
      }
    },
    {
      "time": "16:00",
      "label": {
        "en": "Is going abroad worth it?",
        "it": "Partire conviene?"
      },
      "ours": false,
      "panel": {
        "org": "EF Education First × Nova Students",
        "window": "16:00 – 16:50",
        "title": {
          "en": "Is going abroad worth it? The ROI of an international experience",
          "it": "Partire conviene? Il ROI di un'esperienza internazionale"
        },
        "hook": {
          "en": "Past the brochure: what an experience abroad really gives back in salary, network and growth, and what it costs. The studies, the career and the relationships you give up by leaving all count. With the question nobody usually asks out loud: when is it genuinely not worth it?",
          "it": "Oltre la brochure: quanto rende davvero un'esperienza all'estero in termini di stipendio, rete e crescita, e quanto costa. Contano anche gli studi, la carriera e le relazioni a cui si rinuncia partendo. Con la domanda che di solito non si fa ad alta voce: quando non conviene?"
        },
        "speakers": [
          "EF Education First",
          "Nova Students"
        ]
      }
    },
    {
      "time": "17:00",
      "label": {
        "en": "Building something nobody can ignore",
        "it": "Costruire qualcosa che nessuno può ignorare"
      },
      "ours": false,
      "panel": {
        "org": "Chapeau Project",
        "window": "17:00 – 17:30",
        "title": {
          "en": "Building something nobody can ignore",
          "it": "Costruire qualcosa che nessuno può ignorare"
        },
        "hook": {
          "en": "From an idea to a project that opens doors. How you get interesting people to say yes when nobody knows who you are yet, and how content stops being content and turns into a network, credibility and real opportunities.",
          "it": "Da un'idea a un progetto che apre porte. Come si convince gente interessante a dire di sì quando ancora nessuno sa chi sei, e come il contenuto smette di essere contenuto e diventa rete, credibilità e opportunità reali."
        },
        "speakers": [
          "Pietro Santini",
          "Giacomo Luppi",
          "Filippo Carabelli"
        ]
      }
    },
    {
      "time": "17:30",
      "label": {
        "en": "Hiring at scale",
        "it": "Assumere in scala"
      },
      "ours": false,
      "panel": {
        "org": "Bending Spoons",
        "window": "17:30 – 18:00",
        "title": {
          "en": "Hiring at scale: the talent challenge at Bending Spoons",
          "it": "Assumere in scala: la sfida del talento in Bending Spoons"
        },
        "hook": {
          "en": "Two thousand hires in Milan. How the selection process really works, what the long tests are actually filtering for, and the most common mistake that sinks an otherwise strong candidate. Ends with practical advice for anyone in the room thinking of applying.",
          "it": "Duemila assunzioni a Milano. Come funziona davvero il processo di selezione, cosa filtrano veramente i test lunghi e qual è l'errore più comune che fa fallire un candidato altrimenti bravo. Si chiude con un consiglio pratico per chi in sala vuole candidarsi."
        },
        "speakers": [
          "Chiara d'Ignazio · Product Manager, Talent team"
        ]
      }
    },
    {
      "time": "17:50",
      "label": {
        "en": "Astra app presentation",
        "it": "Presentazione dell'app Astra"
      },
      "ours": true
    },
    {
      "time": "18:00",
      "label": {
        "en": "Ces Garçons dj set",
        "it": "Ces Garçons dj set"
      },
      "ours": false
    },
    {
      "time": "20:00",
      "label": {
        "en": "Fimiani dj set",
        "it": "Fimiani dj set"
      },
      "ours": false
    },
    {
      "time": "21:30",
      "label": {
        "en": "Jason K dj set",
        "it": "Jason K dj set"
      },
      "ours": false
    }
  ],
  "villageTitle": {
    "en": "The village",
    "it": "Il villaggio"
  },
  "villageBody": {
    "en": "Around the stage, all day long, the village hosts Bocconi's student associations with their own stands: a chance to get a close look at the projects that shape university life and meet the people behind them. The DollyNoire District bar and the food area complete it, open from the start of the day until the end of the night.",
    "it": "Intorno al palco, per tutta la giornata, il villaggio ospita le associazioni studentesche della Bocconi con i propri spazi: un'occasione per conoscere da vicino i progetti che animano la vita universitaria e incontrare chi li porta avanti. Completano l'area il bar DollyNoire District e l'area food, aperti dall'inizio fino a fine serata."
  },
  "communitiesTitle": {
    "en": "Two communities, one festival",
    "it": "Due community, un festival"
  },
  "communitiesBody": {
    "en": "ASTRAWORLD grows out of a collaboration between Astra Network and Nova Students that brings the university community and the high school student community into the same space: two different stages of the same journey, one occasion to meet and exchange experiences and ideas.",
    "it": "ASTRAWORLD nasce da una collaborazione tra Astra Network e Nova Students che porta nello stesso spazio la comunità universitaria e quella degli studenti delle superiori: due momenti diversi dello stesso percorso, un'unica occasione per incontrarsi e scambiarsi esperienze e idee."
  },
  "partnersTitle": {
    "en": "Partners",
    "it": "Partner"
  },
  "partnerGroups": [
    {
      "label": {
        "en": "Gold Sponsors",
        "it": "Gold Sponsor"
      },
      "names": [
        "EBS",
        "EF",
        "UniCredit"
      ]
    },
    {
      "label": {
        "en": "Mobility Sponsor",
        "it": "Sponsor Mobilità"
      },
      "names": [
        "Dott"
      ]
    },
    {
      "label": {
        "en": "Bar naming partner",
        "it": "Naming partner del Bar"
      },
      "names": [
        "DollyNoire District"
      ]
    }
  ],
  "partnersNote": {
    "en": "With the contribution of Regione Lombardia.",
    "it": "Con il contributo di Regione Lombardia."
  },
  "mapsQuery": "Parco delle Memorie Industriali, Milano"
} as const;
