// Fixed set of 20 beginner (A1-A2) short stories for Reader 'Beginner Stories' mode.
// Distinct from the unbounded dynamic generation (/api/generate-article-stream): permanent,
// pre-written content — same schema as a dynamically-generated article (short-key words
// array), so it renders through the exact same renderArticle()/buildWordmap() path.
// Generated via generate-beginner-stories.js, using the live buildPrompt() pattern from
// lib/ponte.js with difficulty A1/A2 in place of B1/B2.
const beginnerStories = [
  {
    "id": "beg01",
    "title": "Un caffè, per favore!",
    "difficulty": "A1",
    "topic": "ordinare un caffè al bar",
    "italian": "Al bar in Italia si va quasi ogni mattina. Entri, ti avvicini al bancone e dici: 'Un caffè, per favore!' Il barista lo prepara in un attimo — è sempre corto e forte, mica lungo come quello americano! Se vuoi qualcosa di dolce, puoi prendere anche un cornetto. Si paga spesso prima alla cassa, poi dai lo scontrino al barista. Niente paura se non parli bene l'italiano — un sorriso e 'grazie' bastano. Il caffè al bar costa poco, ma è una cosa seria per gli italiani!",
    "english": "In Italy, going to the bar for coffee is almost a daily ritual. You walk up to the counter and say 'A coffee, please!' The barista whips it up in seconds — it's always short and strong, nothing like an American coffee. If you want something sweet, grab a cornetto too. You usually pay at the register first, then hand the receipt to the barista. Don't worry if your Italian isn't great — a smile and 'grazie' go a long way. Coffee at the bar is cheap, but Italians take it very seriously!",
    "spanish": "En Italia, ir al bar a tomar un café es casi un ritual diario. Te acercas a la barra y dices '¡Un café, por favor!' El barista lo prepara en segundos — siempre es corto y fuerte, nada que ver con el café americano. Si quieres algo dulce, también puedes pedir un cornetto. Normalmente pagas primero en la caja y luego le das el ticket al barista. No te preocupes si no hablas bien italiano — una sonrisa y 'grazie' son suficientes. El café en el bar es barato, pero ¡los italianos se lo toman muy en serio!",
    "words": [
      {
        "w": "caffè",
        "en": "coffee",
        "es": "café",
        "c": "same",
        "n": "Identical in meaning and nearly identical in spelling to Spanish 'café'; both refer to the drink and the place.",
        "p": "caf-FÈ"
      },
      {
        "w": "barista",
        "en": "barista / person who works at the bar",
        "es": "barista",
        "c": "similar",
        "n": "In Italian 'barista' simply means the person who works at any bar serving coffee or drinks — not a specialty title as in modern Spanish/English usage. More everyday and neutral in Italian.",
        "p": "ba-RIS-ta"
      },
      {
        "w": "cornetto",
        "en": "croissant (Italian style)",
        "es": "cornetto",
        "c": "false-friend",
        "n": "In Spanish 'corneto' or 'cornetto' suggests a small horn or ice cream cone shape, but in Italian bars it specifically means a croissant-style pastry — applying the Spanish instinct gives the wrong image entirely.",
        "p": "cor-NET-to"
      },
      {
        "w": "bancone",
        "en": "counter / bar counter",
        "es": "mostrador",
        "c": "new",
        "n": "No visual or semantic link to Spanish 'mostrador'. 'Bancone' comes from 'banco' (bench/bank) but in bar context means the counter where you order.",
        "p": "ban-CO-ne"
      },
      {
        "w": "cassa",
        "en": "cash register / checkout",
        "es": "caja",
        "c": "similar",
        "n": "Spanish uses 'caja' for cash register; Italian 'cassa' covers the same meaning but also extends to treasury, box office, and banking contexts more broadly than Spanish 'caja' typically does.",
        "p": "CAS-sa"
      },
      {
        "w": "scontrino",
        "en": "receipt",
        "es": "ticket / recibo",
        "c": "new",
        "n": "No equivalent in Spanish — Spanish speakers say 'ticket' or 'recibo'. 'Scontrino' is uniquely Italian and essential vocabulary for bar culture since you often pay first and show the receipt.",
        "p": "scon-TRI-no"
      },
      {
        "w": "forte",
        "en": "strong",
        "es": "fuerte",
        "c": "same",
        "n": "Visually and semantically equivalent to Spanish 'fuerte' in the sense of strong; used the same way to describe strong coffee.",
        "p": "FOR-te"
      },
      {
        "w": "attimo",
        "en": "moment / instant",
        "es": "momento",
        "c": "false-friend",
        "n": "Looks like it could relate to Spanish 'átomo' (atom) or seem scientific, but in Italian it simply means 'a moment' or 'an instant'. Applying any atom-related Spanish instinct is actively wrong here.",
        "p": "AT-ti-mo"
      }
    ]
  },
  {
    "id": "beg02",
    "title": "Ciao! Come ti chiami?",
    "difficulty": "A1",
    "topic": "presentarsi a una persona nuova",
    "italian": "Ieri ho conosciuto una ragazza simpatica al bar. Si chiama Giulia. Le ho detto: 'Ciao, io mi chiamo Marco, piacere!' Lei ha sorriso e mi ha risposto: 'Piacere mio! Sei di qui?' Le ho spiegato che sono di Milano ma abito a Roma da due anni. Lei invece è di Napoli. Abbiamo parlato un po', ci siamo scambiati il numero di telefono e alla fine ci siamo salutati. È stato facile e naturale — presentarsi non è poi così difficile, basta sorridere e essere gentili!",
    "english": "Yesterday I met a nice girl at the café. Her name is Giulia. I said to her: 'Hey, I'm Marco, nice to meet you!' She smiled and replied: 'Nice to meet you too! Are you from around here?' I explained that I'm from Milan but have been living in Rome for two years. She's from Naples. We chatted for a bit, exchanged phone numbers, and eventually said goodbye. It was easy and natural — introducing yourself isn't that hard, you just have to smile and be friendly!",
    "spanish": "Ayer conocí a una chica simpática en el bar. Se llama Giulia. Le dije: '¡Hola, me llamo Marco, encantado!' Ella sonrió y me respondió: '¡Encantado yo también! ¿Eres de aquí?' Le expliqué que soy de Milán pero vivo en Roma desde hace dos años. Ella es de Nápoles. Hablamos un poco, nos intercambiamos el número de teléfono y al final nos despedimos. Fue fácil y natural — presentarse no es tan difícil, solo hay que sonreír y ser amables!",
    "words": [
      {
        "w": "simpatica",
        "en": "nice, likeable",
        "es": "simpática",
        "c": "same",
        "n": "Identical spelling (minus accent) and meaning in both languages — a friendly, warm person.",
        "p": "sim-PA-ti-ca"
      },
      {
        "w": "naturale",
        "en": "natural",
        "es": "natural",
        "c": "same",
        "n": "Visually identical to Spanish 'natural' with the same meaning.",
        "p": "na-tu-RA-le"
      },
      {
        "w": "conosciuto",
        "en": "met, got to know",
        "es": "conocido",
        "c": "similar",
        "n": "Like Spanish 'conocido' it relates to knowing someone, but in Italian it is the standard way to say 'met for the first time', while in Spanish 'conocido' more often means 'acquaintance' as a noun.",
        "p": "co-no-SHOO-to"
      },
      {
        "w": "gentili",
        "en": "kind, polite",
        "es": "gentil",
        "c": "false-friend",
        "n": "Spanish 'gentil' means elegant or graceful; Italian 'gentili' means kind or polite — applying the Spanish meaning here would be wrong.",
        "p": "gen-TI-li"
      },
      {
        "w": "salutati",
        "en": "said goodbye",
        "es": "saludado",
        "c": "false-friend",
        "n": "Spanish 'saludar' means to greet or wave hello; Italian 'salutarsi' in this context means to say goodbye — the opposite direction of the interaction.",
        "p": "sa-lu-TA-ti"
      },
      {
        "w": "piacere",
        "en": "nice to meet you / pleasure",
        "es": "placer",
        "c": "similar",
        "n": "Spanish 'placer' means pleasure as a noun, but Italian 'piacere' is also the standard fixed greeting when meeting someone, a conversational use Spanish 'placer' does not have on its own.",
        "p": "pia-CHE-re"
      },
      {
        "w": "basta",
        "en": "you just need to / it's enough",
        "es": "basta",
        "c": "same",
        "n": "Same form and meaning as Spanish 'basta' — it is enough, all you need.",
        "p": "BA-sta"
      },
      {
        "w": "abito",
        "en": "I live, I reside",
        "es": "habito",
        "c": "false-friend",
        "n": "Spanish 'hábito' means habit or monk's robe; Italian 'abito' means I live somewhere or, as a noun, a suit or dress — applying the Spanish meaning gives a completely wrong result.",
        "p": "A-bi-to"
      },
      {
        "w": "poi",
        "en": "then, afterwards",
        "es": "luego / después",
        "c": "new",
        "n": "No visual or semantic link to Spanish equivalents 'luego' or 'después' — must be learned fresh.",
        "p": "POY"
      },
      {
        "w": "invece",
        "en": "instead, on the other hand",
        "es": "en cambio / sino",
        "c": "new",
        "n": "No resemblance to Spanish 'en cambio' or 'sino' — a common Italian connector that needs to be memorized.",
        "p": "in-VE-che"
      }
    ]
  },
  {
    "id": "beg03",
    "title": "La mia famiglia è un casino",
    "difficulty": "A1",
    "topic": "la mia famiglia",
    "italian": "La mia famiglia è grande e un po' caotica, ma la adoro. Siamo in sei: io, mia madre, mio padre, due fratelli e mia nonna. Mia madre si chiama Rosa e cucina sempre troppo — a casa nostra si mangia tantissimo! Mio padre lavora molto, però la sera guardiamo la tv insieme sul divano. I miei fratelli sono piccoli e rompono sempre le scatole. Mia nonna abita vicino a noi e viene a trovarci ogni domenica. È lei la vera boss della famiglia, onestamente.",
    "english": "My family is big and a bit chaotic, but I love them to bits. There are six of us: me, my mum, my dad, two brothers, and my grandma. My mum's name is Rosa and she always cooks way too much — we eat like kings at our place! My dad works a lot, but in the evenings we watch TV together on the sofa. My brothers are little and they're always driving me crazy. My grandma lives nearby and comes to visit every Sunday. Honestly, she's the real boss of the family.",
    "spanish": "Mi familia es grande y un poco caótica, pero la adoro. Somos seis: yo, mi madre, mi padre, dos hermanos y mi abuela. Mi madre se llama Rosa y siempre cocina demasiado — ¡en nuestra casa se come muchísimo! Mi padre trabaja mucho, pero por las noches vemos la tele juntos en el sofá. Mis hermanos son pequeños y siempre me sacan de quicio. Mi abuela vive cerca de nosotros y viene a visitarnos cada domingo. Honestamente, ella es la verdadera jefa de la familia.",
    "words": [
      {
        "w": "famiglia",
        "en": "family",
        "es": "familia",
        "c": "similar",
        "n": "Core meaning is identical, but in Italian 'famiglia' is also used informally to mean 'my people' or a close-knit group, a slightly warmer register than the neutral Spanish 'familia'.",
        "p": "fa-MIL-ya"
      },
      {
        "w": "grande",
        "en": "big, large",
        "es": "grande",
        "c": "similar",
        "n": "Looks identical to Spanish 'grande', but in Italian it almost never means 'great' in the sense of famous or impressive — that would be 'ottimo' or 'magnifico'. Using it to mean 'great' as in Spanish can sound odd.",
        "p": "GRAN-de"
      },
      {
        "w": "fratelli",
        "en": "brothers (or siblings)",
        "es": "hermanos",
        "c": "new",
        "n": "No visual link to Spanish 'hermanos'. 'Fratello' comes from Latin 'frater'; completely different word family from the Spanish equivalent.",
        "p": "fra-TEL-li"
      },
      {
        "w": "divano",
        "en": "sofa, couch",
        "es": "sofá",
        "c": "false-friend",
        "n": "Looks like it could relate to Spanish 'divan' (a type of bed/couch), but in everyday Italian 'divano' simply means the living-room sofa. Thinking of it as a fancy divan-bed is wrong here.",
        "p": "di-VA-no"
      },
      {
        "w": "vicino",
        "en": "nearby, close",
        "es": "cerca",
        "c": "false-friend",
        "n": "Resembles Spanish 'vecino' (neighbour), but in Italian 'vicino' means 'near' or 'close by'. The Italian word for neighbour is 'vicino di casa', but standalone 'vicino' is an adjective/adverb meaning nearby — not a person.",
        "p": "vi-CHI-no"
      },
      {
        "w": "adoro",
        "en": "I adore, I love",
        "es": "adoro",
        "c": "same",
        "n": "Identical in form and meaning to Spanish 'adoro'. No false-friend risk; fully interchangeable.",
        "p": "a-DO-ro"
      },
      {
        "w": "nonna",
        "en": "grandma, grandmother",
        "es": "abuela",
        "c": "new",
        "n": "No connection to Spanish 'abuela'. A distinctly Italian word with no shared root recognisable to a Spanish speaker.",
        "p": "NON-na"
      },
      {
        "w": "domenica",
        "en": "Sunday",
        "es": "domingo",
        "c": "similar",
        "n": "Both come from Latin 'dies Dominica'. The root is recognisable, but the Italian form ends in '-ica' while Spanish uses '-ingo', so it requires a small mental adjustment and is not visually identical.",
        "p": "do-ME-ni-ca"
      }
    ]
  },
  {
    "id": "beg04",
    "title": "La mia mattina, passo per passo",
    "difficulty": "A1",
    "topic": "la routine del mattino",
    "italian": "Mi sveglio alle sette, ma resto a letto ancora cinque minuti — sempre. Poi mi alzo, vado in bagno e mi lavo la faccia con l'acqua fredda. Brrr! Dopo mi faccio il caffè, che per me è la parte più importante della mattina. Lo bevo in piedi in cucina, veloce veloce. Non faccio colazione di solito — solo il caffè e basta. Mi vesto in fretta, prendo la borsa e esco di casa. Cerco sempre di arrivare in orario, ma spesso sono in ritardo. La mattina non fa per me, onestamente!",
    "english": "I wake up at seven, but I stay in bed for another five minutes — always. Then I get up, go to the bathroom, and splash cold water on my face. Brrr! After that I make myself a coffee, which for me is the most important part of the morning. I drink it standing up in the kitchen, super quick. I usually skip breakfast — just the coffee and that's it. I get dressed in a rush, grab my bag, and head out. I always try to be on time, but I'm often running late. Mornings just aren't my thing, honestly!",
    "spanish": "Me despierto a las siete, pero me quedo en la cama cinco minutos más — siempre. Luego me levanto, voy al baño y me lavo la cara con agua fría. ¡Brrr! Después me preparo un café, que para mí es la parte más importante de la mañana. Me lo tomo de pie en la cocina, rapidísimo. Normalmente no desayuno — solo el café y ya. Me visto a las carreras, agarro la bolsa y salgo de casa. Siempre intento llegar a tiempo, pero muchas veces llego tarde. La mañana no es lo mío, sinceramente!",
    "words": [
      {
        "w": "caffè",
        "en": "coffee",
        "es": "café",
        "c": "same",
        "n": "Identical in meaning and nearly identical in spelling; the accent is on the final e in Italian too.",
        "p": "caf-FÈ"
      },
      {
        "w": "cucina",
        "en": "kitchen",
        "es": "cocina",
        "c": "similar",
        "n": "In Spanish cocina means both kitchen and cuisine/cooking style; in Italian cucina also covers both senses, so the meanings overlap fully — but worth noting Italian uses it just as naturally for the room as for the cooking tradition.",
        "p": "cu-CI-na"
      },
      {
        "w": "colazione",
        "en": "breakfast",
        "es": "colación",
        "c": "false-friend",
        "n": "Spanish colación means a light snack or a minor meal, not the main morning meal. In Italian colazione specifically means breakfast (or sometimes lunch in some regions), so applying the Spanish meaning gives you the wrong idea entirely.",
        "p": "co-la-TSIO-ne"
      },
      {
        "w": "borsa",
        "en": "bag / handbag",
        "es": "bolsa",
        "c": "similar",
        "n": "Spanish bolsa can mean bag, stock market, or scholarship. Italian borsa shares bag and stock-market senses but the scholarship meaning (bolsa de estudios) does not transfer — in Italian that is borsa di studio, a more specific phrase.",
        "p": "BOR-sa"
      },
      {
        "w": "orario",
        "en": "schedule / on time",
        "es": "horario",
        "c": "similar",
        "n": "Spanish horario means timetable or schedule. Italian orario shares that meaning but is also used in the phrase in orario meaning on time, a usage Spanish horario does not cover — you would say a tiempo in Spanish instead.",
        "p": "o-RA-rio"
      },
      {
        "w": "sveglio",
        "en": "awake / sharp / clever",
        "es": "despierto",
        "c": "new",
        "n": "No visual connection to Spanish despierto. The verb svegliarsi (to wake up) comes from an old Germanic root and looks nothing like despertar.",
        "p": "ZVEL-yo"
      },
      {
        "w": "fretta",
        "en": "hurry / rush",
        "es": "prisa",
        "c": "new",
        "n": "Completely unrelated to Spanish prisa visually or etymologically. In fretta means in a hurry, the same way de prisa does in Spanish, but you just have to learn this word fresh.",
        "p": "FRET-ta"
      },
      {
        "w": "ritardo",
        "en": "delay / being late",
        "es": "retraso",
        "c": "similar",
        "n": "Spanish retraso and Italian ritardo both mean delay, but Italian ritardo also appears in the musical term ritardando and in everyday speech in ritardo (running late) where Spanish prefers tarde or con retraso. Core meaning transfers but register and collocations differ slightly.",
        "p": "ri-TAR-do"
      }
    ]
  },
  {
    "id": "beg05",
    "title": "Al mercato con la nonna",
    "difficulty": "A1",
    "topic": "fare la spesa al mercato",
    "italian": "Ogni sabato mattina vado al mercato con la nonna. Ci sono tanti banchi con frutta, verdura, formaggi e salumi. La nonna conosce tutti i venditori — li saluta, chiacchiera un po', e poi sceglie sempre la roba più fresca. 'Questo pomodoro non va bene,' dice, e lo rimette giù. Io di solito porto la borsa e basta! I prezzi al mercato sono spesso più bassi del supermercato, e la qualità è molto meglio. Alla fine compriamo sempre troppo e torniamo a casa con le borse piene. Ma la nonna è contenta, e anche io!",
    "english": "Every Saturday morning I go to the market with my grandma. There are loads of stalls with fruit, vegetables, cheeses, and cured meats. Grandma knows all the vendors — she says hi, chats a bit, then always picks the freshest stuff. 'This tomato is no good,' she says, and puts it back down. I usually just carry the bag and that's it! Prices at the market are often lower than the supermarket, and the quality is way better. In the end we always buy too much and come home with bags full. But grandma is happy, and so am I!",
    "spanish": "Cada sábado por la mañana voy al mercado con la abuela. Hay muchísimos puestos con fruta, verdura, quesos y embutidos. La abuela conoce a todos los vendedores — los saluda, charla un poco y luego siempre elige lo más fresco. 'Este tomate no está bien,' dice, y lo vuelve a dejar. ¡Yo normalmente solo cargo la bolsa y nada más! Los precios en el mercado suelen ser más bajos que en el supermercado, y la calidad es mucho mejor. Al final siempre compramos demasiado y volvemos a casa con las bolsas llenas. ¡Pero la abuela está contenta, y yo también!",
    "words": [
      {
        "w": "mercato",
        "en": "market",
        "es": "mercado",
        "c": "similar",
        "n": "In Italian mercato refers to an open-air or street market; in Spanish mercado can also mean a covered indoor market or even a financial market, so the scope is slightly broader in Spanish.",
        "p": "mer-CA-to"
      },
      {
        "w": "frutta",
        "en": "fruit",
        "es": "fruta",
        "c": "similar",
        "n": "Core meaning is the same, but in Italian frutta is used almost exclusively for edible fruit as food; frutto (singular) is used for abstract or metaphorical senses like 'il frutto del lavoro', unlike Spanish fruta/fruto which follow a similar but not identical split.",
        "p": "FRUT-ta"
      },
      {
        "w": "venditori",
        "en": "vendors, sellers",
        "es": "vendedores",
        "c": "same",
        "n": "Plural of venditore; visually and semantically identical to Spanish vendedores with no meaningful difference.",
        "p": "ven-di-TO-ri"
      },
      {
        "w": "salumi",
        "en": "cured meats (salami, prosciutto, etc.)",
        "es": "embutidos",
        "c": "new",
        "n": "No visual or semantic link to Spanish embutidos or fiambres; salumi is a specifically Italian category covering all cured pork products and has no direct Spanish cognate.",
        "p": "sa-LU-mi"
      },
      {
        "w": "burro",
        "en": "butter",
        "es": "mantequilla",
        "c": "false-friend",
        "n": "A Spanish speaker will think of 'donkey' (burro), but in Italian burro means butter. Applying the Spanish meaning here is completely wrong.",
        "p": "BUR-ro"
      },
      {
        "w": "contenta",
        "en": "happy, pleased",
        "es": "contenta",
        "c": "false-friend",
        "n": "In Spanish contenta means happy, which matches Italian. However, in Italian contento/contenta can ONLY mean pleased or satisfied — it never means 'containing' or carrying the English 'content' sense. More importantly, Spanish speakers may use contento loosely where Italian requires felice for deeper happiness, making the register subtly different and sometimes misleading.",
        "p": "con-TEN-ta"
      },
      {
        "w": "qualità",
        "en": "quality",
        "es": "calidad",
        "c": "similar",
        "n": "The meaning is equivalent, but the Italian form qualità looks much closer to English quality than to Spanish calidad; a Spanish speaker might not immediately recognise it as a cognate even though the core meaning fully transfers.",
        "p": "qua-li-TÀ"
      },
      {
        "w": "sceglie",
        "en": "she chooses, she picks",
        "es": "elige",
        "c": "new",
        "n": "From scegliere (to choose); no visual connection to Spanish elegir. The sc- cluster makes it look unfamiliar to Spanish speakers despite the same meaning.",
        "p": "SHEL-ye"
      }
    ]
  },
  {
    "id": "beg06",
    "title": "Scusa, come arrivo in centro?",
    "difficulty": "A1",
    "topic": "chiedere indicazioni per strada",
    "italian": "Sei in una città nuova e non sai dove andare. Puoi fermare qualcuno per strada e chiedere aiuto. Di solito si dice: 'Scusa, mi sai dire dov'è la stazione?' oppure 'Come arrivo in centro?' La gente di solito è gentile e ti risponde. Qualcuno ti dice: 'Vai dritto, poi giri a sinistra.' Oppure: 'È lì, vicino alla farmacia.' Se non capisci, puoi dire: 'Puoi ripetere più lentamente, per favore?' Non aver paura di chiedere — è normale non conoscere una città nuova!",
    "english": "You're in a new city and you don't know where to go. You can stop someone on the street and ask for help. Usually you say something like: 'Excuse me, do you know where the train station is?' or 'How do I get to the city center?' People are usually friendly and will answer you. Someone might say: 'Go straight, then turn left.' Or: 'It's right there, near the pharmacy.' If you don't understand, you can say: 'Can you repeat that more slowly, please?' Don't be afraid to ask — it's totally normal not to know your way around a new city!",
    "spanish": "Estás en una ciudad nueva y no sabes adónde ir. Puedes parar a alguien en la calle y pedir ayuda. Normalmente se dice: '¿Perdona, sabes dónde está la estación?' o '¿Cómo llego al centro?' La gente suele ser amable y te responde. Alguien te puede decir: 'Ve recto y luego gira a la izquierda.' O bien: 'Está ahí, cerca de la farmacia.' Si no entiendes, puedes decir: '¿Puedes repetirlo más despacio, por favor?' No tengas miedo de preguntar — ¡es normal no conocer una ciudad nueva!",
    "words": [
      {
        "w": "stazione",
        "en": "station",
        "es": "estación",
        "c": "similar",
        "n": "Resembles Spanish 'estación' but in Italian it only means a physical station (train, bus, police); it never means 'season' like Spanish 'estación' can.",
        "p": "sta-TSYO-ne"
      },
      {
        "w": "farmacia",
        "en": "pharmacy",
        "es": "farmacia",
        "c": "same",
        "n": "Identical in form and meaning to Spanish farmacia — a place to buy medicine.",
        "p": "far-MA-cha"
      },
      {
        "w": "dritto",
        "en": "straight ahead",
        "es": "derecho/recto",
        "c": "false-friend",
        "n": "Looks like Spanish 'derecho' (right side or law), but in Italian 'dritto' means straight ahead, not right. For right direction Italians say 'a destra'.",
        "p": "DRIT-to"
      },
      {
        "w": "gentile",
        "en": "kind, friendly",
        "es": "amable",
        "c": "false-friend",
        "n": "Looks like Spanish 'gentil' (elegant or graceful), but in Italian 'gentile' means kind or friendly, not elegant. A very common false friend.",
        "p": "jen-TI-le"
      },
      {
        "w": "lentamente",
        "en": "slowly",
        "es": "lentamente",
        "c": "same",
        "n": "Identical to Spanish lentamente — both mean slowly and are used the same way.",
        "p": "len-ta-MEN-te"
      },
      {
        "w": "girare",
        "en": "to turn",
        "es": "girar",
        "c": "similar",
        "n": "Very close to Spanish 'girar', but in Italian 'girare' is also commonly used to mean to wander around a city or to shoot a film, senses Spanish 'girar' doesn't share.",
        "p": "ji-RA-re"
      },
      {
        "w": "vicino",
        "en": "near, close by",
        "es": "cerca",
        "c": "new",
        "n": "No visual connection to Spanish 'cerca'. Italian uses 'vicino' where Spanish says 'cerca'. Must be learned from scratch.",
        "p": "vi-CHI-no"
      },
      {
        "w": "fermare",
        "en": "to stop (someone)",
        "es": "parar",
        "c": "similar",
        "n": "Resembles Spanish 'firmar' (to sign) visually, but means to stop. Closer in meaning to Spanish 'parar', though 'firmar' is a misleading look-alike.",
        "p": "fer-MA-re"
      }
    ]
  },
  {
    "id": "beg07",
    "title": "Che tempo fa oggi?",
    "difficulty": "A1",
    "topic": "che tempo fa oggi",
    "italian": "Oggi fuori fa un freddo cane! Mi sono svegliato stamattina e ho guardato dalla finestra — cielo grigio, nuvole ovunque e pure un po' di pioggia. Che tristezza. Ieri invece era bellissimo: sole, caldo, quasi sembrava estate. Mia sorella mi ha detto di portare l'ombrello, ma io non l'ho ascoltata. Ovviamente mi sono bagnato tutto. Domani dicono che torna il sole, quindi speriamo bene. Il tempo in questa città cambia troppo in fretta — non si capisce mai niente!",
    "english": "Today it's absolutely freezing outside! I woke up this morning and looked out the window — grey sky, clouds everywhere, and even a bit of rain. So gloomy. Yesterday though it was gorgeous: sunny, warm, almost felt like summer. My sister told me to bring an umbrella, but I didn't listen. Obviously I got soaked. They say the sun comes back tomorrow, so fingers crossed. The weather in this city changes way too fast — you just never know what to expect!",
    "spanish": "¡Hoy afuera hace un frío terrible! Me desperté esta mañana y miré por la ventana — cielo gris, nubes por todas partes y encima un poco de lluvia. Qué tristeza. Ayer, en cambio, estaba precioso: sol, calor, casi parecía verano. Mi hermana me dijo que llevara el paraguas, pero no le hice caso. Obviamente me empapé entero. Dicen que mañana vuelve el sol, así que esperemos lo mejor. El tiempo en esta ciudad cambia demasiado rápido — ¡nunca se sabe nada!",
    "words": [
      {
        "w": "pioggia",
        "en": "rain",
        "es": "lluvia",
        "c": "new",
        "n": "No visual connection to 'lluvia'. Must be memorized from scratch.",
        "p": "pi-OG-gia"
      },
      {
        "w": "cielo",
        "en": "sky",
        "es": "cielo",
        "c": "same",
        "n": "Identical spelling and meaning in both Italian and Spanish.",
        "p": "CIE-lo"
      },
      {
        "w": "ombrello",
        "en": "umbrella",
        "es": "paraguas",
        "c": "new",
        "n": "No connection to 'paraguas'. Italian uses a totally different root.",
        "p": "om-BREL-lo"
      },
      {
        "w": "freddo",
        "en": "cold",
        "es": "frío",
        "c": "new",
        "n": "No visual link to 'frío'. Unrelated root — must be learned fresh.",
        "p": "FRED-do"
      },
      {
        "w": "sole",
        "en": "sun",
        "es": "sol",
        "c": "similar",
        "n": "'Sole' and 'sol' share the same core meaning, but in Italian 'sole' is also used in poetry and song titles more broadly than Spanish 'sol', which is more neutral and everyday.",
        "p": "SO-le"
      },
      {
        "w": "tempo",
        "en": "weather / time",
        "es": "tiempo",
        "c": "false-friend",
        "n": "Spanish 'tiempo' means both weather and time, just like Italian 'tempo' — but in everyday Italian, 'tempo' as weather feels more restricted to set phrases like 'che tempo fa', whereas Spanish speakers use 'tiempo' more freely for weather in general conversation. Applying Spanish instinct can lead to unnatural Italian.",
        "p": "TEM-po"
      },
      {
        "w": "estate",
        "en": "summer",
        "es": "estado / estación",
        "c": "false-friend",
        "n": "Looks like Spanish 'estado' (state) or 'estación' (season/station) but means 'summer' in Italian. A Spanish speaker would guess the wrong meaning entirely.",
        "p": "e-STA-te"
      },
      {
        "w": "nuvole",
        "en": "clouds",
        "es": "nubes",
        "c": "similar",
        "n": "Both come from Latin 'nubes', so the root is shared and the meaning is the same, but the forms look different enough that recognition is not immediate. Italian uses the plural 'nuvole' very commonly in weather talk.",
        "p": "NU-vo-le"
      }
    ]
  },
  {
    "id": "beg08",
    "title": "Il mio gatto si chiama Pepe",
    "difficulty": "A1",
    "topic": "il mio animale domestico",
    "italian": "Ho un gatto che si chiama Pepe. È arancione con delle macchie bianche e ha gli occhi verdi — è proprio carino! Dorme quasi tutto il giorno sul divano e mangia tantissimo. La sera diventa matto e corre per tutta la casa, non so perché. Gli piace stare vicino a me quando guardo la televisione. A volte mi sveglia di notte perché vuole coccole. È un po' pigro ma è il mio migliore amico. Non riesco a immaginare la mia vita senza di lui!",
    "english": "I have a cat named Pepe. He's orange with white patches and has green eyes — he's really cute! He sleeps almost all day on the couch and eats a ton. In the evenings he goes crazy and runs all over the house, no idea why. He likes to stay close to me when I watch TV. Sometimes he wakes me up at night because he wants cuddles. He's a bit lazy but he's my best friend. I can't imagine my life without him!",
    "spanish": "Tengo un gato que se llama Pepe. Es naranja con manchas blancas y tiene los ojos verdes — ¡es muy mono! Duerme casi todo el día en el sofá y come muchísimo. Por la noche se vuelve loco y corre por toda la casa, no sé por qué. Le gusta estar cerca de mí cuando veo la televisión. A veces me despierta de noche porque quiere mimos. Es un poco perezoso pero es mi mejor amigo. ¡No puedo imaginar mi vida sin él!",
    "words": [
      {
        "w": "gatto",
        "en": "cat",
        "es": "gato",
        "c": "similar",
        "n": "Almost identical to Spanish 'gato', but in Italian the double-t changes the pronunciation — the t is held longer. Meaning is the same, just watch the spelling.",
        "p": "GAT-to"
      },
      {
        "w": "divano",
        "en": "couch, sofa",
        "es": "diván",
        "c": "similar",
        "n": "Spanish 'diván' refers specifically to a long backless sofa or chaise longue; Italian 'divano' is the everyday word for any regular couch or sofa.",
        "p": "di-VA-no"
      },
      {
        "w": "matto",
        "en": "crazy, nuts",
        "es": "mato",
        "c": "false-friend",
        "n": "Spanish 'mato' means 'I kill' (from matar). Italian 'matto' means crazy or wild — completely different meaning, so don't trust your Spanish instinct here.",
        "p": "MAT-to"
      },
      {
        "w": "coccole",
        "en": "cuddles, snuggles",
        "es": "mimos, caricias",
        "c": "new",
        "n": "No real Spanish equivalent that looks like this word. It means affectionate physical attention like petting or cuddling. Totally new vocabulary to learn.",
        "p": "COC-co-le"
      },
      {
        "w": "pigro",
        "en": "lazy",
        "es": "perezoso",
        "c": "new",
        "n": "No visual connection to Spanish 'perezoso'. 'Pigro' is the standard Italian word for lazy and must simply be memorized.",
        "p": "PI-gro"
      },
      {
        "w": "televisione",
        "en": "television",
        "es": "televisión",
        "c": "same",
        "n": "Visually near-identical to Spanish 'televisión' and means exactly the same thing. Safe to transfer directly from Spanish.",
        "p": "te-le-vi-ZIO-ne"
      },
      {
        "w": "macchie",
        "en": "patches, spots, stains",
        "es": "manchas",
        "c": "similar",
        "n": "Similar to Spanish 'manchas' and the core meaning of spots or stains overlaps, but Italian 'macchie' also commonly refers to natural color patches on animals or plants, a nuance 'manchas' doesn't always carry.",
        "p": "MAC-chie"
      }
    ]
  },
  {
    "id": "beg09",
    "title": "Andiamo a fare shopping!",
    "difficulty": "A1",
    "topic": "comprare vestiti nuovi",
    "italian": "Oggi ho voglia di comprare qualcosa di nuovo. Vado in centro con la mia amica Giulia. Entriamo in un negozio carino e guardiamo i vestiti. Giulia trova subito una gonna bellissima e la prova. Io invece cerco un paio di jeans. Il commesso è gentile e ci aiuta a trovare la taglia giusta. I prezzi non sono troppo alti, quindi compriamo tutto! Usciamo dal negozio con tante borse e siamo contentissime. Dopo andiamo a prendere un caffè per festeggiare. Fare shopping con un'amica è sempre divertente!",
    "english": "Today I feel like buying something new. I head downtown with my friend Giulia. We walk into a cute shop and look around at the clothes. Giulia immediately spots a gorgeous skirt and tries it on. I'm looking for a pair of jeans. The sales assistant is really helpful and finds us the right size. The prices aren't too bad, so we buy everything! We walk out loaded with bags and couldn't be happier. Afterwards we grab a coffee to celebrate. Shopping with a friend is always such fun!",
    "spanish": "Hoy tengo ganas de comprar algo nuevo. Voy al centro con mi amiga Giulia. Entramos en una tienda bonita y miramos la ropa. Giulia encuentra enseguida una falda preciosa y se la prueba. Yo busco unos jeans. El dependiente es amable y nos ayuda a encontrar la talla correcta. Los precios no son muy altos, ¡así que compramos todo! Salimos de la tienda con muchas bolsas y estamos contentísimas. Después vamos a tomar un café para celebrar. ¡Hacer shopping con una amiga es siempre divertido!",
    "words": [
      {
        "w": "negozio",
        "en": "shop, store",
        "es": "tienda",
        "c": "false-friend",
        "n": "Looks like 'negocio' (business/deal in Spanish) but in Italian it simply means a shop or store, not a business transaction.",
        "p": "ne-GO-zio"
      },
      {
        "w": "vestiti",
        "en": "clothes",
        "es": "ropa / vestidos",
        "c": "similar",
        "n": "Spanish 'vestido' means a dress specifically; Italian 'vestiti' is the general word for clothes/garments of any kind.",
        "p": "ve-STI-ti"
      },
      {
        "w": "taglia",
        "en": "size (clothing)",
        "es": "talla",
        "c": "same",
        "es_word": "talla",
        "n": "Identical to Spanish 'talla' — clothing size.",
        "p": "TA-lya"
      },
      {
        "w": "commesso",
        "en": "shop assistant, sales clerk",
        "es": "dependiente",
        "c": "new",
        "n": "No visual link to Spanish; 'commesso' comes from Latin committere. Spanish uses 'dependiente' or 'vendedor'.",
        "p": "com-MES-so"
      },
      {
        "w": "gentile",
        "en": "kind, nice",
        "es": "amable",
        "c": "false-friend",
        "n": "Looks like Spanish 'gentil' (elegant, graceful) but in Italian it means kind or nice — a completely different sense.",
        "p": "jen-TI-le"
      },
      {
        "w": "subito",
        "en": "right away, immediately",
        "es": "enseguida / inmediatamente",
        "c": "false-friend",
        "n": "Looks like Spanish 'súbito' which is rare/literary for sudden; in everyday Italian 'subito' is the normal word for immediately.",
        "p": "SU-bi-to"
      },
      {
        "w": "divertente",
        "en": "fun, entertaining",
        "es": "divertido",
        "c": "similar",
        "n": "Core meaning matches Spanish 'divertido', but Italian 'divertente' is more commonly used to describe things/situations rather than people feeling amused.",
        "p": "di-ver-TEN-te"
      },
      {
        "w": "gonna",
        "en": "skirt",
        "es": "falda",
        "c": "new",
        "n": "No connection to Spanish 'falda'. 'Gonna' is uniquely Italian with no recognisable Spanish equivalent.",
        "p": "GON-na"
      }
    ]
  },
  {
    "id": "beg10",
    "title": "Ciao! Come stai?",
    "difficulty": "A1",
    "topic": "una telefonata con un amico",
    "italian": "Ieri sera Marco ha chiamato il suo amico Luca. \"Ciao Luca! Come stai?\" \"Bene bene, grazie! E tu?\" \"Anch'io sto bene. Senti, sei libero sabato? Voglio venire da te.\" \"Sabato... aspetta... sì, sono libero! Vieni pure!\" \"Perfetto! Arrivo verso le tre.\" \"Okay, ti aspetto. Ah, porta qualcosa da mangiare, ho fame già adesso!\" I due amici ridono. \"Certo! Porto la pizza!\" \"Sei il migliore, Marco!\" \"Lo so, lo so!\" Luca riattacca il telefono e sorride. Non vede l'ora di vedere il suo amico.",
    "english": "Yesterday evening Marco called his friend Luca. 'Hey Luca! How are you doing?' 'Good good, thanks! What about you?' 'I'm good too. Hey listen, are you free on Saturday? I want to come over to your place.' 'Saturday... hang on... yeah, I'm free! Come on over!' 'Perfect! I'll get there around three.' 'Okay, I'll be waiting. Oh, bring something to eat, I'm already hungry!' The two friends laugh. 'Sure! I'll bring pizza!' 'You're the best, Marco!' 'I know, I know!' Luca hangs up and smiles. He can't wait to see his friend.",
    "spanish": "Ayer por la tarde Marco llamó a su amigo Luca. '¡Hola Luca! ¿Cómo estás?' 'Bien bien, ¡gracias! ¿Y tú?' 'Yo también estoy bien. Oye, ¿estás libre el sábado? Quiero ir a tu casa.' 'El sábado... espera... ¡sí, estoy libre! ¡Ven!' '¡Perfecto! Llego hacia las tres.' 'Okay, te espero. Ah, trae algo de comer, ¡ya tengo hambre!' Los dos amigos se ríen. '¡Claro! ¡Traigo pizza!' '¡Eres el mejor, Marco!' '¡Ya lo sé, ya lo sé!' Luca cuelga el teléfono y sonríe. Tiene muchas ganas de ver a su amigo.",
    "words": [
      {
        "w": "chiamato",
        "en": "called",
        "es": "llamado",
        "c": "new",
        "n": "From chiamare; no visual link to Spanish llamar — must be learned fresh.",
        "p": "kia-MA-to"
      },
      {
        "w": "libero",
        "en": "free / available",
        "es": "libre",
        "c": "similar",
        "n": "Looks like Spanish libre and means free, but in Italian it also means 'free of charge' in some contexts where Spanish uses gratis, so the overlap is close but not total.",
        "p": "LI-be-ro"
      },
      {
        "w": "aspetta",
        "en": "wait / hang on",
        "es": "espera",
        "c": "new",
        "n": "From aspettare; no resemblance to Spanish esperar — completely different root visually.",
        "p": "a-SPET-ta"
      },
      {
        "w": "fame",
        "en": "hunger",
        "es": "hambre",
        "c": "false-friend",
        "n": "Looks like English 'fame' (fama in Spanish), but in Italian it means hunger, not fame — applying the Spanish instinct gives the wrong meaning entirely.",
        "p": "FA-me"
      },
      {
        "w": "porta",
        "en": "bring (imperative) / door",
        "es": "trae / puerta",
        "c": "false-friend",
        "n": "Resembles Spanish puerta (door) but here it is the imperative of portare meaning bring — a Spanish speaker would guess door and be completely wrong in this context.",
        "p": "POR-ta"
      },
      {
        "w": "migliore",
        "en": "best / better",
        "es": "mejor",
        "c": "similar",
        "n": "Shares the Latin root with Spanish mejor and means better/best, but the spelling difference is significant and Italian uses it in slightly different superlative constructions than Spanish.",
        "p": "mi-LIO-re"
      },
      {
        "w": "sorride",
        "en": "smiles",
        "es": "sonríe",
        "c": "similar",
        "n": "From sorridere; resembles Spanish sonreír in meaning but the Italian form looks quite different, and Italian uses sor- prefix rather than son- so recognition is partial.",
        "p": "sor-RI-de"
      },
      {
        "w": "perfetto",
        "en": "perfect",
        "es": "perfecto",
        "c": "same",
        "n": "Identical in meaning and nearly identical in spelling to Spanish perfecto — safe to transfer directly.",
        "p": "per-FET-to"
      }
    ]
  },
  {
    "id": "beg11",
    "title": "Una serata al ristorante",
    "difficulty": "A2",
    "topic": "cena al ristorante",
    "italian": "Ieri sera sono uscito con la mia ragazza e abbiamo deciso di andare al ristorante vicino a casa nostra. Il cameriere ci ha portato subito il menu e abbiamo scelto un primo di pasta al pomodoro e una pizza margherita da condividere. Da bere abbiamo preso una bottiglia di acqua e un bicchiere di vino rosso per me. Il cibo era buonissimo e il servizio veloce. Alla fine abbiamo chiesto il conto e abbiamo lasciato anche una piccola mancia. Una serata perfetta, ci torneremo sicuramente!",
    "english": "Last night I went out with my girlfriend and we decided to go to the restaurant near our place. The waiter brought us the menu right away and we picked a pasta with tomato sauce and a margherita pizza to share. To drink we got a bottle of water and a glass of red wine for me. The food was amazing and the service was fast. At the end we asked for the bill and even left a small tip. A perfect evening, we will definitely go back!",
    "spanish": "Anoche sali con mi novia y decidimos ir al restaurante cerca de nuestra casa. El camarero nos trajo el menu enseguida y elegimos una pasta con salsa de tomate y una pizza margarita para compartir. Para beber pedimos una botella de agua y una copa de vino tinto para mi. La comida estaba buenisima y el servicio fue rapido. Al final pedimos la cuenta y dejamos tambien una pequena propina. Una noche perfecta, seguramente volveremos!",
    "words": [
      {
        "w": "ristorante",
        "en": "restaurant",
        "es": "restaurante",
        "c": "similar",
        "n": "Almost identical to Spanish restaurante but Italian drops the second r-cluster and ends in -ante; same meaning, just a slightly different spelling pattern that can trip up writers.",
        "p": "ri-sto-RAN-te"
      },
      {
        "w": "cameriere",
        "en": "waiter",
        "es": "camarero",
        "c": "similar",
        "n": "Both come from the same root and mean waiter, but Italian uses -iere ending while Spanish uses -ero; the core meaning is the same but the forms look different enough to cause hesitation.",
        "p": "ca-me-RIERE"
      },
      {
        "w": "menu",
        "en": "menu",
        "es": "menu",
        "c": "same",
        "n": "Identical in both languages, same spelling and meaning in a restaurant context.",
        "p": "me-NU"
      },
      {
        "w": "mancia",
        "en": "tip, gratuity",
        "es": "propina",
        "c": "new",
        "n": "No visual or semantic connection to Spanish propina; Italian uses mancia which comes from an old word for a gift given by hand.",
        "p": "MAN-cia"
      },
      {
        "w": "conto",
        "en": "bill, check",
        "es": "cuenta",
        "c": "false-friend",
        "n": "In Spanish, cuenta can mean bill but also account or story. In Italian, conto also means account or bill, but if a Spanish speaker hears conto and thinks of cuento (story in Spanish), that is completely wrong. Do not confuse conto with cuento.",
        "p": "CON-to"
      },
      {
        "w": "prima",
        "en": "first course",
        "es": "primer plato",
        "c": "new",
        "n": "In Italian, primo (or primo piatto) refers specifically to the first course of a meal like pasta or risotto, a structured concept in Italian dining that does not map directly to any single Spanish word.",
        "p": "PRI-mo"
      },
      {
        "w": "bottiglia",
        "en": "bottle",
        "es": "botella",
        "c": "similar",
        "n": "Both mean bottle and are clearly related, but the Italian form with -iglia looks and sounds noticeably different from Spanish botella, so recognition is not immediate for all learners.",
        "p": "bot-TI-glia"
      },
      {
        "w": "buonissimo",
        "en": "really delicious, amazing",
        "es": "buenisimo",
        "c": "same",
        "n": "Superlative form of buono, directly parallel to Spanish buenisimo in form and meaning.",
        "p": "buo-NIS-si-mo"
      }
    ]
  },
  {
    "id": "beg12",
    "title": "Il treno delle sette e mezza",
    "difficulty": "A2",
    "topic": "un viaggio in treno",
    "italian": "Ieri ho preso il treno delle sette e mezza per andare a Milano. Ero ancora mezzo addormentato quando sono salito sul vagone. Per fortuna avevo il posto prenotato vicino al finestrino, che bello! Ho messo la valigia in alto e mi sono seduto. Il controllore e' passato dopo dieci minuti a timbrare i biglietti. Fuori dal finestrino si vedevano i campi e le montagne lontane. Ho bevuto un caffe' dal carrello e ho ascoltato musica per quasi tutto il viaggio. Siamo arrivati in orario, cosa abbastanza rara, devo dire!",
    "english": "Yesterday I took the seven-thirty train to Milan. I was still half asleep when I got on. Lucky for me I had a reserved window seat — so nice! I put my bag in the overhead rack and sat down. The ticket inspector came around after ten minutes to stamp our tickets. Out the window you could see fields and distant mountains. I had a coffee from the trolley and listened to music for almost the whole trip. We arrived on time, which honestly does not happen that often!",
    "spanish": "Ayer tome el tren de las siete y media para ir a Milan. Todavia estaba medio dormido cuando subi al vagon. Por suerte tenia el asiento reservado junto a la ventanilla, que bien! Puse la maleta arriba y me sente. El revisor paso despues de diez minutos para sellar los billetes. Desde la ventanilla se veian los campos y las montanas lejanas. Tome un cafe del carrito y escuche musica durante casi todo el viaje. Llegamos a tiempo, algo bastante raro, la verdad!",
    "words": [
      {
        "w": "vagone",
        "en": "train carriage",
        "es": "vagon",
        "c": "similar",
        "n": "In Italian vagone refers specifically to a train car; in Spanish vagon can also mean a general wagon or cart in broader contexts, so the Italian use is narrower.",
        "p": "va-GO-ne"
      },
      {
        "w": "controllore",
        "en": "ticket inspector",
        "es": "controlador",
        "c": "false-friend",
        "n": "In Spanish controlador most naturally means controller or air-traffic controller, not a ticket inspector. Applying the Spanish instinct here gives the wrong job.",
        "p": "con-trol-LO-re"
      },
      {
        "w": "finestrino",
        "en": "window (on a vehicle)",
        "es": "ventanilla",
        "c": "new",
        "n": "No visual or root connection to Spanish ventanilla or ventana; Italian uses a diminutive of finestra that Spanish speakers would not recognise.",
        "p": "fi-nes-TRI-no"
      },
      {
        "w": "musica",
        "en": "music",
        "es": "musica",
        "c": "same",
        "n": "Identical in form and meaning in both languages.",
        "p": "MU-si-ca"
      },
      {
        "w": "orario",
        "en": "on time / schedule",
        "es": "horario",
        "c": "similar",
        "n": "Spanish horario means timetable or schedule as a noun. Italian orario shares that sense but is also used as an adjective or in the phrase in orario meaning on time, a usage Spanish horario does not cover.",
        "p": "o-RA-rio"
      },
      {
        "w": "timbrare",
        "en": "to stamp (a ticket)",
        "es": "timbrar",
        "c": "similar",
        "n": "Spanish timbrar means to stamp a document but is less common in everyday speech; in Italian timbrare is the standard everyday verb for validating a ticket, making it more frequent and specific in register.",
        "p": "tim-BRA-re"
      },
      {
        "w": "carrello",
        "en": "trolley / cart",
        "es": "carrito",
        "c": "new",
        "n": "No close visual link to Spanish carrito for an Italian learner; the suffix and root feel different enough that the connection is not transparent.",
        "p": "car-REL-lo"
      },
      {
        "w": "posto",
        "en": "seat / place",
        "es": "puesto",
        "c": "false-friend",
        "n": "Spanish puesto primarily means a stall, post, or job position. Applying that meaning in Italian is wrong here; posto means seat or place, so the Spanish instinct produces an incorrect reading.",
        "p": "PO-sto"
      }
    ]
  },
  {
    "id": "beg13",
    "title": "Finalmente all'albergo!",
    "difficulty": "A2",
    "topic": "il check-in in albergo",
    "italian": "Siamo arrivati in albergo dopo un viaggio lunghissimo. Alla reception, l'impiegato ci ha chiesto il documento e la carta di credito. Abbiamo compilato un modulo veloce e lui ci ha dato le chiavi della camera. La nostra stanza era al terzo piano — per fortuna c'era l'ascensore! Abbiamo lasciato le valigie in camera e siamo scesi subito al bar per un caffè. L'impiegato era gentilissimo e ci ha anche spiegato gli orari della colazione. Tutto è andato liscio, senza problemi. Il check-in in Italia è di solito abbastanza rapido se hai i documenti pronti.",
    "english": "We finally arrived at the hotel after a really long trip. At the front desk, the clerk asked for our ID and credit card. We filled out a quick form and he handed us the room keys. Our room was on the third floor — luckily there was a lift! We dropped our bags in the room and headed straight to the bar for a coffee. The clerk was super friendly and even told us when breakfast was served. Everything went smoothly, no hassle at all. Checking in at Italian hotels is usually pretty quick as long as you have your documents ready.",
    "spanish": "Por fin llegamos al hotel después de un viaje larguísimo. En la recepción, el empleado nos pidió el documento y la tarjeta de crédito. Rellenamos un formulario rápido y nos dio las llaves de la habitación. Nuestra habitación estaba en el tercer piso — ¡menos mal que había ascensor! Dejamos las maletas en la habitación y bajamos enseguida al bar a tomar un café. El empleado era simpatiquísimo y también nos explicó los horarios del desayuno. Todo fue sobre ruedas, sin problemas. El check-in en Italia suele ser bastante rápido si tienes los documentos listos.",
    "words": [
      {
        "w": "documento",
        "en": "ID document",
        "es": "documento",
        "c": "same",
        "n": "Identical in both form and meaning across Italian and Spanish.",
        "p": "do-CU-men-to"
      },
      {
        "w": "camera",
        "en": "hotel room",
        "es": "cámara",
        "c": "false-friend",
        "n": "In Spanish, cámara means camera or chamber; in Italian, camera is the everyday word for a room, especially a bedroom or hotel room — not a camera (that is macchina fotografica).",
        "p": "CA-me-ra"
      },
      {
        "w": "piano",
        "en": "floor / storey",
        "es": "plano / piso",
        "c": "similar",
        "n": "Spanish plano means flat or a map; Italian piano covers floor/storey (like Spanish piso) but also means slow or softly in music — broader than any single Spanish equivalent.",
        "p": "PIA-no"
      },
      {
        "w": "ascensore",
        "en": "lift / elevator",
        "es": "ascensor",
        "c": "similar",
        "n": "Very close to Spanish ascensor and means the same thing, but the Italian ending -e and slightly different spelling can trip up learners; usage and meaning fully overlap.",
        "p": "a-schen-SO-re"
      },
      {
        "w": "colazione",
        "en": "breakfast",
        "es": "colación",
        "c": "false-friend",
        "n": "In Spanish, colación is a light snack or a formal allowance; in Italian, colazione is simply breakfast (or sometimes lunch in southern regions) — applying the Spanish meaning here would be actively wrong.",
        "p": "co-la-TSIO-ne"
      },
      {
        "w": "liscio",
        "en": "smooth / without problems",
        "es": "liso",
        "c": "similar",
        "n": "Spanish liso means smooth or straight (hair); Italian liscio shares that sense but is also used idiomatically as andare liscio meaning to go smoothly or without a hitch — a colloquial extension Spanish liso does not have.",
        "p": "LI-shyo"
      },
      {
        "w": "chiavi",
        "en": "keys",
        "es": "llaves",
        "c": "new",
        "n": "No visual connection to Spanish llaves; Italian uses chiavi, from Latin clavis, while the ch- spelling sounds like k — a completely different-looking word for the same object.",
        "p": "KIA-vi"
      },
      {
        "w": "modulo",
        "en": "form / paperwork",
        "es": "formulario",
        "c": "new",
        "n": "Spanish uses formulario for a form to fill in; Italian modulo looks like English module and has no strong visual link to the common Spanish word — learners must simply learn it.",
        "p": "MO-du-lo"
      }
    ]
  },
  {
    "id": "beg14",
    "title": "Dal farmacista con il raffreddore",
    "difficulty": "A2",
    "topic": "in farmacia per un raffreddore",
    "italian": "Ieri mi sono svegliato con il naso che colava e la gola tutta infiammata. Che schifo! Sono andato subito in farmacia e ho detto alla farmacista: 'Guardi, mi sento uno schifo, ho il raffreddore da ieri sera.' Lei mi ha chiesto se avevo anche la febbre. Le ho detto di no, solo un po' di mal di testa. Allora mi ha consigliato uno sciroppo per la tosse e delle pastiglie per la gola. Mi ha anche detto di bere tanta acqua e di stare a casa al caldo. Meno male che la farmacia era aperta!",
    "english": "Yesterday I woke up with a runny nose and a really sore throat. Gross! I went straight to the pharmacy and told the pharmacist: 'Look, I feel terrible, I've had a cold since last night.' She asked if I also had a fever. I told her no, just a bit of a headache. So she recommended a cough syrup and some throat lozenges. She also told me to drink plenty of water and stay home and keep warm. Thank goodness the pharmacy was open!",
    "spanish": "Ayer me desperté con la nariz que me goteaba y la garganta muy inflamada. ¡Qué asco! Fui directamente a la farmacia y le dije a la farmacéutica: 'Mire, me siento fatal, tengo un resfriado desde anoche.' Ella me preguntó si también tenía fiebre. Le dije que no, solo un poco de dolor de cabeza. Entonces me recomendó un jarabe para la tos y unas pastillas para la garganta. También me dijo que bebiera mucha agua y que me quedara en casa abrigado. ¡Menos mal que la farmacia estaba abierta!",
    "words": [
      {
        "w": "farmacia",
        "en": "pharmacy",
        "es": "farmacia",
        "c": "same",
        "n": "Identical in both languages, same meaning exactly.",
        "p": "far-MA-cia"
      },
      {
        "w": "infiammata",
        "en": "inflamed, sore",
        "es": "inflamada",
        "c": "similar",
        "n": "Very close to Spanish 'inflamada', but in Italian it's more commonly used for throats and body parts in everyday speech, while Spanish 'inflamado' is also widely used for swelling from injury.",
        "p": "in-fiam-MA-ta"
      },
      {
        "w": "pastiglia",
        "en": "tablet, lozenge, pill",
        "es": "pastilla",
        "c": "similar",
        "n": "Looks like Spanish 'pastilla', and the core meaning overlaps, but in Italian it often refers specifically to hard lozenges or throat tablets, while 'pastilla' in Spanish is the general everyday word for any pill or tablet.",
        "p": "pas-TI-glia"
      },
      {
        "w": "sciroppo",
        "en": "syrup",
        "es": "jarabe",
        "c": "new",
        "n": "No visual or root connection to Spanish 'jarabe'. Italian uses a completely different word derived from Arabic via medieval Latin.",
        "p": "sci-ROP-po"
      },
      {
        "w": "tosse",
        "en": "cough",
        "es": "tos",
        "c": "similar",
        "n": "Resembles Spanish 'tos' and means the same thing, but Italian 'tosse' is a noun only, whereas Spanish 'tos' is also used in some compound expressions differently. Minor structural difference.",
        "p": "TOS-se"
      },
      {
        "w": "febbre",
        "en": "fever",
        "es": "fiebre",
        "c": "similar",
        "n": "Close to Spanish 'fiebre' and means the same, but the vowel pattern differs and Italian speakers may drop the article in some expressions like 'ho febbre', which would sound odd translated directly to Spanish.",
        "p": "FEB-bre"
      },
      {
        "w": "meno male",
        "en": "thank goodness, luckily",
        "es": "menos mal",
        "c": "false-friend",
        "n": "Looks like Spanish 'menos mal' which also means 'thank goodness', but in Italian the phrase is far more commonly used to express relief in everyday speech and can sound more emphatic or even sarcastic depending on context, unlike Spanish where it's more neutral.",
        "p": "ME-no MA-le"
      },
      {
        "w": "schifo",
        "en": "disgust, something gross or awful",
        "es": "asco",
        "c": "new",
        "n": "No connection to Spanish 'asco'. Completely different root. 'Che schifo!' is the Italian equivalent of '¡Qué asco!' but the words share no visual similarity.",
        "p": "SKI-fo"
      }
    ]
  },
  {
    "id": "beg15",
    "title": "Una giornata al mare",
    "difficulty": "A2",
    "topic": "una giornata al mare",
    "italian": "Ieri siamo andati al mare con tutta la famiglia. Ci siamo svegliati presto, abbiamo messo tutto in macchina e via! La spiaggia era già abbastanza piena, ma abbiamo trovato un posto carino vicino all'acqua. I bambini hanno giocato con la sabbia per ore, mentre io e mia moglie ci siamo rilassati sotto l'ombrellone. A pranzo abbiamo mangiato un bel panino con il prosciutto — buonissimo! Nel pomeriggio il mare era calmo e l'acqua fresca, perfetta per nuotare. Siamo tornati a casa stanchi ma felici. Una giornata proprio bella!",
    "english": "Yesterday we went to the beach with the whole family. We woke up early, packed everything into the car, and off we went! The beach was already pretty crowded, but we found a nice spot near the water. The kids played in the sand for hours while my wife and I relaxed under the beach umbrella. For lunch we had a great ham sandwich — absolutely delicious! In the afternoon the sea was calm and the water cool, perfect for swimming. We got home tired but happy. What a great day!",
    "spanish": "Ayer fuimos a la playa con toda la familia. Nos despertamos temprano, metimos todo en el coche y ¡nos fuimos! La playa ya estaba bastante llena, pero encontramos un lugar bonito cerca del agua. Los niños jugaron en la arena durante horas, mientras mi esposa y yo nos relajamos bajo la sombrilla. Para el almuerzo comimos un rico sándwich de jamón, ¡buenísimo! Por la tarde el mar estaba tranquilo y el agua fresca, perfecta para nadar. Volvimos a casa cansados pero felices. ¡Un día realmente hermoso!",
    "words": [
      {
        "w": "spiaggia",
        "en": "beach",
        "es": "playa",
        "c": "new",
        "n": "No visual connection to 'playa' — must be learned from scratch.",
        "p": "SPYAD-ja"
      },
      {
        "w": "sabbia",
        "en": "sand",
        "es": "arena",
        "c": "new",
        "n": "Completely different from 'arena' — no shared root visible at A2 level.",
        "p": "SAB-bya"
      },
      {
        "w": "prosciutto",
        "en": "cured ham",
        "es": "jamón",
        "c": "new",
        "n": "Italian cured ham — no resemblance to 'jamón'; a false cognate trap to avoid.",
        "p": "pro-SHOO-tto"
      },
      {
        "w": "ombrellone",
        "en": "beach umbrella",
        "es": "sombrilla",
        "c": "similar",
        "n": "Both come from 'umbrella/sombra' roots, but 'ombrellone' specifically means a large beach umbrella, not just any small umbrella ('ombrello').",
        "p": "om-brel-LO-ne"
      },
      {
        "w": "calmo",
        "en": "calm",
        "es": "calmo/tranquilo",
        "c": "same",
        "n": "Identical in spelling and meaning to Italian and used in some Spanish varieties; fully equivalent.",
        "p": "CAL-mo"
      },
      {
        "w": "largo",
        "en": "wide, broad",
        "es": "largo",
        "c": "false-friend",
        "n": "In Spanish 'largo' means long, but in Italian it means wide or broad — applying the Spanish meaning here would be actively wrong.",
        "p": "LAR-go"
      },
      {
        "w": "famiglia",
        "en": "family",
        "es": "familia",
        "c": "similar",
        "n": "Very close to 'familia' but the double-l spelling and slightly formal feel differ; meaning fully transfers but spelling can mislead learners.",
        "p": "fa-MIL-ya"
      },
      {
        "w": "carino",
        "en": "nice, cute, sweet",
        "es": "cariño",
        "c": "false-friend",
        "n": "Spanish 'cariño' means affection or darling (a noun/term of endearment), but Italian 'carino' is an adjective meaning nice or cute — different part of speech and usage.",
        "p": "ka-REE-no"
      }
    ]
  },
  {
    "id": "beg16",
    "title": "Cena da Marco",
    "difficulty": "A2",
    "topic": "una cena a casa di un amico",
    "italian": "Sabato sera sono andato a cena da Marco, un mio amico del lavoro. Abitava in un appartamento carino al terzo piano. Appena sono entrato, sentivo già un profumo incredibile dalla cucina. Ha cucinato la pasta al pomodoro e una bistecca con le patate. Tutto era buonissimo, davvero. Abbiamo bevuto un po' di vino rosso e parlato per ore. Alla fine ci ha portato un tiramisù fatto in casa — assurdo quanto era buono. Siamo rimasti lì fino a mezzanotte passata. È stata una serata bellissima, rilassata, senza stress. Devo invitarlo a casa mia la prossima volta!",
    "english": "Last Saturday I went to dinner at Marco's place, a friend from work. He lived in a nice apartment on the third floor. As soon as I walked in, I could already smell something amazing coming from the kitchen. He made pasta with tomato sauce and a steak with potatoes. Everything was absolutely delicious. We had some red wine and talked for hours. At the end he brought out a homemade tiramisù — insanely good. We stayed there until well past midnight. It was a really lovely, relaxed evening with no stress at all. I need to have him over to my place next time!",
    "spanish": "El sábado por la noche fui a cenar a casa de Marco, un amigo del trabajo. Vivía en un apartamento bonito en el tercer piso. Nada más entrar, ya olía increíble desde la cocina. Preparó pasta con tomate y un filete con patatas. Todo estaba buenísimo, de verdad. Tomamos un poco de vino tinto y hablamos durante horas. Al final nos trajo un tiramisú casero — una locura lo bueno que estaba. Nos quedamos allí hasta pasada la medianoche. Fue una velada preciosa, relajada, sin estrés. ¡Tengo que invitarlo a mi casa la próxima vez!",
    "words": [
      {
        "w": "appartamento",
        "en": "apartment, flat",
        "es": "apartamento",
        "c": "similar",
        "n": "Very close to Spanish 'apartamento' but in Italian this is the standard word for any rented or owned flat, while in Spanish 'apartamento' often implies a smaller or holiday unit; Italians use 'appartamento' for all home types.",
        "p": "ap-par-ta-MEN-to"
      },
      {
        "w": "cucina",
        "en": "kitchen / cooking / cuisine",
        "es": "cocina",
        "c": "same",
        "n": "Identical in form and meaning to Spanish 'cocina' — refers to both the room and the act of cooking.",
        "p": "cu-CI-na"
      },
      {
        "w": "profumo",
        "en": "scent, fragrance, perfume",
        "es": "perfume",
        "c": "similar",
        "n": "Looks like Spanish 'perfume' and shares the sense of fragrance, but 'profumo' is the everyday Italian word for any pleasant smell — food, flowers, air — not just bottled perfume. Spanish 'perfume' is narrower.",
        "p": "pro-FU-mo"
      },
      {
        "w": "burro",
        "en": "butter",
        "es": "mantequilla",
        "c": "false-friend",
        "n": "Looks exactly like Spanish 'burro' meaning donkey, but in Italian it means butter. Completely different meaning — applying the Spanish instinct here gives the wrong answer entirely.",
        "p": "BUR-ro"
      },
      {
        "w": "serata",
        "en": "evening (as an experience or event)",
        "es": "velada",
        "c": "new",
        "n": "No strong visual link to a common Spanish word. 'Sera' means evening but 'serata' refers to an evening spent doing something, similar to Spanish 'velada'. Not related to 'tarde' or 'noche' visually.",
        "p": "se-RA-ta"
      },
      {
        "w": "mezzanotte",
        "en": "midnight",
        "es": "medianoche",
        "c": "similar",
        "n": "Structurally parallel to Spanish 'medianoche' (both mean middle-of-the-night), but the Italian halves are 'mezza' (half) + 'notte' (night), so the spelling looks quite different. Meaning transfers perfectly but form requires learning.",
        "p": "mez-za-NOT-te"
      },
      {
        "w": "assurdo",
        "en": "absurd, crazy, unbelievable",
        "es": "absurdo",
        "c": "same",
        "n": "Visually and semantically identical to Spanish 'absurdo'. In colloquial Italian it is also used as a positive intensifier, much like Spanish slang use of 'absurdo'.",
        "p": "as-SUR-do"
      },
      {
        "w": "fino a",
        "en": "until, up to",
        "es": "hasta",
        "c": "new",
        "n": "No visual connection to Spanish 'hasta'. Italian uses 'fino a' as the standard way to say 'until' or 'up to' in time and space contexts.",
        "p": "FI-no a"
      }
    ]
  },
  {
    "id": "beg17",
    "title": "Una giornata in ufficio",
    "difficulty": "A2",
    "topic": "il mio lavoro in ufficio",
    "italian": "Lavoro in un ufficio nel centro della città. Arrivo alle nove meno un quarto e la prima cosa che faccio è accendere il computer. Ho tante riunioni durante la settimana — a volte troppe! Il mio capo è abbastanza simpatico, ma ci dà sempre un sacco di lavoro. A pranzo di solito esco con i colleghi e mangiamo qualcosa di veloce. Nel pomeriggio rispondo alle email e preparo i documenti per i clienti. Alle sei stacco e torno a casa stanca, ma contenta. È un lavoro normale, niente di speciale, però mi piace.",
    "english": "I work in an office in the city center. I arrive at quarter to nine and the first thing I do is turn on my computer. I have lots of meetings during the week — sometimes too many! My boss is pretty nice, but always gives us a ton of work. At lunch I usually go out with my colleagues and we grab something quick. In the afternoon I answer emails and prepare documents for clients. At six I clock out and go home tired but happy. It's a normal job, nothing special, but I like it.",
    "spanish": "Trabajo en una oficina en el centro de la ciudad. Llego a las nueve menos cuarto y lo primero que hago es encender el ordenador. Tengo muchas reuniones durante la semana — ¡a veces demasiadas! Mi jefe es bastante simpático, pero siempre nos da un montón de trabajo. A la hora de comer suelo salir con mis compañeros y comemos algo rápido. Por la tarde respondo correos y preparo documentos para los clientes. A las seis termino y vuelvo a casa cansada pero contenta. Es un trabajo normal, nada especial, pero me gusta.",
    "words": [
      {
        "w": "ufficio",
        "en": "office",
        "es": "oficina",
        "c": "similar",
        "n": "In Spanish 'oficina' is the only word; in Italian 'ufficio' also means 'duty' or 'function' (e.g. in a formal or religious sense), a sense 'oficina' never carries.",
        "p": "uf-FI-cio"
      },
      {
        "w": "simpatico",
        "en": "nice, likeable",
        "es": "simpático",
        "c": "same",
        "n": "Identical spelling (minus accent) and identical meaning in both languages — a genuinely likeable person.",
        "p": "sim-PA-ti-co"
      },
      {
        "w": "colleghi",
        "en": "colleagues, coworkers",
        "es": "colegas",
        "c": "similar",
        "n": "Core meaning matches Spanish 'colegas', but in Italian 'colleghi' is strictly professional; Spanish 'colegas' can informally mean close friends, which 'colleghi' does not.",
        "p": "col-LE-ghi"
      },
      {
        "w": "riunione",
        "en": "meeting",
        "es": "reunión",
        "c": "similar",
        "n": "Looks like Spanish 'reunión' and shares the sense of people gathering, but in Italian it is the standard word for a work meeting, whereas Spanish 'reunión' is broader and more casual.",
        "p": "riu-nio-NE"
      },
      {
        "w": "staccare",
        "en": "to clock out, to stop work",
        "es": "desconectar / salir del trabajo",
        "c": "new",
        "n": "No visual link to Spanish. Literally means 'to detach'; colloquially used to mean finishing the workday. Spanish uses 'salir del trabajo' or 'desconectar'.",
        "p": "stac-CA-re"
      },
      {
        "w": "capo",
        "en": "boss, head",
        "es": "jefe",
        "c": "false-friend",
        "n": "Spanish speakers may think of 'cabo' (corporal, cape) or not recognise it at all. In Italian 'capo' is the everyday word for boss or leader — using 'jefe' logic here gives the wrong word entirely.",
        "p": "CA-po"
      },
      {
        "w": "documenti",
        "en": "documents, files",
        "es": "documentos",
        "c": "same",
        "n": "Visually near-identical to Spanish 'documentos' and fully equivalent in meaning with no added or missing senses.",
        "p": "do-cu-MEN-ti"
      },
      {
        "w": "accendere",
        "en": "to turn on, to switch on",
        "es": "encender",
        "c": "similar",
        "n": "Shares the meaning of 'encender' (to turn on/light), but Italian 'accendere' is also commonly used for starting a car engine, a usage where Spanish would prefer 'arrancar'.",
        "p": "ac-CEN-de-re"
      }
    ]
  },
  {
    "id": "beg18",
    "title": "Come organizzare una festa di compleanno",
    "difficulty": "A2",
    "topic": "organizzare una festa di compleanno",
    "italian": "Allora, il compleanno di Marco è sabato e vogliamo fare una bella festa! Prima di tutto, dobbiamo scegliere il posto — a casa sua o in un locale? Poi mandiamo i messaggi agli amici e vediamo chi viene. Per il cibo, ordiniamo delle pizze e compriamo una torta al cioccolato. Non dimenticare le candele! Per i decorazioni, bastano palloncini colorati e qualche festoncino. La musica è importante — fai una playlist carina su Spotify. E il regalo? Meglio raccogliere i soldi insieme e prendere qualcosa di bello. Vedrai, sarà una serata fantastica!",
    "english": "So, Marco's birthday is on Saturday and we want to throw a great party! First of all, we need to pick a place — his place or a venue? Then we send messages to friends and see who can make it. For food, we'll order some pizzas and buy a chocolate cake. Don't forget the candles! For decorations, colorful balloons and a few streamers are enough. Music matters — make a nice playlist on Spotify. And the gift? Better to pool money together and get something nice. You'll see, it's going to be a great night!",
    "spanish": "Bueno, el cumpleaños de Marco es el sábado y queremos hacer una gran fiesta. Primero que todo, hay que elegir el lugar — ¿en su casa o en un local? Luego mandamos mensajes a los amigos y vemos quién puede venir. Para la comida, pedimos unas pizzas y compramos una torta de chocolate. ¡No olvides las velas! Para la decoración, bastan globos de colores y algunas guirnaldas. La música es importante — haz una buena playlist en Spotify. ¿Y el regalo? Mejor juntar el dinero entre todos y comprar algo lindo. ¡Ya verás, será una noche fantástica!",
    "words": [
      {
        "w": "compleanno",
        "en": "birthday",
        "es": "cumpleaños",
        "c": "new",
        "n": "No visual connection to Spanish 'cumpleaños'; comes from 'compiere gli anni' (to complete one's years)",
        "p": "com-ple-AN-no"
      },
      {
        "w": "locale",
        "en": "venue / place",
        "es": "local",
        "c": "false-friend",
        "n": "In Spanish 'local' often means a commercial premises or shop, which is close, but Italian 'locale' more broadly means any venue or place, and in everyday speech it specifically refers to a bar, club, or restaurant — not a generic adjective as Spanish speakers might expect",
        "p": "lo-CA-le"
      },
      {
        "w": "scegliere",
        "en": "to choose",
        "es": "elegir",
        "c": "new",
        "n": "No visual link to Spanish 'elegir'; Italian uses this verb for everyday choices and it must be learned from scratch",
        "p": "SCHE-lye-re"
      },
      {
        "w": "raccogliere",
        "en": "to collect / to gather",
        "es": "recoger",
        "c": "similar",
        "n": "Both share the idea of collecting or gathering, but Italian 'raccogliere' also specifically means to harvest crops and to pick up something from the ground, uses that Spanish 'recoger' covers but with less emphasis on harvesting",
        "p": "rac-CO-lye-re"
      },
      {
        "w": "candele",
        "en": "candles",
        "es": "velas",
        "c": "new",
        "n": "No connection to Spanish 'velas'; Italian uses a completely different root",
        "p": "can-DE-le"
      },
      {
        "w": "musica",
        "en": "music",
        "es": "música",
        "c": "same",
        "n": "Identical in meaning and nearly identical in spelling; just note the stress falls one syllable earlier in Italian",
        "p": "MU-si-ca"
      },
      {
        "w": "fantastica",
        "en": "fantastic / amazing",
        "es": "fantástica",
        "c": "same",
        "n": "Same meaning and spelling; only the accent mark differs between the two languages",
        "p": "fan-TAS-ti-ca"
      },
      {
        "w": "palloncini",
        "en": "balloons",
        "es": "globos",
        "c": "new",
        "n": "No visual connection to Spanish 'globos'; 'palloncino' is a diminutive of 'pallone' (big ball) and must be learned as a new word",
        "p": "pal-lon-CI-ni"
      }
    ]
  },
  {
    "id": "beg19",
    "title": "Un weekend in campagna",
    "difficulty": "A2",
    "topic": "un weekend in campagna",
    "italian": "Questo weekend siamo andati in campagna da mia zia. Abitava in una casetta piccola piccola, con un orto enorme e tanti animali. Sabato mattina abbiamo fatto una passeggiata nel bosco e poi abbiamo mangiato fuori, sotto un albero grande. C'era il pane fatto in casa, il formaggio locale e il vino della zona. La sera abbiamo acceso un fuoco e abbiamo chiacchierato fino a tardi. Domenica invece siamo rimasti a riposare. Niente telefono, niente stress. Tornare in città è stato un po' triste, ma ne valeva davvero la pena.",
    "english": "This weekend we went to the countryside to visit my aunt. She lived in a tiny little house with a huge vegetable garden and loads of animals. Saturday morning we went for a walk in the woods and then ate outside under a big tree. There was homemade bread, local cheese, and wine from the area. In the evening we lit a fire and chatted until late. Sunday we just stayed home and rested. No phone, no stress. Coming back to the city was a bit sad, but it was totally worth it.",
    "spanish": "Este fin de semana fuimos al campo a casa de mi tía. Vivía en una casita pequeñísima, con un huerto enorme y muchos animales. El sábado por la mañana dimos un paseo por el bosque y luego comimos afuera, bajo un árbol grande. Había pan casero, queso local y vino de la zona. Por la noche encendimos un fuego y charlamos hasta tarde. El domingo nos quedamos a descansar. Sin teléfono, sin estrés. Volver a la ciudad fue un poco triste, pero realmente valió la pena.",
    "words": [
      {
        "w": "campagna",
        "en": "countryside",
        "es": "campo / campaña",
        "c": "false-friend",
        "n": "In Spanish 'campaña' means campaign or military campaign, not countryside. Italian 'campagna' means the rural countryside, so applying the Spanish meaning gives a completely wrong result.",
        "p": "cam-PA-gna"
      },
      {
        "w": "formaggio",
        "en": "cheese",
        "es": "queso",
        "c": "new",
        "n": "No visual or root connection to Spanish 'queso'. Comes from Latin 'formaticum'. Must be memorised from scratch.",
        "p": "for-MAG-gio"
      },
      {
        "w": "locale",
        "en": "local",
        "es": "local",
        "c": "same",
        "n": "Identical spelling and meaning in both languages. Refers to something belonging to a specific place or area.",
        "p": "lo-CA-le"
      },
      {
        "w": "passeggiata",
        "en": "walk / stroll",
        "es": "paseo",
        "c": "new",
        "n": "No resemblance to Spanish 'paseo'. Comes from 'passeggiare'. The concept is the same but the word looks completely different.",
        "p": "pas-seg-GIA-ta"
      },
      {
        "w": "bosco",
        "en": "wood / forest",
        "es": "bosque",
        "c": "similar",
        "n": "Closely related to Spanish 'bosque' and means the same thing, but in Italian 'bosco' typically refers to a smaller, lighter woodland, while 'bosque' in Spanish can cover larger forests too.",
        "p": "BO-sco"
      },
      {
        "w": "acceso",
        "en": "lit / switched on",
        "es": "encendido / acceso",
        "c": "false-friend",
        "n": "In Spanish 'acceso' means access or entry. In Italian 'acceso' is the past participle of 'accendere' meaning to light or switch on. Using the Spanish meaning here would be completely wrong.",
        "p": "ac-CE-so"
      },
      {
        "w": "chiacchierato",
        "en": "chatted",
        "es": "charlado / platicado",
        "c": "new",
        "n": "No connection to Spanish 'charlar' or 'platicar'. The root is distinctly Italian. The double letters and unusual spelling make it look unlike anything in Spanish.",
        "p": "chiac-chie-RA-to"
      },
      {
        "w": "stress",
        "en": "stress",
        "es": "estrés",
        "c": "same",
        "n": "An anglicism used identically in both Italian and Spanish with the same meaning and register.",
        "p": "STRESS"
      }
    ]
  },
  {
    "id": "beg20",
    "title": "Dal dottore: non mi sento bene",
    "difficulty": "A2",
    "topic": "un appuntamento dal medico",
    "italian": "Stamattina mi sono svegliato con un mal di testa tremendo e la gola che bruciava. Ho chiamato il medico e per fortuna c'era un posto libero nel pomeriggio. Sono andato allo studio e ho aspettato un po' in sala d'attesa. La dottoressa mi ha visitato, mi ha fatto aprire la bocca e mi ha detto che avevo un'infezione alla gola. Niente di grave, per fortuna! Mi ha scritto una ricetta per degli antibiotici e mi ha detto di riposare e bere tanta acqua. Domani spero di stare meglio.",
    "english": "This morning I woke up with a terrible headache and a sore throat. I called the doctor and luckily there was an opening in the afternoon. I went to the office and waited a bit in the waiting room. The doctor examined me, asked me to open my mouth, and told me I had a throat infection. Nothing serious, thankfully! She wrote me a prescription for antibiotics and told me to rest and drink plenty of water. I hope I feel better tomorrow.",
    "spanish": "Esta mañana me desperté con un dolor de cabeza tremendo y la garganta que me ardía. Llamé al médico y por suerte había un hueco por la tarde. Fui al consultorio y esperé un rato en la sala de espera. La doctora me examinó, me pidió que abriera la boca y me dijo que tenía una infección en la garganta. ¡Nada grave, por suerte! Me escribió una receta para antibióticos y me dijo que descansara y bebiera mucha agua. Espero sentirme mejor mañana.",
    "words": [
      {
        "w": "medico",
        "en": "doctor",
        "es": "médico",
        "c": "same",
        "n": "Identical in meaning and usage to Spanish médico.",
        "p": "ME-di-co"
      },
      {
        "w": "infezione",
        "en": "infection",
        "es": "infección",
        "c": "similar",
        "n": "Very close to Spanish infección, but in Italian it can also refer broadly to any microbial contamination in clinical contexts where Spanish might prefer contagio.",
        "p": "in-fet-TSYO-ne"
      },
      {
        "w": "ricetta",
        "en": "prescription",
        "es": "receta",
        "c": "false-friend",
        "n": "In Spanish, receta means recipe (for food) first; in Italian, ricetta means both prescription AND recipe, but when a doctor gives you one, it always means prescription — the Spanish food sense can mislead you in a medical context.",
        "p": "ri-CHET-ta"
      },
      {
        "w": "studio",
        "en": "doctor's office",
        "es": "consultorio",
        "c": "false-friend",
        "n": "Spanish speakers expect estudio to mean a place of study; in Italian, studio also means a professional's office (doctor, lawyer, architect), a meaning Spanish estudio does not carry.",
        "p": "STU-dyo"
      },
      {
        "w": "grave",
        "en": "serious / severe",
        "es": "grave",
        "c": "same",
        "n": "Identical spelling and meaning in both languages in a medical context.",
        "p": "GRA-ve"
      },
      {
        "w": "sala d'attesa",
        "en": "waiting room",
        "es": "sala de espera",
        "c": "new",
        "n": "Attesa (waiting) comes from attendere; Spanish uses espera from esperar — no visual connection between attesa and espera.",
        "p": "SA-la dat-TE-za"
      },
      {
        "w": "bruciare",
        "en": "to burn / to sting",
        "es": "arder / escocer",
        "c": "new",
        "n": "No link to Spanish arder or escocer; Italian bruciare comes from a different root and must be learned fresh.",
        "p": "bru-CHA-re"
      },
      {
        "w": "antibiotici",
        "en": "antibiotics",
        "es": "antibióticos",
        "c": "similar",
        "n": "Very close to Spanish antibióticos; the Italian plural ending -ici instead of -icos is the only difference, and the meaning is fully equivalent, but the pronunciation shift (hard c sound) can trip up learners.",
        "p": "an-ti-byo-TI-chi"
      }
    ]
  }
];
