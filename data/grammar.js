// data/grammar.js — Grammar delta cards and pattern drills for Ponte
// For Spanish speakers learning Italian — 40 delta cards, 30 pattern drills

// ── VERB DELTA CARDS (40) ────────────────────────────────────────────────
const grammarCards = [

  // ── TENSE (10) ──────────────────────────────────────────────────────────

  {
    id: 1,
    title: "Passato Prossimo: Essere vs Avere",
    category: "tense",
    difficulty: "B1",
    spanish: {
      label: "Pretérito Perfecto / Indefinido",
      example: "Ayer <em>fui</em> al mercado. / <em>He ido</em> al mercado.",
      note: "Spanish always uses <strong>haber</strong> as the auxiliary for all verbs in compound tenses."
    },
    italian: {
      label: "Passato Prossimo",
      example: "Ieri <em>sono andato</em> al mercato. / <em>Ho mangiato</em> la pizza.",
      note: "Motion and state-change verbs use <strong>essere</strong>; most action/transitive verbs use <strong>avere</strong>. Participle agrees with subject when essere is used."
    },
    trap: "Writing 'ho andato', 'ho venuto', 'ho partito' — these motion verbs always need essere.",
    tip: "Core essere verbs: andare, venire, partire, arrivare, tornare, entrare, uscire, nascere, morire, restare, scendere, salire, cadere, diventare, sembrare. All reflexives also use essere."
  },

  {
    id: 2,
    title: "Imperfetto: Polite Requests",
    category: "tense",
    difficulty: "B1",
    spanish: {
      label: "Pretérito Imperfecto",
      example: "De niño <em>jugaba</em> en el parque. / <em>Quería</em> pedirte algo.",
      note: "Used for past habits, ongoing states, and background — same uses as Italian. 'Quería pedirte' softens a request."
    },
    italian: {
      label: "Imperfetto",
      example: "Da bambino <em>giocavo</em> al parco. / <em>Volevo</em> un caffè.",
      note: "Same habitual/background uses as Spanish. But Italian imperfetto has a uniquely common use as a <strong>polite softener</strong> in shops and restaurants: 'volevo' = I would like (more natural than 'vorrei' in many contexts)."
    },
    trap: "Missing the shop/restaurant imperfetto: 'Volevo un cornetto' sounds natural in Italian; 'quería un croissant' is also used in Spanish but less pervasive.",
    tip: "In a café, 'Volevo un caffè macchiato' is perfectly natural Italian — the imperfetto softens the request the way English 'I was hoping for...' does."
  },

  {
    id: 3,
    title: "Passato Prossimo vs Imperfetto",
    category: "tense",
    difficulty: "B1",
    spanish: {
      label: "Pretérito Indefinido vs Imperfecto",
      example: "<em>Dormía</em> cuando <em>sonó</em> el teléfono.",
      note: "Ongoing background state (imperfecto) interrupted by a completed action (indefinido). Same logic applies in Italian."
    },
    italian: {
      label: "Imperfetto vs Passato Prossimo",
      example: "<em>Dormivo</em> quando <em>ha suonato</em> il telefono.",
      note: "Same foreground/background logic — but the completed action uses <strong>passato prossimo</strong> (not passato remoto, in everyday northern/central Italian speech)."
    },
    trap: "Using passato remoto for the completed action in everyday speech. 'Dormivo quando suonò il telefono' sounds literary or southern-regional.",
    tip: "In everyday Italian (especially north of Rome): passato prossimo does all the work of Spanish pretérito indefinido for recent/personal events."
  },

  {
    id: 4,
    title: "Futuro: Epistemic Probability",
    category: "tense",
    difficulty: "B1",
    spanish: {
      label: "Futuro Simple",
      example: "¿Quién <em>será</em> ese hombre? / <em>Tendrá</em> unos cuarenta años.",
      note: "Spanish futuro can express conjecture or probability ('must be', 'probably is')."
    },
    italian: {
      label: "Futuro Semplice (same epistemic use)",
      example: "Chi <em>sarà</em> quell'uomo? / <em>Avrà</em> una quarantina d'anni.",
      note: "Italian uses futuro semplice the same way — for <strong>present probability</strong>: 'avrà' = he must be about / he's probably. For scheduled near-future, present tense is more common."
    },
    trap: "Using present indicativo for probability when futuro is needed: 'Chi è?' asks who someone is; 'chi sarà?' expresses the uncertainty of not knowing.",
    tip: "Italian futuro epistemic use = Spanish futuro epistémico. Both languages say 'avrà/tendrá trent'anni' to mean 'must be about thirty'. Identical usage."
  },

  {
    id: 5,
    title: "Stare + Gerundio: Restricted Use",
    category: "tense",
    difficulty: "B1",
    spanish: {
      label: "Estar + Gerundio (broad use)",
      example: "<em>Está viviendo</em> en Roma desde hace un año. / <em>Estaba</em> trabajando todo el día.",
      note: "Estar + gerundio spans current moment, extended periods, and interrupted past actions."
    },
    italian: {
      label: "Stare + Gerundio (current moment only)",
      example: "<em>Sta vivendo</em> a Roma — <strong>wrong</strong>. ✓ <em>Vive</em> a Roma da un anno. / <em>Stavo</em> lavorando quando hai chiamato.",
      note: "Italian stare + gerundio is <strong>restricted to the action in progress at a specific moment</strong>. It cannot express extended ongoing states — use simple present + da instead."
    },
    trap: "Saying 'Sto vivendo a Roma da un anno' — Italian uses simple present instead: 'Vivo a Roma da un anno'.",
    tip: "Stare + gerundio = snapshot at this moment. For extended ongoing states, Italian reaches for simple tenses, not the progressive."
  },

  {
    id: 6,
    title: "Da + Present for Ongoing Duration",
    category: "tense",
    difficulty: "B1",
    spanish: {
      label: "Hace… que / Llevar + Gerundio",
      example: "<em>Hace tres años que</em> estudio italiano. / <em>Llevo tres años</em> estudiando italiano.",
      note: "Spanish needs a special construction for 'have been doing X for Y time'."
    },
    italian: {
      label: "Present Tense + Da",
      example: "<em>Studio</em> italiano <em>da tre anni</em>.",
      note: "Italian uses simple present tense + <strong>da</strong> + time expression. Compact but structurally different from Spanish. Imperfetto + da = was doing X for Y time (before being interrupted)."
    },
    trap: "Translating Spanish word-for-word: *'fa tre anni che studio' — not standard. Also: 'ho studiato da tre anni' is wrong; passato prossimo implies the action is complete.",
    tip: "Present + da = still ongoing. Imperfetto + da = was ongoing (before something else happened). 'Studiavo da un'ora quando ha chiamato' = I'd been studying for an hour when he called."
  },

  {
    id: 7,
    title: "Passato Remoto: Regional Register",
    category: "tense",
    difficulty: "B2",
    spanish: {
      label: "Pretérito Indefinido",
      example: "Ayer <em>comí</em> aquí. / Colón <em>llegó</em> a América en 1492.",
      note: "Spanish pretérito indefinido covers both recent and historical past (with perfecto compuesto varying by region)."
    },
    italian: {
      label: "Passato Remoto: Historical / Literary",
      example: "Colombo <em>arrivò</em> in America nel 1492. / Ieri <em>ho mangiato</em> qui. (north)",
      note: "Standard written Italian: passato remoto = historical or distant past. <strong>Northern Italy</strong>: passato prossimo for everything recent. <strong>Southern Italy</strong>: passato remoto even for yesterday."
    },
    trap: "Using passato remoto for recent events in a northern context — it sounds literary, formal, or regionally southern.",
    tip: "Safe rule: passato prossimo for anything with a present-day connection. Passato remoto for historical events and formal/literary writing."
  },

  {
    id: 8,
    title: "Gerundio Cannot Modify Nouns",
    category: "tense",
    difficulty: "B2",
    spanish: {
      label: "Gerundio as Noun Modifier",
      example: "Vi a <em>un hombre corriendo</em>. / <em>La mujer llorando</em> en la calle.",
      note: "Spanish gerundio can describe another noun's action (lo vi saliendo, la vi llorando)."
    },
    italian: {
      label: "No Gerundio as Noun Modifier",
      example: "✗ *Ho visto un uomo correndo. ✓ Ho visto <em>un uomo che correva</em>.",
      note: "Italian requires a relative clause (che + verb) where Spanish uses a gerundio to modify a noun. Italian gerundio only modifies the subject of its own clause."
    },
    trap: "Saying *'Ho visto un uomo correndo' — this sounds Spanish-influenced and is not Italian. Use 'un uomo che correva' or 'un uomo mentre correva'.",
    tip: "Italian gerundio = Spanish gerundio but only when the subjects match: 'Ho mangiato guardando la TV' (I ate while watching). Can't describe someone else's action — that needs 'che'."
  },

  {
    id: 9,
    title: "Trapassato Prossimo: Essere/Avere Split",
    category: "tense",
    difficulty: "B2",
    spanish: {
      label: "Pluscuamperfecto",
      example: "Cuando <em>llegué</em>, ya <em>había comido</em>. / Ya se <em>había ido</em>.",
      note: "Always formed with imperfecto de haber + participio. All verbs use haber — no splits."
    },
    italian: {
      label: "Trapassato Prossimo",
      example: "Quando sono arrivato, aveva già mangiato. / <em>Era</em> già <em>andato via</em>.",
      note: "Imperfetto di avere + participio <strong>OR</strong> imperfetto di essere + participio — the same essere/avere split as passato prossimo applies to all compound tenses."
    },
    trap: "Using avere for essere-verbs: *'aveva andato' must be 'era andato'. The split never takes a day off.",
    tip: "If a verb uses essere in passato prossimo, it uses essere in trapassato, condizionale passato, and congiuntivo passato too. The rule is consistent across all compound tenses."
  },

  {
    id: 10,
    title: "Condizionale Passato in Hypotheticals",
    category: "tense",
    difficulty: "B2",
    spanish: {
      label: "Condicional Compuesto",
      example: "Si <em>hubiera</em> sabido, <em>habría venido</em>.",
      note: "Si + pluscuamperfecto subjuntivo → condicional compuesto. All verbs use haber."
    },
    italian: {
      label: "Condizionale Passato",
      example: "Se <em>avessi</em> saputo, <em>sarei venuto</em>.",
      note: "Se + congiuntivo trapassato → condizionale passato. Essere-verbs use essere in condizionale passato too: <strong>sarei venuto</strong>, non 'avrei venuto'."
    },
    trap: "Using avere for essere-verbs: *'avrei andato' must be 'sarei andato'. *'avrei venuto' must be 'sarei venuto'.",
    tip: "Condizionale passato of essere-verbs: sarei, saresti, sarebbe, saremmo, sareste, sarebbero + participle (with agreement). Same essere rule, every tense."
  },

  // ── PRONOUN (8) ─────────────────────────────────────────────────────────

  {
    id: 11,
    title: "Ne: The Partitive Pronoun",
    category: "pronoun",
    difficulty: "B1",
    spanish: {
      label: "No Equivalent",
      example: "¿Cuántas manzanas tienes? — Tengo <em>tres</em>. / Hablamos <em>de eso</em>.",
      note: "Spanish repeats the noun, drops it, or uses 'de eso/de ello'. There is no partitive clitic."
    },
    italian: {
      label: "Ne",
      example: "Quante mele hai? — <em>Ne</em> ho tre. / Parliamo di politica → <em>Ne</em> parliamo.",
      note: "<strong>Ne</strong> replaces 'di + noun/pronoun' and is mandatory with quantities: 'ne ho tre' = I have three of them; 'ne parliamo' = we talk about it (di + topic)."
    },
    trap: "Omitting ne with quantities: *'Ho tre' is wrong — you must say 'Ne ho tre'. Also: when the participle follows ne, it agrees: 'ne ho mangiate tre' (mele, f.pl.).",
    tip: "Whenever you answer a 'how many?' question without repeating the noun, ne is required. Think of ne as 'of it/of them' — Italian always expresses it; Spanish drops it."
  },

  {
    id: 12,
    title: "Ci: The Locative Pronoun",
    category: "pronoun",
    difficulty: "B1",
    spanish: {
      label: "No Locative Clitic",
      example: "¿Vas al mercado? — Sí, voy <em>(allí)</em>. / No pienso <em>en eso</em>.",
      note: "Spanish drops the location or repeats it — no locative clitic equivalent to ci."
    },
    italian: {
      label: "Ci",
      example: "Vai al mercato? — Sì, <em>ci</em> vado. / <em>Ci</em> penso spesso. / <em>Ci</em> vuole pazienza.",
      note: "<strong>Ci</strong> replaces 'a/in + place' and 'a + thing being thought about'. Also: c'è / ci sono (there is/are), and ci vuole (it takes / it requires)."
    },
    trap: "Dropping ci when referencing a previously mentioned place: after 'al bar?' the response 'Vado ogni giorno' is incomplete — 'Ci vado ogni giorno' is required.",
    tip: "Ci stacks with ne: 'ci vuole' (it takes), 'farcela' (fare + ci + la = to manage it). These two clitics do enormous work in Italian with no Spanish parallel."
  },

  {
    id: 13,
    title: "Double Pronouns: Glielo vs Se lo",
    category: "pronoun",
    difficulty: "B2",
    spanish: {
      label: "Se lo / Se la / Se los / Se las",
      example: "¿Le das el libro a María? — <em>Se lo</em> doy.",
      note: "All 3rd-person indirect + direct combinations become se lo/la/los/las in Spanish."
    },
    italian: {
      label: "Glielo / Gliela / Glieli / Gliele",
      example: "Gli dai il libro? — <em>Glielo</em> do.",
      note: "Italian fuses gli + lo → <strong>glielo</strong> (one word). This covers him, her (informal), and them. Italian never changes gli to 'se' before a direct object pronoun."
    },
    trap: "Writing *'se lo do' or *'lo gli do' instead of 'glielo do' — glielo is always one fused word in Italian.",
    tip: "Glielo, gliela, glieli, gliele — all one word, never separated. One form serves him, her, and them (unlike Spanish le/les → se before lo/la)."
  },

  {
    id: 14,
    title: "Clitic Climbing with Modals",
    category: "pronoun",
    difficulty: "B2",
    spanish: {
      label: "Clitic Climbing (optional)",
      example: "Quiero <em>verlo</em>. / <em>Lo</em> quiero ver. (both OK)",
      note: "In Spanish, clitics can attach to the infinitive or climb to the conjugated verb."
    },
    italian: {
      label: "Clitic Climbing (same freedom, extra idioms)",
      example: "Voglio <em>vederlo</em>. / <em>Lo</em> voglio vedere. (both OK) / <em>Farcela</em> = fare + ci + la.",
      note: "Italian allows the same clitic climbing with modals. But Italian also has <strong>idiomatic fused forms</strong> like farcela (to manage), andarsene (to leave), cavarsela (to get by) — these have no direct Spanish equivalents."
    },
    trap: "Treating farcela / andarsene as separable the way simple clitics are: 'ce la faccio' works but 'la faccio ce' doesn't — learn these as fixed idioms.",
    tip: "Same clitic freedom as Spanish for simple cases. Bonus: Italian has lexicalized multi-clitic idioms (farcela, cavarsela, andarsene) that must be learned whole."
  },

  {
    id: 15,
    title: "Past Participle Agrees with Direct Object Clitic",
    category: "pronoun",
    difficulty: "B2",
    spanish: {
      label: "No Agreement",
      example: "La película que <em>he visto</em>. / Las velas que <em>has apagado</em>.",
      note: "Modern Spanish does not make the past participle agree with a preceding direct object."
    },
    italian: {
      label: "Mandatory Agreement",
      example: "Il film che <em>ho visto</em>. / Le candele — <em>le hai spente</em>.",
      note: "When a direct object clitic precedes the verb, the past participle <strong>must agree</strong> in gender and number: lo → visto, la → vista, li → visti, le → viste/spente."
    },
    trap: "Saying *'le ho spento' instead of 'le ho spente' — when 'le' (them, f.pl.) precedes the verb, the participle needs the -e plural ending.",
    tip: "Direct object clitic before the verb → participle agrees. No preceding clitic → no required agreement. Le candele? Le ho spente."
  },

  {
    id: 16,
    title: "Gli: One Pronoun for Him, Her, Them",
    category: "pronoun",
    difficulty: "B2",
    spanish: {
      label: "Le (singular) / Les (plural)",
      example: "<em>Le</em> doy el libro (a él/a ella). <em>Les</em> doy el libro (a ellos/ellas).",
      note: "Spanish distinguishes singular indirect object (le) from plural (les)."
    },
    italian: {
      label: "Gli (him / her-informal / them)",
      example: "<em>Gli</em> do il libro (a lui / a lei / a loro).",
      note: "In modern spoken Italian, <strong>gli</strong> serves as indirect object for him, her, and them. Only in formal writing does Italian distinguish: gli (him), le (her), loro (them, post-verbal)."
    },
    trap: "Assuming 'le' always means 'to her' in Italian — in everyday speech, gli replaces le and loro. Context and verb agreement disambiguate.",
    tip: "In conversation, gli does it all. In formal writing: gli (him), le (her), loro/gli (them). Don't overthink it in speech."
  },

  {
    id: 17,
    title: "C'è / Ci Sono vs Hay",
    category: "pronoun",
    difficulty: "B1",
    spanish: {
      label: "Hay (invariable)",
      example: "<em>Hay</em> un problema. <em>Hay</em> tres problemas.",
      note: "Spanish hay is invariable — it doesn't change for singular vs plural nouns."
    },
    italian: {
      label: "C'è / Ci Sono",
      example: "<em>C'è</em> un problema. <em>Ci sono</em> tre problemi.",
      note: "Italian requires number agreement: <strong>c'è</strong> for singular, <strong>ci sono</strong> for plural. The verb 'essere' shows through."
    },
    trap: "Using c'è with a plural noun: *'C'è tre persone' — must be 'ci sono tre persone'.",
    tip: "C'è = hay (singular). Ci sono = hay (plural). Unlike Spanish hay, Italian c'è/ci sono agree in number."
  },

  {
    id: 18,
    title: "Subject Pronoun Drop",
    category: "pronoun",
    difficulty: "B1",
    spanish: {
      label: "Pro-Drop (routinely dropped)",
      example: "<em>(Yo)</em> voy al mercado. <em>(Él)</em> dice que viene.",
      note: "Spanish drops subject pronouns routinely; retains them only for contrast or emphasis."
    },
    italian: {
      label: "Pro-Drop (also dropped, with clearer switching signals)",
      example: "<em>(Io)</em> vado al mercato. <em>Lui</em> dice che <em>lei</em> viene.",
      note: "Italian also drops subject pronouns in most contexts, but tends to express 3rd-person pronouns (lui/lei/loro) more freely to signal subject switches, since Italian verb endings are less distinct than Spanish ones."
    },
    trap: "Leaving out lui/lei when the subject switches mid-sentence — Italian listeners rely on the pronoun more than Spanish listeners do to track who is doing what.",
    tip: "When the subject changes, Italian often keeps lui/lei to signal the shift clearly. Spanish can rely on verb endings alone more readily."
  },

  // ── SUBJUNCTIVE (6) ─────────────────────────────────────────────────────

  {
    id: 19,
    title: "Penso Che + Congiuntivo (Always)",
    category: "subjunctive",
    difficulty: "B1",
    spanish: {
      label: "Creo que + Indicativo (spoken) / Subjuntivo (formal)",
      example: "Creo que <em>viene</em> mañana. (spoken) / Creo que <em>venga</em>. (formal)",
      note: "In colloquial Spanish, positive verbs of belief (creo que, pienso que) often take indicativo."
    },
    italian: {
      label: "Penso Che + Congiuntivo (always)",
      example: "Penso che <em>venga</em> domani. / Credo che <em>sia</em> a casa.",
      note: "Italian consistently requires <strong>congiuntivo</strong> after verbs of opinion, belief, and supposition — in all registers, spoken and written."
    },
    trap: "Using indicativo after 'penso che', 'credo che', 'suppongo che': *'Penso che viene' is wrong Italian, even in casual speech.",
    tip: "Italian pensare/credere/supporre/ritenere + che → always congiuntivo. There is no spoken shortcut like in Spanish."
  },

  {
    id: 20,
    title: "Impersonal Expressions + Congiuntivo",
    category: "subjunctive",
    difficulty: "B1",
    spanish: {
      label: "Es + adjective + que + subjuntivo",
      example: "Es importante que <em>llegues</em> a tiempo. Es posible que <em>venga</em>.",
      note: "Spanish impersonal expressions with a personal subject follow the same pattern as Italian."
    },
    italian: {
      label: "È + adjective + che + congiuntivo",
      example: "È importante che <em>arrivi</em> in orario. È possibile che <em>venga</em>.",
      note: "Structure mirrors Spanish. Also: <strong>bisogna che</strong> (it's necessary that) and <strong>occorre che</strong> both trigger congiuntivo and have no Spanish parallel with the same structure."
    },
    trap: "Using indicativo: *'È importante che arriva' — congiuntivo is required. Some forms look identical (arrivi = 2nd sing. indicativo AND congiuntivo) — context resolves.",
    tip: "Bisogna che / Occorre che + congiuntivo = Italian-only structures. Spanish uses 'hay que + infinitive' instead, so these are new territory."
  },

  {
    id: 21,
    title: "Benché / Sebbene + Congiuntivo",
    category: "subjunctive",
    difficulty: "B2",
    spanish: {
      label: "Aunque + Indicativo (known) or Subjuntivo (hypothetical)",
      example: "<em>Aunque</em> hace frío, salgo. / <em>Aunque</em> haga frío, saldré.",
      note: "Spanish 'aunque' takes indicativo for known facts, subjuntivo for concession of possibility."
    },
    italian: {
      label: "Benché / Sebbene + Congiuntivo (always)",
      example: "<em>Benché</em> faccia freddo, esco. / <em>Sebbene</em> sia stanco, continua.",
      note: "<strong>Benché</strong> and <strong>sebbene</strong> require congiuntivo even for known facts. There is no indicativo option with these conjunctions."
    },
    trap: "Using indicativo after benché/sebbene: *'Benché fa freddo' is ungrammatical. For known facts without subjunctive, use 'anche se' + indicativo.",
    tip: "Benché/sebbene = automatic congiuntivo. Want indicativo? Switch to 'anche se': 'Anche se fa freddo, esco' (known fact, no subjunctive needed)."
  },

  {
    id: 22,
    title: "Prima Che + Congiuntivo",
    category: "subjunctive",
    difficulty: "B2",
    spanish: {
      label: "Antes de que + Subjuntivo",
      example: "Llámame <em>antes de que</em> salgas.",
      note: "Spanish antes de que always takes subjuntivo — same as Italian prima che."
    },
    italian: {
      label: "Prima Che + Congiuntivo / Prima Di + Infinitive",
      example: "Chiamami <em>prima che tu parta</em>. / <em>Prima di partire</em>, chiamami.",
      note: "<strong>Prima che</strong> (different subjects) + congiuntivo. <strong>Prima di</strong> (same subject) + infinitive. Other congiuntivo conjunctions: affinché, a meno che non, nel caso in cui, purché."
    },
    trap: "Using prima che with the same subject: *'Prima che io parta, chiamami' — when subjects are the same, Italian uses prima di + infinitive: 'Prima di partire, chiamami'.",
    tip: "Two subjects → prima che + congiuntivo. Same subject → prima di + infinitive. Identical rule to Spanish antes de que / antes de."
  },

  {
    id: 23,
    title: "Congiuntivo in Independent Wishes",
    category: "subjunctive",
    difficulty: "B2",
    spanish: {
      label: "¡Ojalá! / ¡Que + Subjuntivo!",
      example: "¡<em>Ojalá</em> venga! / ¡<em>Que</em> te vaya bien!",
      note: "Spanish uses 'ojalá' (from Arabic) or standalone 'que' for wishes."
    },
    italian: {
      label: "Magari / Che + Congiuntivo",
      example: "<em>Magari</em> venisse! / <em>Che</em> tu possa farcela!",
      note: "<strong>Magari</strong> = if only / I wish (with congiuntivo) or maybe / perhaps (with indicativo/condizionale). The mood changes the meaning completely."
    },
    trap: "Using 'magari' without congiuntivo for a wish: 'Magari viene' = maybe he'll come (possibility); 'Magari venisse!' = if only he'd come! (wish). Wrong mood, wrong meaning.",
    tip: "Magari + congiuntivo imperfetto = strong wish (if only). Magari + indicativo = maybe. Context and mood together carry the full meaning."
  },

  {
    id: 24,
    title: "Congiuntivo Passato Formation",
    category: "subjunctive",
    difficulty: "B2",
    spanish: {
      label: "Pretérito Perfecto de Subjuntivo",
      example: "Spero che <em>sia venuto</em>. → Espero que <em>haya venido</em>.",
      note: "Spanish: imperfecto de subjuntivo de haber + participio. All verbs use haber."
    },
    italian: {
      label: "Congiuntivo Passato",
      example: "Spero che <em>sia venuto</em>. / Penso che <em>abbia mangiato</em>.",
      note: "Congiuntivo presente di essere/avere + participio passato. The essere/avere split applies here too: essere-verbs → sia/siano + participio (with agreement)."
    },
    trap: "Using avere for essere-verbs: *'Penso che abbia andato' — must be 'Penso che sia andato'.",
    tip: "Congiuntivo passato = congiuntivo of essere or avere + participio. Essere-verbs: 'sia andato/a'; avere-verbs: 'abbia mangiato'. The split is relentless."
  },

  // ── REFLEXIVE (4) ───────────────────────────────────────────────────────

  {
    id: 25,
    title: "Reflexive Verbs Use Essere",
    category: "reflexive",
    difficulty: "B1",
    spanish: {
      label: "Reflexivos: Haber (always)",
      example: "<em>Me he levantado</em> tarde. / <em>Se han duchado</em>.",
      note: "Spanish reflexive verbs always use haber in compound tenses."
    },
    italian: {
      label: "Riflessivi: Essere (always)",
      example: "<em>Mi sono alzato</em> tardi. / <em>Si sono fatti</em> la doccia.",
      note: "Italian reflexive verbs always use <strong>essere</strong> in compound tenses. The past participle agrees in gender and number with the subject."
    },
    trap: "Using avere for reflexives: *'mi ho alzato' must be 'mi sono alzato'. Also: forgetting agreement — a female speaker says 'mi sono alzata', not 'alzato'.",
    tip: "Reflexive + essere → participle agrees. Mi sono lavato (m.), mi sono lavata (f.), ci siamo lavati (m./mixed group), ci siamo lavate (f. group)."
  },

  {
    id: 26,
    title: "Reflexive Meaning Changes",
    category: "reflexive",
    difficulty: "B1",
    spanish: {
      label: "Reflexivo vs No Reflexivo",
      example: "<em>Ir</em> (to go) vs <em>irse</em> (to leave/go away). <em>Llamar</em> vs <em>llamarse</em> (to be called).",
      note: "Spanish adds reflexive to shift meaning — same pattern as Italian."
    },
    italian: {
      label: "Verbo vs Verbo Riflessivo",
      example: "<em>Sentire</em> un rumore (to hear) vs <em>sentirsi</em> bene (to feel). <em>Trovare</em> la chiave (to find) vs <em>trovarsi</em> a Milano (to be located).",
      note: "Italian has the same reflexive/non-reflexive meaning shift, plus several reflexive-only idioms: <strong>rendersi conto</strong> (to realize), <strong>accorgersi</strong> (to notice), <strong>farcela</strong> (to manage)."
    },
    trap: "Missing Italian-specific reflexive constructions: 'Non me ne sono accorto' (I didn't notice it) uses both 'ne' and the reflexive — a structure without a clean Spanish parallel.",
    tip: "Key Italian reflexive idioms: rendersi conto di (darse cuenta de), accorgersi di (darse cuenta de / notar), farcela (poder con algo / conseguirlo)."
  },

  {
    id: 27,
    title: "Modal + Reflexive: Compound Tense Auxiliary",
    category: "reflexive",
    difficulty: "B2",
    spanish: {
      label: "Modal + Reflexivo (always haber)",
      example: "<em>Me he querido</em> lavar. / He querido <em>lavarme</em>. (both use haber)",
      note: "Spanish compound modal constructions always use haber regardless of clitic position."
    },
    italian: {
      label: "Auxiliary Changes with Clitic Position",
      example: "<em>Mi sono dovuto</em> lavare. (clitic climbs → essere) / <em>Ho dovuto</em> lavarmi. (clitic on inf → avere)",
      note: "When the reflexive clitic climbs to the modal, Italian uses <strong>essere</strong>. When it stays on the infinitive, Italian uses <strong>avere</strong>. Both are grammatical."
    },
    trap: "Using avere when the clitic has climbed: *'mi ho dovuto lavare' is wrong — must be 'mi sono dovuto lavare'.",
    tip: "Reflexive clitic before modal → essere. Reflexive clitic on infinitive → avere. Heard both ways in speech — but the mixed form ('mi ho...') is always wrong."
  },

  {
    id: 28,
    title: "Reciprocal Reflexives in Compound Tenses",
    category: "reflexive",
    difficulty: "B1",
    spanish: {
      label: "Recíprocos con Haber",
      example: "<em>Nos hemos visto</em> ayer. / <em>Se quieren</em> mucho.",
      note: "Spanish uses nos/se for reciprocal meaning; compound tenses use haber."
    },
    italian: {
      label: "Riflessivi Reciproci con Essere",
      example: "<em>Ci siamo visti</em> ieri. / <em>Si amano</em> molto.",
      note: "Italian uses ci (1st pl.) and si (3rd pl.) for reciprocal meaning — same as Spanish nos/se. But compound tenses use <strong>essere</strong>, and the participle agrees."
    },
    trap: "Using avere in compound reciprocals: *'ci abbiamo visti' is wrong — must be 'ci siamo visti'. Participle: visti (m./mixed), viste (f.).",
    tip: "Reciprocal compound tense: ci siamo / si sono + participle (agreed). 'Ci siamo visti' = 'nos hemos visto' — but essere, not haber."
  },

  // ── PREPOSITION (5) ─────────────────────────────────────────────────────

  {
    id: 29,
    title: "A vs In: Cities, Countries, Regions",
    category: "preposition",
    difficulty: "B1",
    spanish: {
      label: "A for All Destinations",
      example: "Voy <em>a</em> Roma. Voy <em>a</em> Italia. Voy <em>a</em> Toscana.",
      note: "Spanish uses 'a' as the destination preposition for all geographic places."
    },
    italian: {
      label: "A (cities) vs In (countries, regions)",
      example: "Vado <em>a</em> Roma. Vado <em>in</em> Italia. Vado <em>in</em> Toscana.",
      note: "<strong>A</strong> + città (any city). <strong>In</strong> + paese/regione/continente/isola. For masculine/plural country names: 'negli Stati Uniti', 'nel Giappone' (formal) though 'in Giappone' is standard."
    },
    trap: "Using 'a' for countries: *'Vado a Italia' is wrong — must be 'vado in Italia'.",
    tip: "A + city. In + country or region. The preposition changes at the city limits. Vado a Napoli but vado in Campania."
  },

  {
    id: 30,
    title: "Da for Ongoing Duration",
    category: "preposition",
    difficulty: "B1",
    spanish: {
      label: "Hace… que / Desde hace / Llevar + Gerundio",
      example: "<em>Hace</em> dos años <em>que</em> vivo aquí. / <em>Llevo</em> dos años viviendo aquí.",
      note: "Spanish uses a specific construction for ongoing actions that began in the past."
    },
    italian: {
      label: "Present Tense + Da",
      example: "Vivo qui <em>da</em> due anni. / Studio italiano <em>da</em> tre anni.",
      note: "<strong>Da</strong> + duration with present tense = action ongoing from past to now. With imperfetto: 'Vivevo lì da due anni quando...' = I'd been living there for two years when..."
    },
    trap: "Translating Spanish structure: *'fa due anni che vivo qui' — not standard Italian. Simply: 'vivo qui da due anni'. Also: 'ho vissuto qui da' is wrong — that would be passato prossimo (completed).",
    tip: "Present + da = ongoing to now. Imperfetto + da = was ongoing when interrupted. Once you drop 'hace...que', this is the most natural Italian structure."
  },

  {
    id: 31,
    title: "Da: Going to Someone's Place",
    category: "preposition",
    difficulty: "B1",
    spanish: {
      label: "A casa de / En casa de",
      example: "Voy <em>a casa de</em> Marco. Estoy <em>en casa de</em> Ana.",
      note: "Spanish uses 'a casa de' or 'en casa de' + person's name — the 'casa' is made explicit."
    },
    italian: {
      label: "Da + Person (no 'casa' needed)",
      example: "Vado <em>da</em> Marco. Sono <em>dal</em> medico. Passo <em>dalla</em> nonna.",
      note: "<strong>Da</strong> + person = at their place or office. 'Vado dal medico' = I'm going to the doctor's. No 'casa' needed — da carries the meaning of 'to their place'."
    },
    trap: "Adding 'casa' unnecessarily: 'vado a casa di Marco' works but sounds more explicit than the natural 'vado da Marco'.",
    tip: "Da + person = to/at their place. Vado dal medico, vado dalla nonna, vado da Giulia. Clean and idiomatic — no 'casa' required."
  },

  {
    id: 32,
    title: "In vs A: Seasons and Months",
    category: "preposition",
    difficulty: "B1",
    spanish: {
      label: "En for Both Seasons and Months",
      example: "<em>En</em> verano hace calor. <em>En</em> enero nieva.",
      note: "Spanish uses 'en' uniformly for both seasons and months."
    },
    italian: {
      label: "In (seasons) vs A (months)",
      example: "<em>In</em> estate fa caldo. <em>In</em> inverno nevica. <em>A</em> gennaio nevica.",
      note: "<strong>In</strong> + stagione (estate, autunno, inverno, primavera). <strong>A</strong> + mese (a gennaio, a marzo…). 'D'estate' is also used as an alternative to 'in estate'."
    },
    trap: "Using 'in' for months: *'In gennaio nevica' — Italian typically uses 'a gennaio' for months, not 'in'.",
    tip: "In estate/autunno/inverno/primavera. A gennaio, a febbraio, a marzo… Two different prepositions — one for seasons, one for months."
  },

  {
    id: 33,
    title: "Per: One Word for Por and Para",
    category: "preposition",
    difficulty: "B2",
    spanish: {
      label: "Por vs Para (distinct)",
      example: "Me fui <em>por</em> tres días. Compré flores <em>para</em> ti. Llamo <em>para</em> hablar.",
      note: "Spanish distinguishes por (duration/cause/exchange) from para (purpose/destination/recipient)."
    },
    italian: {
      label: "Per (covers both)",
      example: "Parto <em>per</em> tre giorni. Ho comprato fiori <em>per</em> te. Chiamo <em>per</em> parlare.",
      note: "Italian <strong>per</strong> collapses both por and para into one preposition. Context carries the meaning difference — purpose, duration into future, recipient, cause."
    },
    trap: "Looking for two Italian words to mirror Spanish por/para — Italian uses per for both. 'Per te' = both 'para ti' and 'por ti' depending on context.",
    tip: "Italian per = Spanish por + para in one. No need to choose. Context always makes the meaning clear."
  },

  // ── GEMINATE (3) ────────────────────────────────────────────────────────

  {
    id: 34,
    title: "Geminate Consonants: Minimal Pairs",
    category: "geminate",
    difficulty: "B1",
    spanish: {
      label: "No Phonemic Gemination",
      example: "pala (shovel), abuelo (grandfather), camino (path)",
      note: "Spanish double consonants (ll, rr) are not true geminates — they represent single sounds. No doubling changes word meaning."
    },
    italian: {
      label: "Geminates Change Meaning",
      example: "pala (shovel) vs <strong>palla</strong> (ball) · nono (ninth) vs <strong>nonno</strong> (grandfather) · camino (chimney) vs <strong>cammino</strong> (path / I walk) · capello (hair) vs <strong>cappello</strong> (hat)",
      note: "In Italian, a doubled consonant is held longer — and it changes the word. This is phonemic: pala ≠ palla in meaning and pronunciation."
    },
    trap: "Pronouncing geminates as single consonants — you may say 'pala' (shovel) when you mean 'palla' (ball), or 'nono' (ninth) instead of 'nonno' (grandfather).",
    tip: "Feel the brief hold before the doubled consonant: PA-la vs PAL-la. Italian ears hear the difference immediately. Practice: nonno / nono / palla / pala out loud."
  },

  {
    id: 35,
    title: "Gemination in Verb Paradigms",
    category: "geminate",
    difficulty: "B2",
    spanish: {
      label: "No Paradigm Gemination",
      example: "saber → sabes, sabe, sabemos. avere → no equivalent irregular forms.",
      note: "Spanish verbs don't introduce double consonants within conjugation paradigms."
    },
    italian: {
      label: "Unexpected Geminates in Irregular Forms",
      example: "sapere → so, sai, sa, <strong>sappiamo</strong>, <strong>sappiate</strong>, sanno · avere → ho, hai, ha, <strong>abbiamo</strong>, avete, hanno · dare → do, dai, dà, <strong>diamo</strong>",
      note: "Several key Italian verbs have geminate consonants in specific forms — especially 1st/2nd plural: <strong>abbiamo</strong>, <strong>abbiate</strong>, <strong>sappiamo</strong>, <strong>stiamo</strong>."
    },
    trap: "Spelling 'abiamo', 'sapiamo', 'stiano' — the geminates are required and affect both spelling and pronunciation.",
    tip: "Learn these whole: abbiamo (avere), sappiamo (sapere), stiamo (stare), diamo (dare). The doubled consonants aren't predictable from the root — memorize the forms."
  },

  {
    id: 36,
    title: "Raddoppiamento Fonosintattico",
    category: "geminate",
    difficulty: "B2",
    spanish: {
      label: "No Equivalent",
      example: "No phonological doubling across word boundaries in Spanish.",
      note: "Spanish has no system of cross-word-boundary consonant gemination."
    },
    italian: {
      label: "Phonetic Doubling After Stressed Monosyllables",
      example: "<em>a</em> + casa → /a <strong>cc</strong>asa/ · <em>è</em> + qui → /è <strong>qq</strong>uì/ · <em>va</em> + bene → /va <strong>bb</strong>ene/ · <em>tre</em> + giorni",
      note: "After monosyllables with a final stressed vowel (a, da, su, è, va, tre, re…), the following word's initial consonant doubles phonetically. Not always in spelling but consistently in pronunciation."
    },
    trap: "This is a pronunciation feature, not usually a spelling rule — but it explains why native Italian speech sounds more consonant-heavy than reading the text aloud would suggest.",
    tip: "Listen for doubling after short words: 'a Roma' sounds like /a rr-oma/. This rhythmic gemination is part of what gives Italian its characteristic musicality — Spanish doesn't have it."
  },

  // ── MODAL (4) ───────────────────────────────────────────────────────────

  {
    id: 37,
    title: "Modal Auxiliaries: Compound Tense Split",
    category: "modal",
    difficulty: "B1",
    spanish: {
      label: "Deber / Poder / Querer + Infinitivo",
      example: "<em>He tenido que</em> ir. <em>He podido</em> hacerlo.",
      note: "Spanish compound modal constructions always use haber — no auxiliary split."
    },
    italian: {
      label: "Dovere / Potere / Volere: Auxiliary Follows Main Verb",
      example: "<em>Sono dovuto</em> andare. (andare → essere) / <em>Ho dovuto</em> mangiare. (mangiare → avere)",
      note: "In Italian, the compound-tense auxiliary for a modal <strong>mirrors the main verb's auxiliary</strong>: essere-verbs use essere, avere-verbs use avere. In speech, avere with all modals is also common but less precise."
    },
    trap: "Assuming modals always take avere: *'ho dovuto andare' is heard in speech but *'ho potuto venire' is more clearly an error — essere is expected with essere-verbs.",
    tip: "Modal auxiliary = the main verb's auxiliary. Dovere + andare (essere-verb) → sono dovuto andare. Dovere + mangiare (avere-verb) → ho dovuto mangiare."
  },

  {
    id: 38,
    title: "Modals in Compound Tenses: Both Forms",
    category: "modal",
    difficulty: "B2",
    spanish: {
      label: "Siempre Haber",
      example: "<em>He querido</em> venir. <em>Ha podido</em> hacerlo.",
      note: "Spanish compound modals always use haber regardless of the main verb."
    },
    italian: {
      label: "Two Grammatical Options",
      example: "<em>Sono voluto</em> venire. (essere, formal) / <em>Ho voluto</em> venire. (avere, spoken)",
      note: "Both forms are used by native speakers. Formal/written Italian prefers the main verb's auxiliary. Spoken Italian frequently uses avere for all modals — a natural simplification."
    },
    trap: "Treating one form as ungrammatical — both are Italian. The distinction is register, not correctness.",
    tip: "Write: 'sono dovuto andare'. Speak: 'ho dovuto andare' is fine. Understanding both prepares you to read and be understood in any context."
  },

  {
    id: 39,
    title: "Riuscire a vs Potere for Ability",
    category: "modal",
    difficulty: "B1",
    spanish: {
      label: "Poder for All Ability",
      example: "<em>Puedo</em> nadar. <em>No pude</em> abrir el frasco.",
      note: "Spanish poder handles both general ability and managing to accomplish a specific task."
    },
    italian: {
      label: "Sapere (skill) vs Riuscire a (manage to) vs Potere (allowed/possible)",
      example: "<em>So</em> nuotare. (know how) / Non <em>riesco ad</em> aprire il barattolo. (can't manage to) / Non <em>posso</em> venire domani. (can't, not allowed/possible)",
      note: "<strong>Sapere</strong> = to know how (skill). <strong>Riuscire a</strong> = to manage to, succeed in (implies effort). <strong>Potere</strong> = to be permitted or physically possible."
    },
    trap: "Using 'potere' where 'riuscire a' is needed: 'Non posso aprire il barattolo' implies impossibility; 'Non riesco ad aprire il barattolo' = I'm trying but can't manage.",
    tip: "Riuscire a = to successfully accomplish (Spanish conseguir + infinitive). Potere = can/may (same as Spanish poder). The two aren't interchangeable when effort is implied."
  },

  {
    id: 40,
    title: "Sapere vs Conoscere",
    category: "modal",
    difficulty: "B1",
    spanish: {
      label: "Saber vs Conocer",
      example: "<em>Sé</em> nadar. <em>Sé</em> que viene. <em>Conozco</em> a María. <em>Conozco</em> Roma.",
      note: "Spanish saber = facts/how-to/clauses; conocer = people/places/familiarity."
    },
    italian: {
      label: "Sapere vs Conoscere (same split, irregular conjugation)",
      example: "<em>So</em> nuotare. <em>So</em> che viene. <em>Conosco</em> Maria. <em>Conosco</em> Roma.",
      note: "The sapere/conoscere split mirrors Spanish saber/conocer almost exactly. Key difference: <strong>sapere</strong> is highly irregular — so, sai, sa, sappiamo, sapete, sanno."
    },
    trap: "Conjugating sapere as a regular verb: *'sapo' doesn't exist — the 1st person singular is 'so'. Also: *'conosco che viene' is wrong; conoscere doesn't take a clause.",
    tip: "Sapere: so, sai, sa, sappiamo, sapete, sanno. The split matches Spanish — sapere for facts/skills, conoscere for people/places. The only new challenge is the irregular conjugation."
  }

];

// ── PATTERN DRILLS (30) ─────────────────────────────────────────────────

const grammarDrills = [

  // Card 1 — Essere/Avere auxiliary
  {
    id: 1,
    grammarCardId: 1,
    sentence: "Ieri mattina Marco ___ al mercato da solo.",
    answer: "è andato",
    distractors: ["ha andato", "andava", "ha ito"],
    explanation: "'Andare' is a motion verb — always essere in compound tenses: 'è andato'. 'Ha andato' is the direct Spanish-influenced error (using haber/avere for all verbs)."
  },
  {
    id: 2,
    grammarCardId: 1,
    sentence: "I miei genitori ___ a Napoli tre anni fa.",
    answer: "sono partiti",
    distractors: ["hanno partito", "partivano", "sono partire"],
    explanation: "'Partire' (to depart) uses essere: 'sono partiti'. Agreement: partiti (m.pl.). 'Hanno partito' is the haber-influenced error."
  },

  // Card 5 — Stare + Gerundio restriction
  {
    id: 3,
    grammarCardId: 5,
    sentence: "Non interrompermi — ___ proprio adesso.",
    answer: "sto lavorando",
    distractors: ["sono lavorando", "lavoro adesso", "stavo lavorando"],
    explanation: "Stare + gerundio expresses action in progress right now. 'Sono lavorando' is not Italian — essere is not used with gerundio. 'Sto lavorando' = I'm working (right now)."
  },
  {
    id: 4,
    grammarCardId: 5,
    sentence: "Luca ___ a Milano da due anni.",
    answer: "vive",
    distractors: ["sta vivendo", "è vivendo", "ha vissuto"],
    explanation: "Italian doesn't use stare + gerundio for extended ongoing states. Use simple present + da: 'vive a Milano da due anni'. 'Sta vivendo' would mean he's in the process of moving in right now."
  },

  // Card 6 — Da + present
  {
    id: 5,
    grammarCardId: 6,
    sentence: "___ questo ristorante da quando avevo vent'anni.",
    answer: "Frequento",
    distractors: ["Ho frequentato", "Frequentavo", "Sto frequentando"],
    explanation: "For an action ongoing from the past to now, Italian uses present tense + da. 'Ho frequentato' (passato prossimo) implies the action is over."
  },

  // Card 11 — Ne
  {
    id: 6,
    grammarCardId: 11,
    sentence: "Hai delle mele? — Sì, ___ ho comprate tre al mercato.",
    answer: "ne",
    distractors: ["le", "ci", "di esse"],
    explanation: "'Ne' is mandatory when answering with a quantity without repeating the noun. Note also the participle agreement: 'comprate' (f.pl. mele). 'Le ho comprate tre' without 'ne' is wrong."
  },
  {
    id: 7,
    grammarCardId: 11,
    sentence: "Non voglio più parlare di questa storia. — Capisco, non ___ parliamo.",
    answer: "ne",
    distractors: ["ci", "lo", "di lei"],
    explanation: "'Ne' replaces 'di + topic'. 'Ne parliamo' = we talk about it (di + cosa). 'Ci parliamo' would mean 'we talk to each other' — different meaning entirely."
  },

  // Card 12 — Ci locative
  {
    id: 8,
    grammarCardId: 12,
    sentence: "Conosci quella libreria in via Dante? — Sì, ___ vado spesso.",
    answer: "ci",
    distractors: ["li", "vi", "là"],
    explanation: "'Ci' replaces a previously mentioned place ('in via Dante'). In Italian, ci is required — you can't just drop the reference. 'Li' is for people (to them), not places."
  },

  // Card 13 — Glielo
  {
    id: 9,
    grammarCardId: 13,
    sentence: "Vuoi che mandi il documento a Luigi? — Sì, ___ manda subito.",
    answer: "glielo",
    distractors: ["se lo", "lo gli", "gli lo"],
    explanation: "'Gli + lo' fuses into 'glielo' (one word). Italian never uses 'se lo' for 3rd person singular indirect objects — that's Spanish. 'Lo gli' and 'gli lo' are not valid Italian sequences."
  },

  // Card 15 — PP agreement with DO clitics
  {
    id: 10,
    grammarCardId: 15,
    sentence: "Le finestre erano aperte? — Sì, ___ ho ___ stamattina.",
    answer: "le / chiuse",
    distractors: ["le / chiuso", "li / chiusi", "le / chiuduto"],
    explanation: "The direct object clitic 'le' (f.pl.) precedes the verb → participle must agree: 'chiuse' (not 'chiuso'). 'Chiuduto' doesn't exist — participio of chiudere is 'chiuso'."
  },

  // Card 17 — C'è vs Ci sono
  {
    id: 11,
    grammarCardId: 17,
    sentence: "In questa città ___ molti musei interessanti.",
    answer: "ci sono",
    distractors: ["c'è", "hay", "c'hanno"],
    explanation: "'Ci sono' (there are) is used with plural nouns. 'C'è' is for singular nouns. 'Hay' is Spanish — it doesn't exist in Italian."
  },

  // Card 19 — Penso che + congiuntivo
  {
    id: 12,
    grammarCardId: 19,
    sentence: "Penso che Marco ___ in ritardo domani.",
    answer: "sia",
    distractors: ["è", "sarà", "sarebbe"],
    explanation: "After 'penso che', Italian always uses congiuntivo: 'sia' (congiuntivo presente di essere). 'È' (indicativo) is a Spanish-influenced error — Italian requires subjunctive here regardless of register."
  },
  {
    id: 13,
    grammarCardId: 19,
    sentence: "Non credo che loro ___ la verità.",
    answer: "dicano",
    distractors: ["dicono", "diceranno", "diranno"],
    explanation: "'Non credo che' triggers congiuntivo: 'dicano' (3rd pl. congiuntivo presente di dire). 'Dicono' is indicativo — never used after 'non credo che' in Italian."
  },

  // Card 21 — Benché + congiuntivo
  {
    id: 14,
    grammarCardId: 21,
    sentence: "Benché ___ stanco, Luca è uscito a correre.",
    answer: "fosse",
    distractors: ["era", "è", "sia"],
    explanation: "'Benché' always requires congiuntivo. The main clause is past → use congiuntivo imperfetto: 'fosse'. 'Era' (imperfetto indicativo) is grammatically impossible after benché."
  },

  // Card 22 — Prima che + congiuntivo
  {
    id: 15,
    grammarCardId: 22,
    sentence: "Chiamami prima che tu ___ di casa.",
    answer: "esca",
    distractors: ["esci", "uscire", "uscirai"],
    explanation: "'Prima che' + different subject → congiuntivo. 'Esca' is 2nd person congiuntivo presente of 'uscire'. 'Esci' is indicativo — wrong after 'prima che'."
  },

  // Card 25 — Reflexive + essere
  {
    id: 16,
    grammarCardId: 25,
    sentence: "Stamattina mi ___ molto tardi.",
    answer: "sono svegliato",
    distractors: ["ho svegliato", "sono svegliata", "ho svegliata"],
    explanation: "Reflexive verbs always use essere: 'mi sono svegliato'. 'Mi ho svegliato' is ungrammatical. (Note: 'mi sono svegliata' would be correct for a female speaker.)"
  },
  {
    id: 17,
    grammarCardId: 25,
    sentence: "Le ragazze ___ presto per non perdere il treno.",
    answer: "si sono alzate",
    distractors: ["si hanno alzate", "si sono alzati", "hanno alzato"],
    explanation: "'Alzarsi' is reflexive → essere auxiliary. And the participle agrees: 'alzate' (f.pl.) because 'le ragazze' is feminine plural. 'Alzati' would be masculine/mixed group."
  },

  // Card 28 — Reciprocal reflexives
  {
    id: 18,
    grammarCardId: 28,
    sentence: "Io e Giulia non ___ da quasi due mesi.",
    answer: "ci siamo visti",
    distractors: ["ci abbiamo visti", "abbiamo visto", "siamo visti"],
    explanation: "Reciprocal 'vedersi' uses essere: 'ci siamo visti'. 'Ci abbiamo visti' mixes the wrong auxiliary. 'Siamo visti' is missing the reflexive ci."
  },

  // Card 29 — A vs In
  {
    id: 19,
    grammarCardId: 29,
    sentence: "Quest'estate vado ___ Sicilia con la mia famiglia.",
    answer: "in",
    distractors: ["a", "nella", "alla"],
    explanation: "Regions and islands use 'in': 'in Sicilia', 'in Toscana', 'in Sardegna'. Cities use 'a' (a Palermo). 'Nella Sicilia' sounds archaic/literary."
  },
  {
    id: 20,
    grammarCardId: 29,
    sentence: "I miei nonni abitano ___ Toscana, vicino a Siena.",
    answer: "in",
    distractors: ["a", "nella", "alla"],
    explanation: "Regions use 'in': 'in Toscana', 'in Lombardia'. The city Siena uses 'a'. So: 'in Toscana, vicino a Siena' — different prepositions for region vs city."
  },

  // Card 30 — Da + duration
  {
    id: 21,
    grammarCardId: 30,
    sentence: "Luigi studia medicina ___ cinque anni.",
    answer: "da",
    distractors: ["per", "desde", "in"],
    explanation: "Present + 'da' + duration = ongoing from past to now. 'Per' would mean 'for (a completed period)': 'ha studiato per cinque anni' = he studied for five years (then stopped). 'Desde' is Spanish."
  },

  // Card 31 — Da + person
  {
    id: 22,
    grammarCardId: 31,
    sentence: "Stasera passo ___ mia sorella prima di andare al cinema.",
    answer: "da",
    distractors: ["a casa di", "a", "in casa di"],
    explanation: "'Passare da + person' = to stop by their place. 'Passo da mia sorella' = I'll stop by my sister's. 'A casa di mia sorella' also works but is wordier — 'da' alone is the natural choice."
  },

  // Card 34 — Geminate minimal pairs
  {
    id: 23,
    grammarCardId: 34,
    sentence: "Ho perso il mio ___ preferito. (hat)",
    answer: "cappello",
    distractors: ["capello", "capelo", "capello"],
    explanation: "'Cappello' (hat) has a geminate pp. 'Capello' (no doubling) means a single strand of hair. One consonant difference = completely different meaning — geminates matter in Italian."
  },

  // Card 37 — Modal auxiliary split
  {
    id: 24,
    grammarCardId: 37,
    sentence: "Non ___ andare alla festa ieri sera.",
    answer: "sono potuto",
    distractors: ["ho potuto", "potevo", "sono potuta"],
    explanation: "'Potere' with an essere-verb ('andare') → compound takes essere: 'sono potuto/a andare'. (Note: 'sono potuta' for female speaker.) 'Ho potuto andare' is common in speech but essere is the precise form."
  },

  // Card 39 — Riuscire a vs Potere
  {
    id: 25,
    grammarCardId: 39,
    sentence: "Ho provato per ore ma non ___ aprire il barattolo.",
    answer: "riuscivo ad",
    distractors: ["potevo", "sapevo", "sono riuscito a"],
    explanation: "'Riuscire a' expresses trying but not managing. 'Non riuscivo ad aprire' = I couldn't manage to open it (despite effort). 'Non potevo' would imply impossibility or lack of permission — different nuance."
  },

  // Card 40 — Sapere vs Conoscere
  {
    id: 26,
    grammarCardId: 40,
    sentence: "___ dove abita Marta?",
    answer: "Sai",
    distractors: ["Conosci", "Conosco", "Sa"],
    explanation: "'Sapere' is used for knowing facts and clauses: 'sapere dove' = to know where. 'Conosci' would work for knowing a person, but not for knowing a fact or indirect question."
  },
  {
    id: 27,
    grammarCardId: 40,
    sentence: "___ bene Roma — ci sono cresciuta.",
    answer: "Conosco",
    distractors: ["So", "Sapevo", "Riconosco"],
    explanation: "'Conoscere' expresses familiarity with places and people: 'Conosco Roma' = I know Rome well. 'So Roma' would mean 'I know of Rome' as a fact — unnatural. 'Conosco' = familiarity from experience."
  },

  // Card 12 — Ci with pensare
  {
    id: 28,
    grammarCardId: 12,
    sentence: "Questo problema è difficile. Non ___ avevo mai pensato prima.",
    answer: "ci",
    distractors: ["ne", "lo", "a esso"],
    explanation: "'Pensare a qualcosa' → 'pensarci': ci replaces 'a + thing'. 'Ne' would replace 'di + something'. 'Lo' is for direct objects. 'Ci penso' = I'm thinking about it."
  },

  // Card 2 — Imperfetto polite
  {
    id: 29,
    grammarCardId: 2,
    sentence: "___ un cornetto e un caffè, per favore.",
    answer: "Volevo",
    distractors: ["Voglio", "Vorrò", "Vorevo"],
    explanation: "Both 'volevo' (imperfetto) and 'vorrei' (condizionale) work as polite requests. 'Voglio' (present) sounds blunt. 'Vorrò' is future. 'Volevo' uses the distinctly Italian imperfetto-as-softener in shops and cafés."
  },

  // Card 3 — PP vs Imperfetto
  {
    id: 30,
    grammarCardId: 3,
    sentence: "Mentre ___ la cena, ha squillato il telefono.",
    answer: "preparavo",
    distractors: ["ho preparato", "preparai", "stavo preparando"],
    explanation: "The ongoing background action uses imperfetto: 'preparavo'. The interrupting completed action uses passato prossimo: 'ha squillato'. 'Ho preparato' for the background would make the two actions sound sequential rather than simultaneous."
  }

];
