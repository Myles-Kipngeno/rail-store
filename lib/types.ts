export const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

export const GARMENT_TYPES = ["tee", "long", "shirt", "hoodie", "tank", "jacket", "jersey"] as const;
export type GarmentType = (typeof GARMENT_TYPES)[number];

export const GARMENT_LABELS: Record<GarmentType, string> = {
  tee: "T-shirt",
  long: "Long-sleeve tee",
  shirt: "Button shirt",
  hoodie: "Hoodie",
  tank: "Tank top",
  jacket: "Jacket",
  jersey: "Jersey",
};

/** Graphics drawn on the built-in garment illustration (used when a colour has no photo). */
export const PRINT_KINDS = ["text", "logo", "drip", "hands", "distress", "letter", "number", "badge"] as const;
export type PrintKind = (typeof PRINT_KINDS)[number];

export const PRINT_LABELS: Record<PrintKind, string> = {
  text: "Big text",
  logo: "Small logo text",
  drip: "Paint drip",
  hands: "Handprints",
  distress: "Distressed holes",
  letter: "Varsity letter",
  number: "Name + number",
  badge: "Crest badge",
};

export interface Print {
  k: PrintKind;
  /** Text for text / logo / letter / number (name) prints. Use \n for line breaks. */
  t?: string;
  /** Number for "number" prints. */
  n?: string;
}

export interface Colorway {
  id: string;
  name: string;
  hex: string;
  /** Rib, collar and stripe colour. */
  trim?: string;
  /** Sleeve colour (varsity-style jackets). */
  sleeve?: string;
  /** Real product photos. When set they replace the illustration for that side. Transparent PNG/WebP works best. */
  images?: { front?: string; back?: string };
  stock: Partial<Record<Size, number>>;
}

export interface Product {
  id: string;
  name: string;
  type: GarmentType;
  category: string;
  /** Whole Kenyan shillings. */
  price: number;
  colors: Colorway[];
  print: { front: Print[]; back: Print[] };
  description: string;
  details: string[];
  published: boolean;
  createdAt: string;
}

export type Side = "front" | "back";
