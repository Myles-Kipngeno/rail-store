/* Trouser outlines (Trousers.tsx + the sprite's clipPaths). See shapes.ts. */

// ---------------------------------------------------------------- trousers (viewBox 200 x 260)
export type TrouserKind = "pants" | "cargo" | "joggers" | "shorts";
export type TrouserShape = {
  body: string;
  /** Outer seams (left, right) and inner leg edges (left, right), for stitching, stripes and the gap shadow. */
  out: [string, string];
  inner: [string, string];
  /** Leg spans [left, right] in x, and the hem y. */
  legL: [number, number];
  legR: [number, number];
  hem: number;
};

/** The waist sags between the two clips (Q100 53). */
export const TROUSERS: Record<TrouserKind, TrouserShape> = {
  pants: {
    body: "M61 46 Q100 53 139 46 L141 70 Q144 92 143 106 Q141 152 139.5 200 Q138.5 228 139 252 L105 252 Q103.5 190 101.6 126 Q100 119 98.4 126 Q96.5 190 95 252 L61 252 Q61.5 228 60.5 200 Q59 152 57 106 Q56 92 59 70 Z",
    out: ["M59 70 Q56 92 57 106 Q59 152 60.5 200 Q61.5 228 61 252", "M141 70 Q144 92 143 106 Q141 152 139.5 200 Q138.5 228 139 252"],
    inner: ["M98.4 126 Q96.5 190 95 252", "M101.6 126 Q103.5 190 105 252"],
    legL: [57, 99],
    legR: [101, 143],
    hem: 252,
  },
  cargo: {
    body: "M61 46 Q100 53 139 46 L142 70 Q146 92 146 108 Q148.5 172 152 252 L105 252 Q103.5 190 101.6 128 Q100 121 98.4 128 Q96.5 190 95 252 L48 252 Q51.5 172 54 108 Q54 92 58 70 Z",
    out: ["M58 70 Q54 92 54 108 Q51.5 172 48 252", "M142 70 Q146 92 146 108 Q148.5 172 152 252"],
    inner: ["M98.4 128 Q96.5 190 95 252", "M101.6 128 Q103.5 190 105 252"],
    legL: [48, 99],
    legR: [101, 152],
    hem: 252,
  },
  joggers: {
    body: "M61 46 Q100 53 139 46 L142 70 Q147 94 146 110 Q144 172 137 234 L136 252 L105 252 L104.5 234 Q103 182 101.6 126 Q100 119 98.4 126 Q97 182 95.5 234 L95 252 L64 252 L63 234 Q56 172 54 110 Q53 94 58 70 Z",
    out: ["M58 70 Q53 94 54 110 Q56 172 63 234 L64 252", "M142 70 Q147 94 146 110 Q144 172 137 234 L136 252"],
    inner: ["M98.4 126 Q97 182 95.5 234 L95 252", "M101.6 126 Q103 182 104.5 234 L105 252"],
    legL: [54, 99],
    legR: [101, 146],
    hem: 252,
  },
  shorts: {
    body: "M61 46 Q100 53 139 46 L142 70 Q147 94 147 106 L151 150 L105 150 Q103.5 134 101.6 121 Q100 116 98.4 121 Q96.5 134 95 150 L49 150 L53 106 Q53 94 58 70 Z",
    out: ["M58 70 Q53 94 53 106 L49 150", "M142 70 Q147 94 147 106 L151 150"],
    inner: ["M98.4 121 Q96.5 134 95 150", "M101.6 121 Q103.5 134 105 150"],
    legL: [49, 99],
    legR: [101, 151],
    hem: 150,
  },
};
export const WAISTBAND = "M61 46 Q100 53 139 46 L140 58 Q100 65 60 58 Z";

