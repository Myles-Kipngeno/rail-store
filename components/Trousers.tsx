import type { ReactNode } from "react";
import { inkFor, shade } from "@/lib/format";
import type { Colorway, GarmentType, Print, Side } from "@/lib/types";

/*
 * Drawn trousers (bottoms without a photo). Same 200 x 260 viewBox as the tops in Garment.tsx, hook top
 * at y≈10 so they hang from the rod like everything else, but on a clip hanger: a straight bar with two
 * clips gripping the waistband corners. Hem at y≈252 (shorts y≈150).
 *   pants   waistband + belt loops, fly, slant pockets, slight taper
 *   cargo   wide leg + side pockets with flaps
 *   joggers elastic waist + drawcord, tapered, ribbed cuffs
 *   shorts  as pants, hem at y≈150
 * `trim` colours the waistband and cuffs; when it differs from `hex` a side stripe runs down each leg.
 * Back: yoke + back pockets, no fly. Prints (text / logo / letter) sit small on the left thigh.
 */

type Shape = {
  body: string;
  /** Outer seams, left and right, for the stripe. */
  seams: [string, string];
  hem: number;
};

const SHAPES: Record<"pants" | "cargo" | "joggers" | "shorts", Shape> = {
  pants: {
    body: "M62 44 L138 44 L142 98 L136 252 L104 252 L100 114 L96 252 L64 252 L58 98 Z",
    seams: ["M62 44 L58 98 L64 252", "M138 44 L142 98 L136 252"],
    hem: 252,
  },
  cargo: {
    body: "M62 44 L138 44 L145 98 L152 252 L104 252 L100 116 L96 252 L48 252 L55 98 Z",
    seams: ["M62 44 L55 98 L48 252", "M138 44 L145 98 L152 252"],
    hem: 252,
  },
  joggers: {
    body: "M62 44 L138 44 L145 98 L134 252 L106 252 L100 114 L94 252 L66 252 L55 98 Z",
    seams: ["M62 44 L55 98 L66 252", "M138 44 L145 98 L134 252"],
    hem: 252,
  },
  shorts: {
    body: "M62 44 L138 44 L145 92 L150 150 L104 150 L100 112 L96 150 L50 150 L55 92 Z",
    seams: ["M62 44 L55 92 L50 150", "M138 44 L145 92 L150 150"],
    hem: 150,
  },
};

const DISPLAY = { fontFamily: "var(--font-display)", fontWeight: 900, fontStretch: "125%" } as const;
const HANGER = "#262624";

type Props = {
  uid: string;
  type: GarmentType;
  color: Colorway;
  side: Side;
  prints: Print[];
  label: string;
  className?: string;
};

export function Trousers({ uid, type, color, side, prints, label, className }: Props) {
  const kind = type === "cargo" || type === "joggers" || type === "shorts" ? type : "pants";
  const { body, seams, hem } = SHAPES[kind];
  const base = color.hex;
  const dark = shade(base, -0.22);
  const trim = color.trim ?? shade(base, -0.12);
  const stripe = color.trim && color.trim.toLowerCase() !== base.toLowerCase();
  const ink = inkFor(base);
  const front = side === "front";
  const elastic = kind === "joggers";

  return (
    <svg viewBox="0 0 200 260" className={`garment garment--bottom ${className ?? ""}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${uid}s`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".16" />
          <stop offset=".34" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <path d={body} />
        </clipPath>
      </defs>

      {/* clip hanger: hook + straight bar (behind the waistband) */}
      <path d="M100 31 V22 Q100 10 109 10 Q118 10 118 19" stroke={HANGER} strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="54" y="30" width="92" height="5" rx="2.5" fill={HANGER} />

      <path d={body} fill={base} />

      <g clipPath={`url(#${uid}c)`}>
        {stripe &&
          seams.map((d, i) => <path key={i} d={d} stroke={color.trim} strokeWidth="11" fill="none" strokeLinejoin="round" />)}

        {/* waistband */}
        <rect x="56" y="44" width="88" height="11" fill={trim} />
        {elastic ? (
          <path d="M56 48 H144 M56 51.5 H144" stroke="#000" strokeOpacity=".18" strokeWidth=".8" />
        ) : (
          [68, 86, 114, 132].concat(front ? [] : [100]).map((x) => (
            <rect key={x} x={x - 2} y="43" width="4" height="14" rx="1" fill={trim} stroke="#000" strokeOpacity=".22" strokeWidth=".6" />
          ))
        )}

        {front ? (
          <>
            {elastic ? (
              // drawcord
              <path d="M96 53 Q94 66 91 76 M104 53 Q106 66 109 76" stroke={shade(base, 0.4)} strokeWidth="2" fill="none" strokeLinecap="round" />
            ) : (
              <>
                <circle cx="100" cy="49.5" r="2.2" fill={shade(trim, -0.35)} />
                {/* fly */}
                <path d="M100 55 V104 M106 55 V94 Q106 101 99 104" stroke={dark} strokeOpacity=".55" strokeWidth="1.2" fill="none" />
              </>
            )}
            {/* slant pockets */}
            <path d="M64 56 Q76 60 80 80 M136 56 Q124 60 120 80" stroke={dark} strokeOpacity=".5" strokeWidth="1.3" fill="none" />
          </>
        ) : (
          <>
            {/* yoke + back pockets */}
            <path d="M58 64 L100 74 L142 64 M100 55 V114" stroke={dark} strokeOpacity=".5" strokeWidth="1.2" fill="none" />
            <path d="M68 78 H92 V100 L80 105 L68 100 Z M108 78 H132 V100 L120 105 L108 100 Z" fill={shade(base, -0.06)} stroke={dark} strokeOpacity=".5" strokeWidth="1.1" />
          </>
        )}

        {kind === "cargo" && (
          // side pockets with flaps, on the outer thighs
          <path
            d="M52 132 H78 V172 Q65 178 52 172 Z M122 132 H148 V172 Q135 178 122 172 Z"
            fill={shade(base, -0.05)}
            stroke={dark}
            strokeOpacity=".55"
            strokeWidth="1.2"
          />
        )}
        {kind === "cargo" && (
          <path d="M51 127 H79 V139 H51 Z M121 127 H149 V139 H121 Z" fill={shade(base, 0.04)} stroke={dark} strokeOpacity=".6" strokeWidth="1.2" />
        )}

        {elastic && (
          // ribbed cuffs
          <>
            <path d={`M60 236 H140 V${hem} H60 Z`} fill={trim} />
            {Array.from({ length: 21 }, (_, i) => (
              <path key={i} d={`M${62 + i * 4} 237 V${hem}`} stroke="#000" strokeOpacity=".14" strokeWidth=".8" />
            ))}
          </>
        )}
        {!elastic && <path d={`M40 ${hem - 6} H160`} stroke={dark} strokeOpacity=".35" strokeWidth="1" />}

        {prints.map((p, i) => (
          <g key={i}>{thighPrint(p, ink, color, base)}</g>
        ))}

        {/* creases + shading */}
        <path d={`M80 112 Q78 ${hem - 60} 80 ${hem}`} stroke="#000" strokeOpacity=".07" strokeWidth="5" fill="none" />
        <path d={`M120 112 Q122 ${hem - 60} 120 ${hem}`} stroke="#000" strokeOpacity=".06" strokeWidth="5" fill="none" />
        <rect width="200" height="260" fill={`url(#${uid}s)`} />
      </g>

      <path d={body} fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1" />

      {/* clips gripping the waistband corners */}
      {[60, 140].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="28" width="12" height="25" rx="2" fill={HANGER} />
          <rect x={x - 4} y="47" width="8" height="5" rx="1" fill="#3b3b38" />
          <circle cx={x} cy="35" r="1.6" fill="#8a8a84" />
        </g>
      ))}
    </svg>
  );
}

/** Small graphics on the left thigh (the wearer's left, so the viewer's right). */
function thighPrint(p: Print, ink: string, color: Colorway, base: string): ReactNode {
  const x = 120;
  switch (p.k) {
    case "text": {
      const lines = (p.t ?? "").toUpperCase().split("\n").filter(Boolean).slice(0, 3);
      if (!lines.length) return null;
      const longest = Math.max(...lines.map((l) => l.length));
      const fs = Math.min(12, 26 / Math.max(1, longest * 0.74));
      return lines.map((line, i) => (
        <text key={i} x={x} y={126 + fs + i * fs * 0.92} textAnchor="middle" fontSize={fs} fill={ink} style={DISPLAY}>
          {line}
        </text>
      ));
    }
    case "logo":
      return (
        <text x={x} y="122" fontSize="5.5" textAnchor="middle" fill={ink} letterSpacing=".8" style={DISPLAY}>
          {(p.t ?? "").toUpperCase()}
        </text>
      );
    case "letter":
      return (
        <text
          x={x}
          y="146"
          fontSize="22"
          textAnchor="middle"
          fill={color.trim ?? ink}
          stroke={shade(base, -0.4)}
          strokeWidth="1.4"
          paintOrder="stroke"
          style={DISPLAY}
        >
          {(p.t ?? "R").slice(0, 2).toUpperCase()}
        </text>
      );
    default:
      return null;
  }
}
