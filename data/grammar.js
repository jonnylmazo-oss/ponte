// data/grammar.js — Grammar cards and pattern drills for Ponte
// 4-stage learning path for Spanish speakers learning Italian

const grammarCards = [

  // ── TENSE (10) ──────────────────────────────────────────────────────────

  {
    id: 1,
    title: "Passato Prossimo: Essere vs Avere",
    category: "tense",
    difficulty: "B1",
    stageId: 1,
    english: "I went / I have gone (English uses 'have' for all verbs)",
    italian: "sono andato (motion) / ho mangiato (action)",
    example: "Ieri sono andato al mercato. Ho mangiato la pizza.",
    exampleEN: "Yesterday I went to the market. I ate the pizza.",
    trap: "Writing 'ho andato', 'ho venuto', 'ho partito' — these motion verbs always need essere.",
    spanishShortcut: "Spanish always uses haber: 'he ido', 'he comido'. Italian splits: essere for motion/state-change, avere for most transitive verbs.",
    tip: "Core essere verbs: andare, venire, partire, arrivare, tornare, entrare, uscire, nascere, morire, restare, scendere, salire, cadere, diventare, sembrare. All reflexives also use essere."
  },

  {
    id: 2,
    title: "Imperfetto: Polite Requests",
    category: "tense",
    difficulty: "B1",
    stageId: 2,
    english: "I would like a coffee (conditional) / I wanted a coffee (past)",
    italian: "Volevo un caffè. / Volevo chiederti una cosa.",
    example: "Da bambino giocavo al parco. Volevo un cornetto, per favore.",
    exampleEN: "As a child I used to play in the park. I'd like a croissant, please.",
    trap: "Missing the shop/restaurant imperfetto: 'Volevo un cornetto' sounds natural in Italian; beginners often reach for 'vorrei' or blunt 'voglio'.",
    spanishShortcut: "Spanish uses quería in the same softening way: 'quería pedirte algo'. Italian does this even more pervasively in everyday commerce.",
    tip: "In a café, 'Volevo un caffè macchiato' is perfectly natural Italian — the imperfetto softens the request the way English 'I was hoping for...' does."
  },

  {
    id: 3,
    title: "Passato Prossimo vs Imperfetto",
    category: "tense",
    difficulty: "B1",
    stageId: 1,
    english: "I was sleeping when the phone rang (background vs foreground)",
    italian: "Dormivo (background) quando ha suonato il telefono (completed event).",
    example: "Dormivo quando ha suonato il telefono.",
    exampleEN: "I was sleeping when the phone rang.",
    trap: "Using passato remoto for the completed action in everyday speech. 'Dormivo quando suonò il telefono' sounds literary or southern-regional.",
    spanishShortcut: "Spanish: dormía cuando sonó. Italian: dormivo quando ha suonato. Same logic — but completed event uses passato prossimo (not passato remoto) in everyday northern/central Italian.",
    tip: "In everyday Italian (especially north of Rome): passato prossimo does all the work of Spanish pretérito indefinido for recent/personal events."
  },

  {
    id: 4,
    title: "Futuro: Epistemic Probability",
    category: "tense",
    difficulty: "B1",
    stageId: 4,
    english: "Who could that be? He must be about forty. (guessing, not predicting)",
    italian: "Chi sarà quell'uomo? Avrà una quarantina d'anni.",
    example: "Chi sarà quell'uomo? Avrà una quarantina d'anni.",
    exampleEN: "Who could that man be? He must be around forty.",
    trap: "Using present indicativo for probability when futuro is needed: 'Chi è?' asks who someone is; 'chi sarà?' expresses the uncertainty of not knowing.",
    spanishShortcut: "Identical to Spanish futuro epistémico: '¿quién será?' / 'tendrá cuarenta años'. Both languages use future tense to express present-tense conjecture.",
    tip: "Italian futuro epistemic use = Spanish futuro epistémico. Both languages say 'avrà/tendrá trent'anni' to mean 'must be about thirty'. Identical usage."
  },

  {
    id: 5,
    title: "Stare + Gerundio: Restricted Use",
    category: "tense",
    difficulty: "B1",
    stageId: 1,
    english: "I've been living in Rome for a year (extended ongoing state)",
    italian: "Vivo a Roma da un anno. (NOT: sto vivendo) / Stavo lavorando quando hai chiamato.",
    example: "Vivo a Roma da un anno. Non interrompermi — sto lavorando proprio adesso.",
    exampleEN: "I've been living in Rome for a year. Don't interrupt me — I'm working right now.",
    trap: "Saying 'Sto vivendo a Roma da un anno' — Italian uses simple present instead: 'Vivo a Roma da un anno'.",
    spanishShortcut: "Spanish 'estoy viviendo en Roma desde hace un año' is fine. Italian stare + gerundio is snapshot-only; extended states need simple present + da.",
    tip: "Stare + gerundio = snapshot at this moment. For extended ongoing states, Italian reaches for simple tenses, not the progressive."
  },

  {
    id: 6,
    title: "Da + Present for Ongoing Duration",
    category: "tense",
    difficulty: "B1",
    stageId: 1,
    english: "I have been studying Italian for three years (ongoing to now)",
    italian: "Studio italiano da tre anni.",
    example: "Studio italiano da tre anni. Vivevo lì da due anni quando ho trovato lavoro.",
    exampleEN: "I have been studying Italian for three years. I had been living there for two years when I found work.",
    trap: "Translating Spanish word-for-word: 'fa tre anni che studio' is not standard. Also: 'ho studiato da tre anni' is wrong — passato prossimo implies the action is complete.",
    spanishShortcut: "Spanish: 'hace tres años que estudio' or 'llevo tres años estudiando'. Italian collapses this into: present tense + da. Much simpler.",
    tip: "Present + da = still ongoing. Imperfetto + da = was ongoing (before something else happened). 'Studiavo da un'ora quando ha chiamato' = I'd been studying for an hour when he called."
  },

  {
    id: 7,
    title: "Passato Remoto: Regional Register",
    category: "tense",
    difficulty: "B2",
    stageId: 2,
    english: "Yesterday I ate here (recent past — same word in English)",
    italian: "Colombo arrivò in America nel 1492. / Ieri ho mangiato qui. (north)",
    example: "Colombo arrivò in America nel 1492. Ieri ho mangiato qui.",
    exampleEN: "Columbus arrived in America in 1492. Yesterday I ate here.",
    trap: "Using passato remoto for recent events in a northern context — it sounds literary, formal, or regionally southern.",
    spanishShortcut: "Spanish pretérito indefinido covers all past events. Italian passato remoto = historical/literary past. Passato prossimo = recent/personal past in the north.",
    tip: "Safe rule: passato prossimo for anything with a present-day connection. Passato remoto for historical events and formal/literary writing."
  },

  {
    id: 8,
    title: "Gerundio Cannot Modify Nouns",
    category: "tense",
    difficulty: "B2",
    stageId: 4,
    english: "I saw a man running / the woman crying in the street",
    italian: "Ho visto un uomo che correva. (NOT: *un uomo correndo)",
    example: "Ho visto un uomo che correva lungo il fiume.",
    exampleEN: "I saw a man running along the river.",
    trap: "Saying 'Ho visto un uomo correndo' — this sounds Spanish-influenced and is not Italian. Use 'un uomo che correva' or 'un uomo mentre correva'.",
    spanishShortcut: "Spanish gerundio can describe a noun: 'vi a un hombre corriendo'. Italian gerundio can only modify the clause's own subject — to describe another noun, use 'che' + verb.",
    tip: "Italian gerundio = Spanish gerundio but only when the subjects match: 'Ho mangiato guardando la TV' (I ate while watching). Can't describe someone else's action — that needs 'che'."
  },

  {
    id: 9,
    title: "Trapassato Prossimo: Essere/Avere Split",
    category: "tense",
    difficulty: "B2",
    stageId: 3,
    english: "When I arrived, he had already left (past perfect)",
    italian: "Quando sono arrivato, aveva già mangiato. / Era già andato via.",
    example: "Quando sono arrivato, aveva già mangiato. Era già andato via.",
    exampleEN: "When I arrived, he had already eaten. He had already left.",
    trap: "Using avere for essere-verbs: 'aveva andato' must be 'era andato'. The split never takes a day off.",
    spanishShortcut: "Spanish pluscuamperfecto always uses haber: 'había comido', 'se había ido'. Italian splits: era andato (essere-verb), aveva mangiato (avere-verb). Same split as passato prossimo.",
    tip: "If a verb uses essere in passato prossimo, it uses essere in trapassato, condizionale passato, and congiuntivo passato too. The rule is consistent across all compound tenses."
  },

  {
    id: 10,
    title: "Condizionale Passato in Hypotheticals",
    category: "tense",
    difficulty: "B2",
    stageId: 4,
    english: "If I had known, I would have come",
    italian: "Se avessi saputo, sarei venuto. (NOT: *avrei venuto)",
    example: "Se avessi saputo, sarei venuto alla festa.",
    exampleEN: "If I had known, I would have come to the party.",
    trap: "Using avere for essere-verbs: 'avrei andato' must be 'sarei andato'. 'avrei venuto' must be 'sarei venuto'.",
    spanishShortcut: "Spanish: 'si hubiera sabido, habría venido'. Italian: 'se avessi saputo, sarei venuto'. Essere-verbs use sarei/saresti/sarebbe in the conditional perfect — haber always uses haber in Spanish.",
    tip: "Condizionale passato of essere-verbs: sarei, saresti, sarebbe, saremmo, sareste, sarebbero + participle (with agreement). Same essere rule, every tense."
  },

  // ── PRONOUN (8) ─────────────────────────────────────────────────────────

  {
    id: 11,
    title: "Ne: The Partitive Pronoun",
    category: "pronoun",
    difficulty: "B1",
    stageId: 3,
    english: "How many apples do you have? — I have three. (English drops 'of them')",
    italian: "Quante mele hai? — Ne ho tre. / Parliamo di politica → Ne parliamo.",
    example: "Quante mele hai? — Ne ho tre. Ne parliamo dopo.",
    exampleEN: "How many apples do you have? — I have three (of them). We'll talk about it later.",
    trap: "Omitting ne with quantities: 'Ho tre' is wrong — you must say 'Ne ho tre'. Also: when the participle follows ne, it agrees: 'ne ho mangiate tre' (mele, f.pl.).",
    spanishShortcut: "Spanish drops the pronoun entirely: '¿cuántas tienes? — tengo tres.' Italian requires 'ne' to stand in for 'di + noun'. There is no Spanish equivalent — learn it as an Italian-only pattern.",
    tip: "Whenever you answer a 'how many?' question without repeating the noun, ne is required. Think of ne as 'of it/of them' — Italian always expresses it; Spanish drops it."
  },

  {
    id: 12,
    title: "Ci: The Locative Pronoun",
    category: "pronoun",
    difficulty: "B1",
    stageId: 3,
    english: "Do you go to the market? — Yes, I go there. (English drops or keeps 'there')",
    italian: "Vai al mercato? — Sì, ci vado. / Ci penso spesso. / Ci vuole pazienza.",
    example: "Vai al mercato? — Sì, ci vado ogni giorno. Ci vuole pazienza con lui.",
    exampleEN: "Do you go to the market? — Yes, I go there every day. You need patience with him.",
    trap: "Dropping ci when referencing a previously mentioned place: after 'al bar?' the response 'Vado ogni giorno' is incomplete — 'Ci vado ogni giorno' is required.",
    spanishShortcut: "Spanish drops the location pronoun. Italian requires ci to replace 'a/in + place'. Also: c'è/ci sono (hay), ci vuole (hace falta) — these have no Spanish clitic equivalent.",
    tip: "Ci stacks with ne: 'ci vuole' (it takes), 'farcela' (fare + ci + la = to manage it). These two clitics do enormous work in Italian with no Spanish parallel."
  },

  {
    id: 13,
    title: "Double Pronouns: Glielo vs Se lo",
    category: "pronoun",
    difficulty: "B2",
    stageId: 3,
    english: "Are you giving the book to him? — I'm giving it to him.",
    italian: "Gli dai il libro? — Glielo do. (one fused word)",
    example: "Vuoi che mandi il documento a Luigi? — Glielo mando subito.",
    exampleEN: "Do you want me to send the document to Luigi? — I'll send it to him right away.",
    trap: "Writing 'se lo do' or 'lo gli do' instead of 'glielo do' — glielo is always one fused word in Italian.",
    spanishShortcut: "Spanish: 'se lo doy' (le/les → se before lo/la). Italian: 'glielo do' (gli + lo fuses into glielo). Italian never uses se in this position — glielo, gliela, glieli, gliele.",
    tip: "Glielo, gliela, glieli, gliele — all one word, never separated. One form serves him, her, and them (unlike Spanish le/les → se before lo/la)."
  },

  {
    id: 14,
    title: "Clitic Climbing with Modals",
    category: "pronoun",
    difficulty: "B2",
    stageId: 3,
    english: "I want to see it / I want to see him (clitic can move to modal)",
    italian: "Voglio vederlo. / Lo voglio vedere. (both OK) / Farcela = fare + ci + la.",
    example: "Lo voglio vedere. Voglio vederlo. Non ce la faccio più.",
    exampleEN: "I want to see it. I want to see it. I can't take it anymore.",
    trap: "Treating farcela / andarsene as separable the way simple clitics are: 'ce la faccio' works but 'la faccio ce' doesn't — learn these as fixed idioms.",
    spanishShortcut: "Same clitic freedom as Spanish: 'quiero verlo' or 'lo quiero ver'. Bonus: Italian has lexicalized multi-clitic idioms — farcela, cavarsela, andarsene — with no direct Spanish equivalents.",
    tip: "Same clitic freedom as Spanish for simple cases. Bonus: Italian has lexicalized multi-clitic idioms (farcela, cavarsela, andarsene) that must be learned whole."
  },

  {
    id: 15,
    title: "Past Participle Agrees with Direct Object Clitic",
    category: "pronoun",
    difficulty: "B2",
    stageId: 3,
    english: "The candles — I turned them off. (English: no agreement)",
    italian: "Le candele — le hai spente. (participle agrees: spente, not spento)",
    example: "Le finestre? Le ho chiuse stamattina. Il film? L'ho visto ieri.",
    exampleEN: "The windows? I closed them this morning. The film? I saw it yesterday.",
    trap: "Saying 'le ho spento' instead of 'le ho spente' — when 'le' (them, f.pl.) precedes the verb, the participle needs the -e plural ending.",
    spanishShortcut: "Modern Spanish has no participle agreement: 'las he apagado'. Italian requires it: 'le ho spente'. The clitic gender/number triggers the participle ending.",
    tip: "Direct object clitic before the verb → participle agrees. No preceding clitic → no required agreement. Le candele? Le ho spente."
  },

  {
    id: 16,
    title: "Gli: One Pronoun for Him, Her, Them",
    category: "pronoun",
    difficulty: "B2",
    stageId: 2,
    english: "I give the book to him / to her / to them (three distinct ideas)",
    italian: "Gli do il libro. (serves him, her, and them in everyday speech)",
    example: "Gli do il libro. Puoi dirgli che arrivo tra poco?",
    exampleEN: "I give him/her/them the book. Can you tell him/her/them I'll be there soon?",
    trap: "Assuming 'le' always means 'to her' in Italian — in everyday speech, gli replaces le and loro. Context and verb agreement disambiguate.",
    spanishShortcut: "Spanish distinguishes: 'le doy' (singular) vs 'les doy' (plural). Italian spoken norm: 'gli' covers all three. Only formal writing uses gli/le/loro separately.",
    tip: "In conversation, gli does it all. In formal writing: gli (him), le (her), loro/gli (them). Don't overthink it in speech."
  },

  {
    id: 17,
    title: "C'è / Ci Sono vs Hay",
    category: "pronoun",
    difficulty: "B1",
    stageId: 1,
    english: "There is / there are (English distinguishes; Spanish hay doesn't)",
    italian: "C'è un problema. / Ci sono tre problemi.",
    example: "C'è un problema. Ci sono tre persone fuori.",
    exampleEN: "There is a problem. There are three people outside.",
    trap: "Using c'è with a plural noun: 'C'è tre persone' — must be 'ci sono tre persone'.",
    spanishShortcut: "Spanish 'hay' is invariable: 'hay un problema', 'hay tres problemas'. Italian splits into c'è (singular) and ci sono (plural). The verb essere shows through.",
    tip: "C'è = hay (singular). Ci sono = hay (plural). Unlike Spanish hay, Italian c'è/ci sono agree in number."
  },

  {
    id: 18,
    title: "Subject Pronoun Drop",
    category: "pronoun",
    difficulty: "B1",
    stageId: 2,
    english: "He says she is coming (multiple subjects — English needs pronouns)",
    italian: "Lui dice che lei viene. (pronouns kept to signal subject switch)",
    example: "Io vado al mercato. Lui dice che lei viene dopo.",
    exampleEN: "I'm going to the market. He says she's coming later.",
    trap: "Leaving out lui/lei when the subject switches mid-sentence — Italian listeners rely on the pronoun more than Spanish listeners do to track who is doing what.",
    spanishShortcut: "Both languages drop subject pronouns. But Italian verb endings (especially 3rd person) are less distinctive, so lui/lei is used more often to signal switches than in Spanish.",
    tip: "When the subject changes, Italian often keeps lui/lei to signal the shift clearly. Spanish can rely on verb endings alone more readily."
  },

  // ── SUBJUNCTIVE (6) ─────────────────────────────────────────────────────

  {
    id: 19,
    title: "Penso Che + Congiuntivo (Always)",
    category: "subjunctive",
    difficulty: "B1",
    stageId: 3,
    english: "I think he's coming tomorrow (English: no subjunctive triggered)",
    italian: "Penso che venga domani. / Credo che sia a casa.",
    example: "Penso che venga domani. Credo che sia ancora a casa.",
    exampleEN: "I think he's coming tomorrow. I believe he's still at home.",
    trap: "Using indicativo after 'penso che', 'credo che', 'suppongo che': 'Penso che viene' is wrong Italian, even in casual speech.",
    spanishShortcut: "Spanish spoken norm allows indicativo: 'creo que viene'. Italian requires congiuntivo in all registers — no shortcut exists for penso/credo/suppongo + che.",
    tip: "Italian pensare/credere/supporre/ritenere + che → always congiuntivo. There is no spoken shortcut like in Spanish."
  },

  {
    id: 20,
    title: "Impersonal Expressions + Congiuntivo",
    category: "subjunctive",
    difficulty: "B1",
    stageId: 3,
    english: "It's important that you arrive on time (English uses base verb form)",
    italian: "È importante che tu arrivi in orario. / Bisogna che tu venga.",
    example: "È importante che arrivi in orario. Bisogna che tutti parlino.",
    exampleEN: "It's important that you arrive on time. It's necessary that everyone speak.",
    trap: "Using indicativo: 'È importante che arriva' — congiuntivo is required. Some forms look identical (arrivi = 2nd sing. indicativo AND congiuntivo) — context resolves.",
    spanishShortcut: "Mirrors Spanish: 'es importante que llegues'. Italian bisogna che/occorre che + congiuntivo = Spanish hay que + infinitivo, but with a different structure (personal subject possible).",
    tip: "Bisogna che / Occorre che + congiuntivo = Italian-only structures. Spanish uses 'hay que + infinitive' instead, so these are new territory."
  },

  {
    id: 21,
    title: "Benché / Sebbene + Congiuntivo",
    category: "subjunctive",
    difficulty: "B2",
    stageId: 4,
    english: "Although it's cold, I'm going out (even known facts need subjunctive in Italian)",
    italian: "Benché faccia freddo, esco. / Sebbene sia stanco, continua.",
    example: "Benché faccia freddo, esco a correre ogni mattina.",
    exampleEN: "Although it's cold, I go running every morning.",
    trap: "Using indicativo after benché/sebbene: 'Benché fa freddo' is ungrammatical. For known facts without subjunctive, use 'anche se' + indicativo.",
    spanishShortcut: "Spanish 'aunque' takes indicativo for known facts: 'aunque hace frío, salgo'. Italian benché/sebbene always require congiuntivo. Want indicativo? Use 'anche se' instead.",
    tip: "Benché/sebbene = automatic congiuntivo. Want indicativo? Switch to 'anche se': 'Anche se fa freddo, esco' (known fact, no subjunctive needed)."
  },

  {
    id: 22,
    title: "Prima Che + Congiuntivo",
    category: "subjunctive",
    difficulty: "B2",
    stageId: 3,
    english: "Call me before you leave (different subjects → subjunctive)",
    italian: "Chiamami prima che tu parta. / Prima di partire, chiamami. (same subject → infinitive)",
    example: "Chiamami prima che tu parta. Prima di partire, controlla il gas.",
    exampleEN: "Call me before you leave. Before leaving, check the gas.",
    trap: "Using prima che with the same subject: 'Prima che io parta, chiamami' — when subjects are the same, Italian uses prima di + infinitive: 'Prima di partire, chiamami'.",
    spanishShortcut: "Identical to Spanish: 'antes de que salgas' (different subjects) vs 'antes de salir' (same subject). Same split, same logic — just prima che / prima di instead.",
    tip: "Two subjects → prima che + congiuntivo. Same subject → prima di + infinitive. Identical rule to Spanish antes de que / antes de."
  },

  {
    id: 23,
    title: "Congiuntivo in Independent Wishes",
    category: "subjunctive",
    difficulty: "B2",
    stageId: 4,
    english: "If only he would come! / I wish he'd come! (English uses 'wish' + past)",
    italian: "Magari venisse! (wish) / Magari viene. (maybe)",
    example: "Magari venisse alla festa! Che tu possa farcela!",
    exampleEN: "If only he'd come to the party! May you manage!",
    trap: "Using 'magari' without congiuntivo for a wish: 'Magari viene' = maybe he'll come (possibility); 'Magari venisse!' = if only he'd come! (wish). Wrong mood, wrong meaning.",
    spanishShortcut: "Spanish: '¡ojalá viniera!' or '¡que te vaya bien!'. Italian: 'magari venisse!' or 'che tu possa farcela!'. Magari has no direct Spanish equivalent — it changes meaning with the mood.",
    tip: "Magari + congiuntivo imperfetto = strong wish (if only). Magari + indicativo = maybe. Context and mood together carry the full meaning."
  },

  {
    id: 24,
    title: "Congiuntivo Passato Formation",
    category: "subjunctive",
    difficulty: "B2",
    stageId: 3,
    english: "I hope he came / I think he has eaten (past in a subjunctive clause)",
    italian: "Spero che sia venuto. / Penso che abbia mangiato.",
    example: "Spero che sia venuto prima della chiusura. Penso che abbia già mangiato.",
    exampleEN: "I hope he came before closing. I think he has already eaten.",
    trap: "Using avere for essere-verbs: 'Penso che abbia andato' — must be 'Penso che sia andato'.",
    spanishShortcut: "Spanish: 'espero que haya venido' (always haber). Italian: 'spero che sia venuto' (essere-verbs use sia, not abbia). The essere/avere split applies to all compound tenses.",
    tip: "Congiuntivo passato = congiuntivo of essere or avere + participio. Essere-verbs: 'sia andato/a'; avere-verbs: 'abbia mangiato'. The split is relentless."
  },

  // ── REFLEXIVE (4) ───────────────────────────────────────────────────────

  {
    id: 25,
    title: "Reflexive Verbs Use Essere",
    category: "reflexive",
    difficulty: "B1",
    stageId: 1,
    english: "I got up late / They showered (reflexive in compound tense)",
    italian: "Mi sono alzato tardi. / Si sono fatti la doccia.",
    example: "Mi sono alzato tardi. Mi sono fatto la doccia in fretta.",
    exampleEN: "I got up late. I showered quickly.",
    trap: "Using avere for reflexives: 'mi ho alzato' must be 'mi sono alzato'. Also: forgetting agreement — a female speaker says 'mi sono alzata', not 'alzato'.",
    spanishShortcut: "Spanish reflexives always use haber: 'me he levantado'. Italian reflexives always use essere: 'mi sono alzato/a'. And the participle agrees with the subject.",
    tip: "Reflexive + essere → participle agrees. Mi sono lavato (m.), mi sono lavata (f.), ci siamo lavati (m./mixed group), ci siamo lavate (f. group)."
  },

  {
    id: 26,
    title: "Reflexive Meaning Changes",
    category: "reflexive",
    difficulty: "B1",
    stageId: 2,
    english: "to feel vs to hear / to find (something) vs to be located",
    italian: "Sentire un rumore (to hear) vs sentirsi bene (to feel). Trovare la chiave vs trovarsi a Milano.",
    example: "Non mi sento bene oggi. Mi sono trovato in una situazione difficile.",
    exampleEN: "I don't feel well today. I found myself in a difficult situation.",
    trap: "Missing Italian-specific reflexive constructions: 'Non me ne sono accorto' (I didn't notice it) uses both 'ne' and the reflexive — a structure without a clean Spanish parallel.",
    spanishShortcut: "Spanish has the same reflexive shift: 'ir' vs 'irse', 'llamar' vs 'llamarse'. Italian adds important idioms: rendersi conto (darse cuenta), accorgersi (notar), farcela (conseguirlo).",
    tip: "Key Italian reflexive idioms: rendersi conto di (darse cuenta de), accorgersi di (darse cuenta de / notar), farcela (poder con algo / conseguirlo)."
  },

  {
    id: 27,
    title: "Modal + Reflexive: Compound Tense Auxiliary",
    category: "reflexive",
    difficulty: "B2",
    stageId: 3,
    english: "I had to wash up (reflexive + modal in compound tense — which auxiliary?)",
    italian: "Mi sono dovuto lavare. (clitic climbs → essere) / Ho dovuto lavarmi. (clitic on inf → avere)",
    example: "Mi sono dovuto alzare presto. Ho dovuto alzarmi presto. (both grammatical)",
    exampleEN: "I had to get up early. (two grammatically valid forms)",
    trap: "Using avere when the clitic has climbed: 'mi ho dovuto lavare' is wrong — must be 'mi sono dovuto lavare'.",
    spanishShortcut: "Spanish always uses haber regardless of clitic position: 'me he tenido que lavar' or 'he tenido que lavarme'. Italian auxiliary follows the clitic: clitic before modal → essere; clitic on infinitive → avere.",
    tip: "Reflexive clitic before modal → essere. Reflexive clitic on infinitive → avere. Heard both ways in speech — but the mixed form ('mi ho...') is always wrong."
  },

  {
    id: 28,
    title: "Reciprocal Reflexives in Compound Tenses",
    category: "reflexive",
    difficulty: "B1",
    stageId: 3,
    english: "We saw each other / They love each other (reciprocal meaning)",
    italian: "Ci siamo visti ieri. / Si amano molto.",
    example: "Ci siamo visti ieri al mercato. Non ci sentiamo da mesi.",
    exampleEN: "We saw each other yesterday at the market. We haven't been in touch for months.",
    trap: "Using avere in compound reciprocals: 'ci abbiamo visti' is wrong — must be 'ci siamo visti'. Participle: visti (m./mixed), viste (f.).",
    spanishShortcut: "Spanish: 'nos hemos visto' (haber). Italian: 'ci siamo visti' (essere). Same reciprocal meaning — different auxiliary. Participle must also agree: visti/viste.",
    tip: "Reciprocal compound tense: ci siamo / si sono + participle (agreed). 'Ci siamo visti' = 'nos hemos visto' — but essere, not haber."
  },

  // ── PREPOSITION (5) ─────────────────────────────────────────────────────

  {
    id: 29,
    title: "A vs In: Cities, Countries, Regions",
    category: "preposition",
    difficulty: "B1",
    stageId: 2,
    english: "I'm going to Rome / to Italy / to Tuscany (all 'to' in English)",
    italian: "Vado a Roma. / Vado in Italia. / Vado in Toscana.",
    example: "Vado a Roma. Vado in Italia. Abito in Toscana, vicino a Siena.",
    exampleEN: "I'm going to Rome. I'm going to Italy. I live in Tuscany, near Siena.",
    trap: "Using 'a' for countries: 'Vado a Italia' is wrong — must be 'vado in Italia'.",
    spanishShortcut: "Spanish uses 'a' for all destinations: 'voy a Roma, voy a Italia, voy a Toscana'. Italian uses a + city, in + country/region. The preposition changes at the city limits.",
    tip: "A + city. In + country or region. The preposition changes at the city limits. Vado a Napoli but vado in Campania."
  },

  {
    id: 30,
    title: "Da for Ongoing Duration",
    category: "preposition",
    difficulty: "B1",
    stageId: 1,
    english: "I have been living here for two years (ongoing from past to now)",
    italian: "Vivo qui da due anni. / Studio italiano da tre anni.",
    example: "Vivo qui da due anni. Vivevo lì da un anno quando ho trovato lavoro.",
    exampleEN: "I have been living here for two years. I had been living there for a year when I found work.",
    trap: "Translating Spanish structure: 'fa due anni che vivo qui' — not standard. Simply: 'vivo qui da due anni'. Also: 'ho vissuto qui da' is wrong — that would be passato prossimo (completed).",
    spanishShortcut: "Spanish: 'hace dos años que vivo aquí' or 'llevo dos años viviendo aquí'. Italian: just 'vivo qui da due anni'. One preposition, no special construction.",
    tip: "Present + da = ongoing to now. Imperfetto + da = was ongoing when interrupted. Once you drop 'hace...que', this is the most natural Italian structure."
  },

  {
    id: 31,
    title: "Da: Going to Someone's Place",
    category: "preposition",
    difficulty: "B1",
    stageId: 2,
    english: "I'm going to Marco's (place) / I'm at the doctor's",
    italian: "Vado da Marco. / Sono dal medico. / Passo dalla nonna.",
    example: "Vado da Marco stasera. Domani sono dal dentista.",
    exampleEN: "I'm going to Marco's tonight. Tomorrow I'm at the dentist's.",
    trap: "Adding 'casa' unnecessarily: 'vado a casa di Marco' works but sounds more explicit than the natural 'vado da Marco'.",
    spanishShortcut: "Spanish uses 'voy a casa de Marco' or 'estoy en casa de Ana' — casa must be stated. Italian da + person does it all: 'da Marco' = 'a casa de Marco'. Elegant shorthand.",
    tip: "Da + person = to/at their place. Vado dal medico, vado dalla nonna, vado da Giulia. Clean and idiomatic — no 'casa' required."
  },

  {
    id: 32,
    title: "In vs A: Seasons and Months",
    category: "preposition",
    difficulty: "B1",
    stageId: 2,
    english: "In summer / in January (English 'in' for both)",
    italian: "In estate. / In inverno. / A gennaio. / A marzo.",
    example: "In estate fa caldo. In inverno nevica. A gennaio fa molto freddo.",
    exampleEN: "In summer it's hot. In winter it snows. In January it's very cold.",
    trap: "Using 'in' for months: 'In gennaio nevica' — Italian typically uses 'a gennaio' for months, not 'in'.",
    spanishShortcut: "Spanish 'en' covers both: 'en verano', 'en enero'. Italian splits: in + season (in estate, in inverno), a + month (a gennaio, a marzo). D'estate is an alternative for in estate.",
    tip: "In estate/autunno/inverno/primavera. A gennaio, a febbraio, a marzo… Two different prepositions — one for seasons, one for months."
  },

  {
    id: 33,
    title: "Per: One Word for Por and Para",
    category: "preposition",
    difficulty: "B2",
    stageId: 2,
    english: "I left for three days / I bought flowers for you / I called to talk (por vs para in Spanish)",
    italian: "Parto per tre giorni. / Ho comprato fiori per te. / Chiamo per parlare.",
    example: "Parto per tre giorni. Ho comprato questi fiori per te. Chiamo per parlare.",
    exampleEN: "I'm leaving for three days. I bought these flowers for you. I'm calling to talk.",
    trap: "Looking for two Italian words to mirror Spanish por/para — Italian uses per for both. 'Per te' = both 'para ti' and 'por ti' depending on context.",
    spanishShortcut: "Spanish distinguishes por (duration/cause/exchange) from para (purpose/destination/recipient). Italian collapses both into per. Context carries the meaning — no choice required.",
    tip: "Italian per = Spanish por + para in one. No need to choose. Context always makes the meaning clear."
  },

  // ── GEMINATE (3) ────────────────────────────────────────────────────────

  {
    id: 34,
    title: "Geminate Consonants: Minimal Pairs",
    category: "geminate",
    difficulty: "B1",
    stageId: 4,
    english: "pala vs palla / nono vs nonno (no distinction like this in English or Spanish)",
    italian: "pala (shovel) vs palla (ball) · nono (ninth) vs nonno (grandfather) · camino vs cammino · capello vs cappello",
    example: "Ho perso il mio cappello preferito, non un capello.",
    exampleEN: "I lost my favorite hat, not a strand of hair.",
    trap: "Pronouncing geminates as single consonants — you may say 'pala' (shovel) when you mean 'palla' (ball), or 'nono' (ninth) instead of 'nonno' (grandfather).",
    spanishShortcut: "Spanish double consonants (ll, rr) are not true geminates — they represent single sounds. Italian doubled consonants are held longer and change word meaning entirely.",
    tip: "Feel the brief hold before the doubled consonant: PA-la vs PAL-la. Italian ears hear the difference immediately. Practice: nonno / nono / palla / pala out loud."
  },

  {
    id: 35,
    title: "Gemination in Verb Paradigms",
    category: "geminate",
    difficulty: "B2",
    stageId: 4,
    english: "we have / we know / we are (unexpected doubled consonants in Italian verb forms)",
    italian: "abbiamo (avere) · sappiamo (sapere) · stiamo (stare) · diamo (dare)",
    example: "Sappiamo che abbiamo ancora molto da imparare.",
    exampleEN: "We know that we still have a lot to learn.",
    trap: "Spelling 'abiamo', 'sapiamo', 'stiano' — the geminates are required and affect both spelling and pronunciation.",
    spanishShortcut: "Spanish verb paradigms don't introduce unexpected double consonants: 'sabemos', 'tenemos'. Italian irregular forms must be memorized: abbiamo, sappiamo, stiamo.",
    tip: "Learn these whole: abbiamo (avere), sappiamo (sapere), stiamo (stare), diamo (dare). The doubled consonants aren't predictable from the root — memorize the forms."
  },

  {
    id: 36,
    title: "Raddoppiamento Fonosintattico",
    category: "geminate",
    difficulty: "B2",
    stageId: 4,
    english: "a casa / è qui / va bene (consonant after monosyllable sounds doubled in speech)",
    italian: "a + casa → /a ccasa/ · è + qui → /è qqui/ · va + bene → /va bbene/",
    example: "Va bene così. È qui da stamattina. Tre giorni fa.",
    exampleEN: "That's fine. He's been here since this morning. Three days ago.",
    trap: "This is a pronunciation feature, not usually a spelling rule — but it explains why native Italian speech sounds more consonant-heavy than reading the text aloud would suggest.",
    spanishShortcut: "Spanish has no equivalent system of cross-word-boundary consonant doubling. This purely phonological feature of Italian has no Spanish parallel — it must be heard, not read.",
    tip: "Listen for doubling after short words: 'a Roma' sounds like /a rr-oma/. This rhythmic gemination is part of what gives Italian its characteristic musicality — Spanish doesn't have it."
  },

  // ── MODAL (4) ───────────────────────────────────────────────────────────

  {
    id: 37,
    title: "Modal Auxiliaries: Compound Tense Split",
    category: "modal",
    difficulty: "B1",
    stageId: 2,
    english: "I had to go / I was able to do it (modals in compound tenses)",
    italian: "Sono dovuto andare. (andare → essere) / Ho dovuto mangiare. (mangiare → avere)",
    example: "Sono dovuto andare dal medico ieri. Ho dovuto mangiare in fretta.",
    exampleEN: "I had to go to the doctor yesterday. I had to eat quickly.",
    trap: "Assuming modals always take avere: 'ho dovuto andare' is heard in speech but 'ho potuto venire' is more clearly an error — essere is expected with essere-verbs.",
    spanishShortcut: "Spanish always uses haber: 'he tenido que ir', 'he podido hacerlo'. Italian modal auxiliary mirrors the main verb's auxiliary: essere-verb → sono dovuto; avere-verb → ho dovuto.",
    tip: "Modal auxiliary = the main verb's auxiliary. Dovere + andare (essere-verb) → sono dovuto andare. Dovere + mangiare (avere-verb) → ho dovuto mangiare."
  },

  {
    id: 38,
    title: "Modals in Compound Tenses: Both Forms",
    category: "modal",
    difficulty: "B2",
    stageId: 4,
    english: "I wanted to come (formal: auxiliary matches main verb; spoken: avere for all)",
    italian: "Sono voluto venire. (formal) / Ho voluto venire. (spoken — both are used)",
    example: "Sono voluto venire alla cerimonia. / Ho voluto venire alla cerimonia.",
    exampleEN: "I wanted to come to the ceremony. (both forms used by native speakers)",
    trap: "Treating one form as ungrammatical — both are Italian. The distinction is register, not correctness.",
    spanishShortcut: "Spanish always uses haber for compound modals — no split. Italian has two grammatical options: essere (formal/precise) or avere (spoken simplification). Both are correct.",
    tip: "Write: 'sono dovuto andare'. Speak: 'ho dovuto andare' is fine. Understanding both prepares you to read and be understood in any context."
  },

  {
    id: 39,
    title: "Riuscire a vs Potere for Ability",
    category: "modal",
    difficulty: "B1",
    stageId: 2,
    english: "I can swim / I can't open the jar (ability vs managing-to accomplish)",
    italian: "So nuotare. (know how) / Non riesco ad aprire il barattolo. (can't manage to) / Non posso venire. (not allowed/possible)",
    example: "So nuotare ma non riesco a fare il tuffo. Non posso venire domani.",
    exampleEN: "I know how to swim but I can't manage the dive. I can't come tomorrow.",
    trap: "Using 'potere' where 'riuscire a' is needed: 'Non posso aprire il barattolo' implies impossibility; 'Non riesco ad aprire il barattolo' = I'm trying but can't manage.",
    spanishShortcut: "Spanish poder covers all ability: 'puedo nadar', 'no pude abrirlo'. Italian splits: sapere (learned skill), riuscire a (managing to accomplish), potere (permission/physical possibility).",
    tip: "Riuscire a = to successfully accomplish (Spanish conseguir + infinitive). Potere = can/may (same as Spanish poder). The two aren't interchangeable when effort is implied."
  },

  {
    id: 40,
    title: "Sapere vs Conoscere",
    category: "modal",
    difficulty: "B1",
    stageId: 2,
    english: "to know how / to know a fact vs to know a person / to know a place",
    italian: "So nuotare. So che viene. / Conosco Maria. Conosco Roma.",
    example: "So nuotare e so che sei stanco. Conosco Maria e conosco bene Roma.",
    exampleEN: "I know how to swim and I know you're tired. I know Maria and I know Rome well.",
    trap: "Conjugating sapere as a regular verb: 'sapo' doesn't exist — the 1st person singular is 'so'. Also: 'conosco che viene' is wrong; conoscere doesn't take a clause.",
    spanishShortcut: "The sapere/conoscere split mirrors Spanish saber/conocer almost exactly. Only difference: sapere is highly irregular — so, sai, sa, sappiamo, sapete, sanno.",
    tip: "Sapere: so, sai, sa, sappiamo, sapete, sanno. The split matches Spanish — sapere for facts/skills, conoscere for people/places. The only new challenge is the irregular conjugation."
  },

  // ── NEW CARDS (IDs 41-45) ────────────────────────────────────────────────

  {
    id: 41,
    title: "Gendered Articles: il/la/lo/l'/i/le/gli",
    category: "pronoun",
    difficulty: "B1",
    stageId: 1,
    english: "the (masc.) / the (fem.) / lo/gli for s+consonant and z",
    italian: "il libro / la casa / lo studente / l'amico / i libri / le case / gli studenti",
    example: "Lo studente compra il libro e la matita.",
    exampleEN: "The student buys the book and the pencil.",
    trap: "Using 'il' before s+consonant or z: 'il studente' is wrong — must be 'lo studente', 'gli studenti'.",
    spanishShortcut: "Spanish el/la/los/las → Italian adds lo/gli for s+consonant and z. L'/gli before vowels. The extra articles are the main addition beyond the Spanish system."
  },

  {
    id: 42,
    title: "Si Passivante: Passive Meaning Without Passive Voice",
    category: "reflexive",
    difficulty: "B2",
    stageId: 3,
    english: "Italian is spoken here / In summer many houses are sold (impersonal passive)",
    italian: "Qui si parla italiano. / D'estate si vendono molte case.",
    example: "In questa trattoria si mangia benissimo.",
    exampleEN: "In this trattoria, you eat very well. (= the food is excellent here)",
    trap: "Forgetting number agreement: 'si vende tre case' is wrong — 'si vendono tre case' (verb agrees with the noun that follows).",
    spanishShortcut: "Identical to Spanish se pasivo: 'aquí se habla español' = 'qui si parla italiano'. Same pattern, same agreement rule. This one transfers perfectly from Spanish."
  },

  {
    id: 43,
    title: "Piacere: Backwards Liking",
    category: "pronoun",
    difficulty: "B1",
    stageId: 1,
    english: "I like the book (subject = I)",
    italian: "Il libro mi piace. (subject = the book) / Mi piacciono i dolci.",
    example: "Mi piace il caffè. Mi piacciono molto i dolci italiani.",
    exampleEN: "I like coffee. I really like Italian sweets.",
    trap: "Saying 'Io piaccio il caffè' — piace agrees with what is liked (il caffè), not the liker (me). And piacciono is required for plural subjects.",
    spanishShortcut: "Identical to Spanish gustar: me gusta = mi piace (singular subject), me gustan = mi piacciono (plural subject). The structure is exactly the same."
  },

  {
    id: 44,
    title: "False Verb Friends",
    category: "tense",
    difficulty: "B1",
    stageId: 2,
    english: "to support / to pretend / to attend / to assist (English meanings)",
    italian: "supportare (bear/endure) / pretendere (demand) / attendere (wait) / assistere (witness)",
    example: "Non pretendo scuse — voglio solo che tu ascolti.",
    exampleEN: "I'm not demanding apologies — I just want you to listen.",
    trap: "'Pretendo scuse' does NOT mean 'I pretend to apologize' — it means 'I demand apologies'.",
    spanishShortcut: "Italian pretendere = Spanish pretender (to claim/demand). Attendere = aguardar (to wait), not 'attend'. Assistere = presenciar (to witness), not 'assist'."
  },

  {
    id: 45,
    title: "Double Negatives Are Required",
    category: "pronoun",
    difficulty: "B1",
    stageId: 2,
    english: "I don't want anything (one negative in English)",
    italian: "Non voglio niente. / Non ho parlato con nessuno. / Non viene mai.",
    example: "Non ho mangiato niente tutto il giorno.",
    exampleEN: "I haven't eaten anything all day.",
    trap: "Writing 'Voglio niente' without non — Italian requires non before the verb even when niente/nessuno/mai/nemmeno follow.",
    spanishShortcut: "Same as Spanish: 'no quiero nada' → 'non voglio niente'. Double negative is mandatory in both languages. This is one place where Spanish and Italian share the exact same rule."
  }

];

// ── PATTERN DRILLS (30) ─────────────────────────────────────────────────

const grammarDrills = [

  // Card 1 — Essere/Avere auxiliary
  {
    id: 1,
    grammarCardId: 1,
    sentence: "Ieri mattina Marco ___ al mercato da solo.",
    sentenceEN: "Yesterday morning Marco ___ to the market alone.",
    answer: "è andato",
    distractors: ["ha andato", "andava", "ha ito"],
    explanation: "'Andare' is a motion verb — always essere in compound tenses: 'è andato'. 'Ha andato' is the direct Spanish-influenced error (using haber/avere for all verbs)."
  },
  {
    id: 2,
    grammarCardId: 1,
    sentence: "I miei genitori ___ a Napoli tre anni fa.",
    sentenceEN: "My parents ___ to Naples three years ago.",
    answer: "sono partiti",
    distractors: ["hanno partito", "partivano", "sono partire"],
    explanation: "'Partire' (to depart) uses essere: 'sono partiti'. Agreement: partiti (m.pl.). 'Hanno partito' is the haber-influenced error."
  },

  // Card 5 — Stare + Gerundio restriction
  {
    id: 3,
    grammarCardId: 5,
    sentence: "Non interrompermi — ___ proprio adesso.",
    sentenceEN: "Don't interrupt me — I ___ right now.",
    answer: "sto lavorando",
    distractors: ["sono lavorando", "lavoro adesso", "stavo lavorando"],
    explanation: "Stare + gerundio expresses action in progress right now. 'Sono lavorando' is not Italian — essere is not used with gerundio. 'Sto lavorando' = I'm working (right now)."
  },
  {
    id: 4,
    grammarCardId: 5,
    sentence: "Luca ___ a Milano da due anni.",
    sentenceEN: "Luca ___ in Milan for two years.",
    answer: "vive",
    distractors: ["sta vivendo", "è vivendo", "ha vissuto"],
    explanation: "Italian doesn't use stare + gerundio for extended ongoing states. Use simple present + da: 'vive a Milano da due anni'. 'Sta vivendo' would mean he's in the process of moving in right now."
  },

  // Card 6 — Da + present
  {
    id: 5,
    grammarCardId: 6,
    sentence: "___ questo ristorante da quando avevo vent'anni.",
    sentenceEN: "I ___ this restaurant since I was twenty years old.",
    answer: "Frequento",
    distractors: ["Ho frequentato", "Frequentavo", "Sto frequentando"],
    explanation: "For an action ongoing from the past to now, Italian uses present tense + da. 'Ho frequentato' (passato prossimo) implies the action is over."
  },

  // Card 11 — Ne
  {
    id: 6,
    grammarCardId: 11,
    sentence: "Hai delle mele? — Sì, ___ ho comprate tre al mercato.",
    sentenceEN: "Do you have apples? — Yes, I bought three ___ at the market.",
    answer: "ne",
    distractors: ["le", "ci", "di esse"],
    explanation: "'Ne' is mandatory when answering with a quantity without repeating the noun. Note also the participle agreement: 'comprate' (f.pl. mele). 'Le ho comprate tre' without 'ne' is wrong."
  },
  {
    id: 7,
    grammarCardId: 11,
    sentence: "Non voglio più parlare di questa storia. — Capisco, non ___ parliamo.",
    sentenceEN: "I don't want to talk about this anymore. — I understand, let's not talk about ___ anymore.",
    answer: "ne",
    distractors: ["ci", "lo", "di lei"],
    explanation: "'Ne' replaces 'di + topic'. 'Ne parliamo' = we talk about it (di + cosa). 'Ci parliamo' would mean 'we talk to each other' — different meaning entirely."
  },

  // Card 12 — Ci locative
  {
    id: 8,
    grammarCardId: 12,
    sentence: "Conosci quella libreria in via Dante? — Sì, ___ vado spesso.",
    sentenceEN: "Do you know that bookshop on via Dante? — Yes, I go ___ often.",
    answer: "ci",
    distractors: ["li", "vi", "là"],
    explanation: "'Ci' replaces a previously mentioned place ('in via Dante'). In Italian, ci is required — you can't just drop the reference. 'Li' is for people (to them), not places."
  },

  // Card 13 — Glielo
  {
    id: 9,
    grammarCardId: 13,
    sentence: "Vuoi che mandi il documento a Luigi? — Sì, ___ manda subito.",
    sentenceEN: "Do you want me to send the document to Luigi? — Yes, send ___ right away.",
    answer: "glielo",
    distractors: ["se lo", "lo gli", "gli lo"],
    explanation: "'Gli + lo' fuses into 'glielo' (one word). Italian never uses 'se lo' for 3rd person singular indirect objects — that's Spanish. 'Lo gli' and 'gli lo' are not valid Italian sequences."
  },

  // Card 15 — PP agreement with DO clitics
  {
    id: 10,
    grammarCardId: 15,
    sentence: "Le finestre erano aperte? — Sì, ___ ho ___ stamattina.",
    sentenceEN: "Were the windows open? — Yes, I ___ ___ this morning.",
    answer: "le / chiuse",
    distractors: ["le / chiuso", "li / chiusi", "le / chiuduto"],
    explanation: "The direct object clitic 'le' (f.pl.) precedes the verb → participle must agree: 'chiuse' (not 'chiuso'). 'Chiuduto' doesn't exist — participio of chiudere is 'chiuso'."
  },

  // Card 17 — C'è vs Ci sono
  {
    id: 11,
    grammarCardId: 17,
    sentence: "In questa città ___ molti musei interessanti.",
    sentenceEN: "In this city ___ many interesting museums.",
    answer: "ci sono",
    distractors: ["c'è", "hay", "c'hanno"],
    explanation: "'Ci sono' (there are) is used with plural nouns. 'C'è' is for singular nouns. 'Hay' is Spanish — it doesn't exist in Italian."
  },

  // Card 19 — Penso che + congiuntivo
  {
    id: 12,
    grammarCardId: 19,
    sentence: "Penso che Marco ___ in ritardo domani.",
    sentenceEN: "I think Marco ___ late tomorrow.",
    answer: "sia",
    distractors: ["è", "sarà", "sarebbe"],
    explanation: "After 'penso che', Italian always uses congiuntivo: 'sia' (congiuntivo presente di essere). 'È' (indicativo) is a Spanish-influenced error — Italian requires subjunctive here regardless of register."
  },
  {
    id: 13,
    grammarCardId: 19,
    sentence: "Non credo che loro ___ la verità.",
    sentenceEN: "I don't believe they ___ the truth.",
    answer: "dicano",
    distractors: ["dicono", "diceranno", "diranno"],
    explanation: "'Non credo che' triggers congiuntivo: 'dicano' (3rd pl. congiuntivo presente di dire). 'Dicono' is indicativo — never used after 'non credo che' in Italian."
  },

  // Card 21 — Benché + congiuntivo
  {
    id: 14,
    grammarCardId: 21,
    sentence: "Benché ___ stanco, Luca è uscito a correre.",
    sentenceEN: "Although he ___ tired, Luca went out for a run.",
    answer: "fosse",
    distractors: ["era", "è", "sia"],
    explanation: "'Benché' always requires congiuntivo. The main clause is past → use congiuntivo imperfetto: 'fosse'. 'Era' (imperfetto indicativo) is grammatically impossible after benché."
  },

  // Card 22 — Prima che + congiuntivo
  {
    id: 15,
    grammarCardId: 22,
    sentence: "Chiamami prima che tu ___ di casa.",
    sentenceEN: "Call me before you ___ the house.",
    answer: "esca",
    distractors: ["esci", "uscire", "uscirai"],
    explanation: "'Prima che' + different subject → congiuntivo. 'Esca' is 2nd person congiuntivo presente of 'uscire'. 'Esci' is indicativo — wrong after 'prima che'."
  },

  // Card 25 — Reflexive + essere
  {
    id: 16,
    grammarCardId: 25,
    sentence: "Stamattina mi ___ molto tardi.",
    sentenceEN: "This morning I ___ very late.",
    answer: "sono svegliato",
    distractors: ["ho svegliato", "sono svegliata", "ho svegliata"],
    explanation: "Reflexive verbs always use essere: 'mi sono svegliato'. 'Mi ho svegliato' is ungrammatical. (Note: 'mi sono svegliata' would be correct for a female speaker.)"
  },
  {
    id: 17,
    grammarCardId: 25,
    sentence: "Le ragazze ___ presto per non perdere il treno.",
    sentenceEN: "The girls ___ early so as not to miss the train.",
    answer: "si sono alzate",
    distractors: ["si hanno alzate", "si sono alzati", "hanno alzato"],
    explanation: "'Alzarsi' is reflexive → essere auxiliary. And the participle agrees: 'alzate' (f.pl.) because 'le ragazze' is feminine plural. 'Alzati' would be masculine/mixed group."
  },

  // Card 28 — Reciprocal reflexives
  {
    id: 18,
    grammarCardId: 28,
    sentence: "Io e Giulia non ___ da quasi due mesi.",
    sentenceEN: "Giulia and I haven't ___ for almost two months.",
    answer: "ci siamo visti",
    distractors: ["ci abbiamo visti", "abbiamo visto", "siamo visti"],
    explanation: "Reciprocal 'vedersi' uses essere: 'ci siamo visti'. 'Ci abbiamo visti' mixes the wrong auxiliary. 'Siamo visti' is missing the reflexive ci."
  },

  // Card 29 — A vs In
  {
    id: 19,
    grammarCardId: 29,
    sentence: "Quest'estate vado ___ Sicilia con la mia famiglia.",
    sentenceEN: "This summer I'm going ___ Sicily with my family.",
    answer: "in",
    distractors: ["a", "nella", "alla"],
    explanation: "Regions and islands use 'in': 'in Sicilia', 'in Toscana', 'in Sardegna'. Cities use 'a' (a Palermo). 'Nella Sicilia' sounds archaic/literary."
  },
  {
    id: 20,
    grammarCardId: 29,
    sentence: "I miei nonni abitano ___ Toscana, vicino a Siena.",
    sentenceEN: "My grandparents live ___ Tuscany, near Siena.",
    answer: "in",
    distractors: ["a", "nella", "alla"],
    explanation: "Regions use 'in': 'in Toscana', 'in Lombardia'. The city Siena uses 'a'. So: 'in Toscana, vicino a Siena' — different prepositions for region vs city."
  },

  // Card 30 — Da + duration
  {
    id: 21,
    grammarCardId: 30,
    sentence: "Luigi studia medicina ___ cinque anni.",
    sentenceEN: "Luigi has been studying medicine ___ five years.",
    answer: "da",
    distractors: ["per", "desde", "in"],
    explanation: "Present + 'da' + duration = ongoing from past to now. 'Per' would mean 'for (a completed period)': 'ha studiato per cinque anni' = he studied for five years (then stopped). 'Desde' is Spanish."
  },

  // Card 31 — Da + person
  {
    id: 22,
    grammarCardId: 31,
    sentence: "Stasera passo ___ mia sorella prima di andare al cinema.",
    sentenceEN: "Tonight I'm stopping ___ my sister's before going to the cinema.",
    answer: "da",
    distractors: ["a casa di", "a", "in casa di"],
    explanation: "'Passare da + person' = to stop by their place. 'Passo da mia sorella' = I'll stop by my sister's. 'A casa di mia sorella' also works but is wordier — 'da' alone is the natural choice."
  },

  // Card 34 — Geminate minimal pairs
  {
    id: 23,
    grammarCardId: 34,
    sentence: "Ho perso il mio ___ preferito. (hat)",
    sentenceEN: "I lost my favourite ___. (hat)",
    answer: "cappello",
    distractors: ["capello", "capelo", "capello"],
    explanation: "'Cappello' (hat) has a geminate pp. 'Capello' (no doubling) means a single strand of hair. One consonant difference = completely different meaning — geminates matter in Italian."
  },

  // Card 37 — Modal auxiliary split
  {
    id: 24,
    grammarCardId: 37,
    sentence: "Non ___ andare alla festa ieri sera.",
    sentenceEN: "I ___ go to the party last night.",
    answer: "sono potuto",
    distractors: ["ho potuto", "potevo", "sono potuta"],
    explanation: "'Potere' with an essere-verb ('andare') → compound takes essere: 'sono potuto/a andare'. (Note: 'sono potuta' for female speaker.) 'Ho potuto andare' is common in speech but essere is the precise form."
  },

  // Card 39 — Riuscire a vs Potere
  {
    id: 25,
    grammarCardId: 39,
    sentence: "Ho provato per ore ma non ___ aprire il barattolo.",
    sentenceEN: "I tried for hours but I couldn't ___ open the jar.",
    answer: "riuscivo ad",
    distractors: ["potevo", "sapevo", "sono riuscito a"],
    explanation: "'Riuscire a' expresses trying but not managing. 'Non riuscivo ad aprire' = I couldn't manage to open it (despite effort). 'Non potevo' would imply impossibility or lack of permission — different nuance."
  },

  // Card 40 — Sapere vs Conoscere
  {
    id: 26,
    grammarCardId: 40,
    sentence: "___ dove abita Marta?",
    sentenceEN: "___ where Marta lives?",
    answer: "Sai",
    distractors: ["Conosci", "Conosco", "Sa"],
    explanation: "'Sapere' is used for knowing facts and clauses: 'sapere dove' = to know where. 'Conosci' would work for knowing a person, but not for knowing a fact or indirect question."
  },
  {
    id: 27,
    grammarCardId: 40,
    sentence: "___ bene Roma — ci sono cresciuta.",
    sentenceEN: "I ___ Rome well — I grew up there.",
    answer: "Conosco",
    distractors: ["So", "Sapevo", "Riconosco"],
    explanation: "'Conoscere' expresses familiarity with places and people: 'Conosco Roma' = I know Rome well. 'So Roma' would mean 'I know of Rome' as a fact — unnatural. 'Conosco' = familiarity from experience."
  },

  // Card 12 — Ci with pensare
  {
    id: 28,
    grammarCardId: 12,
    sentence: "Questo problema è difficile. Non ___ avevo mai pensato prima.",
    sentenceEN: "This problem is hard. I had never thought about ___ before.",
    answer: "ci",
    distractors: ["ne", "lo", "a esso"],
    explanation: "'Pensare a qualcosa' → 'pensarci': ci replaces 'a + thing'. 'Ne' would replace 'di + something'. 'Lo' is for direct objects. 'Ci penso' = I'm thinking about it."
  },

  // Card 2 — Imperfetto polite
  {
    id: 29,
    grammarCardId: 2,
    sentence: "___ un cornetto e un caffè, per favore.",
    sentenceEN: "I ___ a croissant and a coffee, please.",
    answer: "Volevo",
    distractors: ["Voglio", "Vorrò", "Vorevo"],
    explanation: "Both 'volevo' (imperfetto) and 'vorrei' (condizionale) work as polite requests. 'Voglio' (present) sounds blunt. 'Vorrò' is future. 'Volevo' uses the distinctly Italian imperfetto-as-softener in shops and cafés."
  },

  // Card 3 — PP vs Imperfetto
  {
    id: 30,
    grammarCardId: 3,
    sentence: "Mentre ___ la cena, ha squillato il telefono.",
    sentenceEN: "While I ___ dinner, the phone rang.",
    answer: "preparavo",
    distractors: ["ho preparato", "preparai", "stavo preparando"],
    explanation: "The ongoing background action uses imperfetto: 'preparavo'. The interrupting completed action uses passato prossimo: 'ha squillato'. 'Ho preparato' for the background would make the two actions sound sequential rather than simultaneous."
  }

];
