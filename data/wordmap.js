// Flat lookup keyed by Italian word (lowercase).
// Used by the tokenizer for fast tooltip rendering.
const wordmap = {
  "caffè": {
    english:     "coffee",
    spanish:     "café",
    note:        null,
    category:    "cognate",
    label:       "Cognate",
    pronunciation: "kaf-FÈ",
    example:     "Ho preso un caffè al bar stamattina.",
    exampleEN:   "I had a coffee at the bar this morning."
  },
  "turista": {
    english:     "tourist",
    spanish:     "turista",
    note:        null,
    category:    "cognate",
    label:       "Cognate",
    pronunciation: "tu-RÌS-ta",
    example:     "Tanti turisti visitano Roma ogni anno.",
    exampleEN:   "Many tourists visit Rome every year."
  },
  "decente": {
    english:     "decent",
    spanish:     "decente",
    note:        null,
    category:    "cognate",
    label:       "Cognate",
    pronunciation: "de-CHÈN-te",
    example:     "Il ristorante era decente, niente di speciale.",
    exampleEN:   "The restaurant was decent, nothing special."
  },
  "direzione": {
    english:     "direction",
    spanish:     "dirección",
    note:        null,
    category:    "cognate",
    label:       "Cognate",
    pronunciation: "di-ret-TSYÒ-ne",
    example:     "Sai indicarmi la direzione per il centro?",
    exampleEN:   "Can you point me toward the center?"
  },
  "burro": {
    english:     "butter",
    spanish:     "mantequilla",
    note:        "In Spanish, 'burro' means donkey — not butter.",
    category:    "false-friend",
    label:       "False Friend",
    pronunciation: "BUR-ro",
    example:     "Aggiungi il burro quando la padella è calda.",
    exampleEN:   "Add the butter when the pan is hot."
  },
  "caldo": {
    english:     "hot / warm",
    spanish:     "caliente",
    note:        "In Spanish, 'caldo' means broth or stock — not heat.",
    category:    "false-friend",
    label:       "False Friend",
    pronunciation: "KÀL-do",
    example:     "Fa molto caldo oggi, meglio restare all'ombra.",
    exampleEN:   "It's very hot today, better stay in the shade."
  },
  "già": {
    english:     "already",
    spanish:     "ya",
    note:        "Italian uses 'già' more broadly than Spanish 'ya' — also for emphasis and as a conversational filler.",
    category:    "divergence",
    label:       "Divergence",
    pronunciation: "JÀ",
    example:     "Hai già mangiato? È ancora presto.",
    exampleEN:   "Have you already eaten? It's still early."
  },
  "ancora": {
    english:     "still / yet / again",
    spanish:     "todavía / aún",
    note:        "Looks like 'ancla' (anchor) in Spanish — false visual cognate. Means still, yet, or again in Italian.",
    category:    "divergence",
    label:       "Divergence",
    pronunciation: "an-KÒ-ra",
    example:     "Sei ancora sveglio? È tardissimo.",
    exampleEN:   "Are you still awake? It's very late."
  },
  "preso": {
    english:     "taken / had (food or drink)",
    spanish:     "tomé / tomado",
    note:        "Italian uses 'prendere' (to take) where Spanish uses 'tomar' — same semantic slot, different verb.",
    category:    "new",
    label:       "New Word",
    pronunciation: "PRÈ-zo",
    example:     "Ho preso un cappuccino e un cornetto.",
    exampleEN:   "I had a cappuccino and a croissant."
  },
  "svegliato": {
    english:     "woken up",
    spanish:     "despertado",
    note:        "From 'svegliarsi' — a reflexive verb. Its past tense is built with 'essere': mi sono svegliato.",
    category:    "new",
    label:       "New Word",
    pronunciation: "zvel-YÀ-to",
    example:     "Mi sono svegliato tardi stamattina.",
    exampleEN:   "I woke up late this morning."
  }
};
