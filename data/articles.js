const articles = [
  {
    id: 1,
    title: "Una mattina a Roma",
    difficulty: "B1",
    topic: "Daily life",
    italian: `Stamattina mi sono svegliato tardi, come al solito. Ho preso un caffè veloce al bar sotto casa — uno di quei caffè forti e brevi che ti rimettono in piedi. Fuori c'era già un sole decente, ma l'aria era ancora fresca. Ho camminato fino alla piazza, passando davanti a una chiesa vecchissima che non avevo mai visitato. Un turista straniero mi ha chiesto la direzione per il Colosseo. Sul bancone del bar vicino c'era ancora del burro accanto ai cornetti. Fuori, un ragazzo urlava al telefono — caldo come sempre, anche d'inverno.`,
    english: `This morning I woke up late, as usual. I had a quick coffee at the bar downstairs — one of those short, strong Italian coffees that get you back on your feet. Outside there was already a decent sun, but the air was still fresh. I walked to the piazza, passing in front of a very old church I had never visited. A foreign tourist asked me for directions to the Colosseum. On the counter of the nearby bar there was still some butter next to the croissants. Outside, a guy was yelling on the phone — heated as always, even in winter.`,
    spanish: `Esta mañana me desperté tarde, como de costumbre. Tomé un café rápido en el bar de abajo — uno de esos cafés cortos y fuertes que te vuelven a poner de pie. Afuera ya había un sol decente, pero el aire todavía estaba fresco. Caminé hasta la plaza, pasando frente a una iglesia antiquísima que nunca había visitado. Un turista extranjero me preguntó la dirección al Coliseo. En el mostrador del bar cercano todavía había mantequilla junto a los cruasanes. Afuera, un chico gritaba por teléfono — acalorado como siempre, hasta en invierno.`,
    words: [
      { word: "caffè",      english: "coffee",                      spanish: "café",            category: "cognate"      },
      { word: "turista",    english: "tourist",                     spanish: "turista",         category: "cognate"      },
      { word: "decente",    english: "decent",                      spanish: "decente",         category: "cognate"      },
      { word: "direzione",  english: "direction",                   spanish: "dirección",       category: "cognate"      },
      { word: "burro",      english: "butter",                      spanish: "mantequilla",     category: "false-friend" },
      { word: "caldo",      english: "hot / warm",                  spanish: "caliente",        category: "false-friend" },
      { word: "già",        english: "already",                     spanish: "ya",              category: "divergence"   },
      { word: "ancora",     english: "still / yet / again",         spanish: "todavía / aún",   category: "divergence"   },
      { word: "preso",      english: "taken / had (food or drink)", spanish: "tomé / tomado",   category: "new"          },
      { word: "svegliato",  english: "woken up",                    spanish: "despertado",      category: "new"          }
    ]
  }
];
