// ---------------------------------------------------------------- departments + categories
export const DEPARTMENTS = ["tops", "bottoms", "formal", "shoes", "accessories"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const CATEGORIES = {
  tops: ["tees", "shirts", "polos", "hoodies", "sweaters", "jackets"],
  bottoms: ["jeans", "sweatpants", "cargo", "shorts", "trousers"],
  formal: ["suits", "blazers", "dress-shirts", "dress-trousers"],
  shoes: ["sneakers", "boots", "formal-shoes", "slides"],
  accessories: ["caps", "bags", "belts", "socks"],
} as const satisfies Record<Department, readonly string[]>;
export type Category = (typeof CATEGORIES)[Department][number];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  tops: "Tops",
  bottoms: "Bottoms",
  formal: "Formal",
  shoes: "Shoes",
  accessories: "Accessories",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  tees: "Tees",
  shirts: "Shirts",
  polos: "Polos",
  hoodies: "Hoodies",
  sweaters: "Sweaters",
  jackets: "Jackets",
  jeans: "Jeans",
  sweatpants: "Sweatpants",
  cargo: "Cargo",
  shorts: "Shorts",
  trousers: "Trousers",
  suits: "Suits",
  blazers: "Blazers",
  "dress-shirts": "Dress shirts",
  "dress-trousers": "Dress trousers",
  sneakers: "Sneakers",
  boots: "Boots",
  "formal-shoes": "Formal shoes",
  slides: "Slides",
  caps: "Caps",
  bags: "Bags",
  belts: "Belts",
  socks: "Socks",
};

export const isDepartment = (d: unknown): d is Department => DEPARTMENTS.includes(d as Department);
export const isCategoryOf = (d: Department, c: unknown): c is Category =>
  (CATEGORIES[d] as readonly string[]).includes(c as string);

// ---------------------------------------------------------------- size systems
/** Letter sizes: tops and formal tops (suits, blazers, dress shirts). */
export const LETTER_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
/** Waist in inches: bottoms and dress trousers. */
export const WAIST_SIZES = ["28", "30", "32", "34", "36", "38", "40"] as const;
/** EU shoe sizes. */
export const SHOE_SIZES = ["38", "39", "40", "41", "42", "43", "44", "45", "46"] as const;
/** Accessories come in one size. */
export const ONE_SIZE = ["ONE"] as const;

export type Size =
  | (typeof LETTER_SIZES)[number]
  | (typeof WAIST_SIZES)[number]
  | (typeof SHOE_SIZES)[number]
  | (typeof ONE_SIZE)[number];

export type SizeSystem = "letter" | "waist" | "eu" | "one";

export function sizeSystemFor(department: Department, category: Category): SizeSystem {
  switch (department) {
    case "bottoms":
      return "waist";
    case "shoes":
      return "eu";
    case "accessories":
      return "one";
    case "formal":
      return category === "dress-trousers" ? "waist" : "letter";
    default:
      return "letter";
  }
}

const SYSTEM_SIZES: Record<SizeSystem, readonly Size[]> = {
  letter: LETTER_SIZES,
  waist: WAIST_SIZES,
  eu: SHOE_SIZES,
  one: ONE_SIZE,
};

/** The sizes a product is stocked and sold in, in display order. */
export const sizesFor = (p: Pick<Product, "department" | "category">): readonly Size[] =>
  SYSTEM_SIZES[sizeSystemFor(p.department, p.category)];

/** Only tops have a drawn-garment fallback. Everything else needs a real front photo to be published. */
export const hasDrawnFallback = (p: Pick<Product, "department">) => p.department === "tops";

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
  /** Shape of the drawn garment (only used for tops without photos). */
  type: GarmentType;
  department: Department;
  /** Always one of CATEGORIES[department]. */
  category: Category;
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
