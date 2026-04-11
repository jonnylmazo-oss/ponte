// Flat lookup keyed by Italian word (lowercase).
// Used by the tokenizer for fast tooltip rendering.
const wordmap = {
  "caffè": {
    english:  "coffee",
    spanish:  "café",
    note:     null,
    category: "cognate",
    label:    "Cognate"
  },
  "turista": {
    english:  "tourist",
    spanish:  "turista",
    note:     null,
    category: "cognate",
    label:    "Cognate"
  },
  "decente": {
    english:  "decent",
    spanish:  "decente",
    note:     null,
    category: "cognate",
    label:    "Cognate"
  },
  "direzione": {
    english:  "direction",
    spanish:  "dirección",
    note:     null,
    category: "cognate",
    label:    "Cognate"
  },
  "burro": {
    english:  "butter",
    spanish:  "mantequilla",
    note:     "In Spanish, 'burro' means donkey — not butter.",
    category: "false-friend",
    label:    "False Friend"
  },
  "caldo": {
    english:  "hot / warm",
    spanish:  "caliente",
    note:     "In Spanish, 'caldo' means broth or stock — not heat.",
    category: "false-friend",
    label:    "False Friend"
  },
  "già": {
    english:  "already",
    spanish:  "ya",
    note:     "Italian uses 'già' more broadly than Spanish 'ya' — also for emphasis and as a conversational filler.",
    category: "divergence",
    label:    "Divergence"
  },
  "ancora": {
    english:  "still / yet / again",
    spanish:  "todavía / aún",
    note:     "Looks like 'ancla' (anchor) in Spanish — false visual cognate. Means still, yet, or again in Italian.",
    category: "divergence",
    label:    "Divergence"
  },
  "preso": {
    english:  "taken / had (food or drink)",
    spanish:  "tomé / tomado",
    note:     "Italian uses 'prendere' (to take) where Spanish uses 'tomar' — same semantic slot, different verb.",
    category: "new",
    label:    "New Word"
  },
  "svegliato": {
    english:  "woken up",
    spanish:  "despertado",
    note:     "From 'svegliarsi' — a reflexive verb. Its past tense is built with 'essere': mi sono svegliato.",
    category: "new",
    label:    "New Word"
  }
};
