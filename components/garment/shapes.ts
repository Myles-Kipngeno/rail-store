/*
 * Garment geometry shared by the drawings and the page-wide sprite (GarmentDefs.tsx), which turns these
 * outlines into clipPaths. Trouser and shoe outlines live in shapes-bottoms.ts / shapes-shoes.ts so the
 * tops-only home rack doesn't ship them. Plain module (no "use client"), so
 * the server-rendered sprite can import the paths without shipping any JS.
 */
import { shade } from "@/lib/format";

/** Sprite ids. Stable and prefixed; every garment references these instead of defining its own. */
export const GD = {
  key: "gd-key", // top-left key light (fill over the whole garment)
  cyl: "gd-cyl", // horizontal roll-off: a leg / torso as a soft cylinder
  vert: "gd-vert", // light top, darker bottom
  metal: "gd-metal", // hanger bar, buttons, rivets, aglets
  sole: "gd-sole", // sculpted midsole highlight
  reflect: "gd-reflect", // runner heel strip
  ground: "gd-ground", // shoe contact shadow
  soft: "gd-soft", // small blur for folds and inner shadows
  softer: "gd-softer",
  noise: "gd-noise", // fabric texture (detail="high" only)
  twill: "gd-twill", // denim diagonal
  rib: "gd-rib", // rib knit / elastic
  mesh: "gd-mesh", // runner upper
  perf: "gd-perf", // toe-cap perforations
  emboss: "gd-emboss", // slide strap
  knit: "gd-knit", // fine knit lines for tops (high)
} as const;

export const url = (id: string) => `url(#${id})`;
export const clipId = (shape: string) => `gd-c-${shape}`;

/** Colourway tones: highlights +12%, mid folds −8%, shadows −18% (deep −32% for gaps and holes). */
export function tone(hex: string) {
  return { base: hex, hi: shade(hex, 0.12), mid: shade(hex, -0.08), sh: shade(hex, -0.18), deep: shade(hex, -0.32) };
}
export type Tone = ReturnType<typeof tone>;

/** Dashed stitch line. */
export const STITCH = { strokeDasharray: "2.4 1.7", strokeWidth: 0.8, fill: "none", strokeLinecap: "round" } as const;

// ---------------------------------------------------------------- tops (viewBox 200 x 260)
export type TopShape = "tee" | "long" | "tank";
export const TOPS: Record<TopShape, string> = {
  tee: "M74 44 Q100 58 126 44 L150 50 L186 86 L166 110 L150 96 L150 252 L50 252 L50 96 L34 110 L14 86 L50 50 Z",
  long: "M74 44 Q100 58 126 44 L150 50 Q166 58 172 84 L186 206 L166 210 L152 112 L150 252 L50 252 L48 112 L34 210 L14 206 L28 84 Q34 58 50 50 Z",
  tank: "M76 44 Q100 76 124 44 L134 46 Q134 82 152 98 L152 252 L48 252 L48 98 Q66 82 66 46 Z",
};
export const SLEEVE_L = "M50 50 Q34 58 28 84 L14 206 L34 210 L48 112 Z";
export const SLEEVE_R = "M150 50 Q166 58 172 84 L186 206 L166 210 L152 112 Z";

