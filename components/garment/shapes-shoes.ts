/* Shoe outlines (Shoe.tsx + the sprite's clipPaths). See shapes.ts. */

// ---------------------------------------------------------------- shoes (viewBox 240 x 140, ground y = 132)
export type ShoeKind = "sneaker" | "runner" | "boot" | "slide";
/** Uppers in profile (toe right). The toe springs up ~6° and the heel sits a little higher than the forefoot. */
export const SHOE_UPPER: Record<Exclude<ShoeKind, "slide">, string> = {
  sneaker: "M24 103 L23 70 Q24 52 42 49 L62 51 Q90 64 118 62 L146 61 Q176 70 200 84 Q222 95 226 108 L120 110 Z",
  runner: "M26 101 L25 74 Q26 56 44 52 L62 54 Q92 66 122 62 L150 62 Q182 72 204 88 Q224 99 226 108 L120 108 Z",
  boot: "M26 103 L28 22 Q28 14 38 14 L80 14 Q90 14 90 24 L94 64 Q138 70 180 81 Q222 91 226 106 L120 108 Z",
};
