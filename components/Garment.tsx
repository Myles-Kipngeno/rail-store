"use client";

import { useId, type ReactNode } from "react";
import { inkFor, seeded, shade } from "@/lib/format";
import type { Colorway, GarmentType, Print, Product, Side } from "@/lib/types";

/*
 * Garment illustration. viewBox 200 x 260. The hanger hook tops out at y≈10, which is where
 * the rack's rod sits, so every garment hangs from the same line.
 * When a colour has a real photo for this side, the photo is shown instead.
 */

const TEE = "M74 44 Q100 58 126 44 L150 50 L186 86 L166 110 L150 96 L150 252 L50 252 L50 96 L34 110 L14 86 L50 50 Z";
const LONG =
  "M74 44 Q100 58 126 44 L150 50 Q166 58 172 84 L186 206 L166 210 L152 112 L150 252 L50 252 L48 112 L34 210 L14 206 L28 84 Q34 58 50 50 Z";
const TANK = "M76 44 Q100 76 124 44 L134 46 Q134 82 152 98 L152 252 L48 252 L48 98 Q66 82 66 46 Z";
const SLEEVE_L = "M50 50 Q34 58 28 84 L14 206 L34 210 L48 112 Z";
const SLEEVE_R = "M150 50 Q166 58 172 84 L186 206 L166 210 L152 112 Z";

const BODY: Record<GarmentType, string> = {
  tee: TEE,
  jersey: TEE,
  long: LONG,
  shirt: LONG,
  hoodie: LONG,
  jacket: LONG,
  tank: TANK,
};

const DISPLAY = {
  fontFamily: "var(--font-display)",
  fontWeight: 900,
  fontStretch: "125%",
} as const;

type GarmentProps = {
  product: Pick<Product, "id" | "type" | "print" | "name">;
  color: Colorway;
  side?: Side;
  className?: string;
};

export function Garment({ product, color, side = "front", className }: GarmentProps) {
  const uid = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const photo = color.images?.[side];

  if (photo) {
    return (
      <div className={`garment garment--photo ${className ?? ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={`${product.name}, ${color.name}, ${side}`} draggable={false} loading="lazy" decoding="async" />
      </div>
    );
  }

  const body = BODY[product.type];
  const base = color.hex;
  const dark = shade(base, -0.22);
  const trim = color.trim ?? shade(base, -0.12);
  const ink = inkFor(base);
  const prints = side === "front" ? product.print.front : product.print.back;
  const rnd = seeded(`${product.id}-${side}`);

  return (
    <svg
      viewBox="0 0 200 260"
      className={`garment ${className ?? ""}`}
      role="img"
      aria-label={`${product.name}, ${color.name}, ${side}`}
    >
      <defs>
        <linearGradient id={`${uid}s`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".16" />
          <stop offset=".34" stopColor="#fff" stopOpacity=".08" />
          <stop offset=".7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
        <linearGradient id={`${uid}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".06" />
          <stop offset="1" stopColor="#000" stopOpacity=".1" />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <path d={body} />
        </clipPath>
      </defs>

      {/* hanger: shoulder bar behind the garment, hook above it */}
      <path d="M56 52 L100 30 L144 52" stroke="#262624" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 31 V22 Q100 10 109 10 Q118 10 118 19" stroke="#262624" strokeWidth="3" fill="none" strokeLinecap="round" />

      {product.type === "hoodie" && side === "front" && (
        <path d="M68 48 Q70 16 100 14 Q130 16 132 48 Q100 66 68 48 Z" fill={dark} />
      )}

      <path d={body} fill={base} />

      <g clipPath={`url(#${uid}c)`}>
        {typeDetails(product.type, side, color, trim, dark)}
        {prints.map((p, i) => (
          <g key={i}>{renderPrint(p, product.type, side, ink, base, color, rnd)}</g>
        ))}
        {/* folds */}
        <path d="M80 118 Q74 182 82 252" stroke="#000" strokeOpacity=".07" strokeWidth="7" fill="none" />
        <path d="M124 140 Q130 196 120 252" stroke="#000" strokeOpacity=".06" strokeWidth="6" fill="none" />
        <path d="M100 200 Q96 228 102 252" stroke="#fff" strokeOpacity=".07" strokeWidth="5" fill="none" />
        <rect width="200" height="260" fill={`url(#${uid}s)`} />
        <rect width="200" height="260" fill={`url(#${uid}v)`} />
      </g>

      <path d={body} fill="none" stroke="#000" strokeOpacity=".18" strokeWidth="1" />
      {neckline(product.type, side, trim, dark)}
    </svg>
  );
}

function neckline(type: GarmentType, side: Side, trim: string, dark: string): ReactNode {
  if (type === "tank") return null;
  if (side === "back") return <path d="M76 45 Q100 52 124 45" stroke={dark} strokeWidth="3" fill="none" />;
  if (type === "shirt" || type === "jacket" || type === "jersey") return null;
  if (type === "hoodie")
    return <path d="M74 46 Q100 72 126 46" stroke={dark} strokeWidth="5" fill="none" strokeLinecap="round" />;
  return <path d="M74 45 Q100 60 126 45" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />;
}

function typeDetails(type: GarmentType, side: Side, color: Colorway, trim: string, dark: string): ReactNode {
  const front = side === "front";
  switch (type) {
    case "shirt":
      return front ? (
        <>
          <path d="M100 58 V252" stroke={dark} strokeOpacity=".5" strokeWidth="1.2" />
          {[88, 118, 148, 178, 208, 238].map((y) => (
            <circle key={y} cx="104" cy={y} r="2" fill={dark} />
          ))}
          <path d="M74 44 L100 62 L88 78 Z" fill={shade(color.hex, 0.06)} stroke={dark} strokeOpacity=".4" />
          <path d="M126 44 L100 62 L112 78 Z" fill={shade(color.hex, 0.06)} stroke={dark} strokeOpacity=".4" />
          <path d="M18 196 L36 199 M182 196 L164 199" stroke={dark} strokeOpacity=".5" strokeWidth="1.5" />
        </>
      ) : (
        <path d="M52 76 Q100 86 148 76" stroke={dark} strokeOpacity=".45" strokeWidth="1.2" fill="none" />
      );
    case "hoodie":
      return front ? (
        <>
          <path d="M64 184 L136 184 L146 236 L54 236 Z" fill="none" stroke={dark} strokeOpacity=".55" strokeWidth="1.5" />
          <path d="M92 58 L90 108 M108 58 L110 108" stroke={shade(color.hex, 0.35)} strokeWidth="2" strokeLinecap="round" />
          <rect x="50" y="240" width="100" height="12" fill={dark} opacity=".35" />
          <path d="M14 200 L34 203 M186 200 L166 203" stroke={dark} strokeWidth="6" strokeOpacity=".5" />
        </>
      ) : (
        <>
          <path d="M66 46 Q100 40 134 46 Q130 100 100 104 Q70 100 66 46 Z" fill={dark} opacity=".55" />
          <rect x="50" y="240" width="100" height="12" fill={dark} opacity=".35" />
        </>
      );
    case "jacket":
      return (
        <>
          <path d={SLEEVE_L} fill={color.sleeve ?? color.hex} />
          <path d={SLEEVE_R} fill={color.sleeve ?? color.hex} />
          <rect x="48" y="238" width="104" height="14" fill={trim} />
          <path d="M48 242 H152 M48 247 H152" stroke={color.hex} strokeWidth="1.6" />
          <path d="M14 196 L35 200 L34 210 L14 206 Z" fill={trim} />
          <path d="M186 196 L165 200 L166 210 L186 206 Z" fill={trim} />
          <path d="M70 44 Q100 64 130 44" stroke={trim} strokeWidth="9" fill="none" />
          {front && (
            <>
              <path d="M100 58 V252" stroke="#000" strokeOpacity=".35" strokeWidth="1.5" />
              {[86, 118, 150, 182, 214].map((y) => (
                <circle key={y} cx="100" cy={y} r="3" fill={trim} stroke="#000" strokeOpacity=".3" />
              ))}
            </>
          )}
        </>
      );
    case "jersey":
      return (
        <>
          {front ? (
            <path d="M80 44 L100 74 L120 44" stroke={trim} strokeWidth="6" fill="none" strokeLinejoin="round" />
          ) : (
            <path d="M74 45 Q100 54 126 45" stroke={trim} strokeWidth="6" fill="none" />
          )}
          <rect x="50" y="96" width="7" height="160" fill={trim} />
          <rect x="143" y="96" width="7" height="160" fill={trim} />
          <path d="M34 110 L14 86 L19 81 L38 104 Z M166 110 L186 86 L181 81 L162 104 Z" fill={trim} />
        </>
      );
    case "tank":
      return (
        <>
          <path d="M76 44 Q100 76 124 44" stroke={dark} strokeWidth="4" fill="none" />
          <path d="M66 46 Q66 82 48 98 M134 46 Q134 82 152 98" stroke={dark} strokeWidth="3" fill="none" />
        </>
      );
    default:
      return null;
  }
}

function renderPrint(
  p: Print,
  type: GarmentType,
  side: Side,
  ink: string,
  base: string,
  color: Colorway,
  rnd: () => number,
): ReactNode {
  switch (p.k) {
    case "text": {
      const lines = (p.t ?? "").toUpperCase().split("\n").filter(Boolean).slice(0, 4);
      if (!lines.length) return null;
      const longest = Math.max(...lines.map((l) => l.length));
      const fs = Math.min(lines.length >= 3 ? 24 : 30, 92 / Math.max(1, longest * 0.74));
      const startY = (type === "tank" ? 116 : side === "back" ? 104 : 100) + fs * 0.8;
      return lines.map((line, i) => (
        <text
          key={i}
          x="100"
          y={startY + i * fs * 0.92}
          textAnchor="middle"
          fontSize={fs}
          fill={ink}
          letterSpacing="-0.4"
          style={DISPLAY}
        >
          {line}
        </text>
      ));
    }
    case "logo": {
      const t = (p.t ?? "").toUpperCase();
      return side === "front" ? (
        <text x="124" y="88" fontSize="9" fill={ink} letterSpacing="1" style={DISPLAY}>
          {t}
        </text>
      ) : (
        <text x="100" y="80" fontSize="9" fill={ink} textAnchor="middle" letterSpacing="1.6" style={DISPLAY}>
          {t}
        </text>
      );
    }
    case "letter":
      return (
        <text
          x="76"
          y="112"
          fontSize="38"
          textAnchor="middle"
          fill={color.trim ?? ink}
          stroke={shade(base, -0.4)}
          strokeWidth="2"
          paintOrder="stroke"
          style={DISPLAY}
        >
          {(p.t ?? "R").slice(0, 2).toUpperCase()}
        </text>
      );
    case "number":
      return (
        <>
          <text x="100" y="92" fontSize="14" textAnchor="middle" fill={color.trim ?? ink} letterSpacing="2" style={DISPLAY}>
            {(p.t ?? "").toUpperCase()}
          </text>
          <text x="100" y="178" fontSize="70" textAnchor="middle" fill={color.trim ?? ink} style={DISPLAY}>
            {p.n ?? "10"}
          </text>
        </>
      );
    case "badge":
      return (
        <g transform="translate(128 84)">
          <path d="M-9 -10 H9 V2 Q9 10 0 13 Q-9 10 -9 2 Z" fill={color.trim ?? ink} />
          <path d="M-5 -5 H5 V1 Q5 6 0 8 Q-5 6 -5 1 Z" fill={base} />
        </g>
      );
    case "drip": {
      const red = "#8e0f18";
      const drips = Array.from({ length: 4 }, (_, i) => {
        const x = 110 + i * 7 + rnd() * 4;
        const len = 24 + rnd() * 70;
        return (
          <g key={i}>
            <rect x={x} y="90" width={2.4 + rnd() * 2} height={len} rx="1.5" fill={red} />
            <circle cx={x + 1.6} cy={90 + len} r={2.4 + rnd()} fill={red} />
          </g>
        );
      });
      const dots = Array.from({ length: 9 }, (_, i) => (
        <circle key={`d${i}`} cx={96 + rnd() * 52} cy={70 + rnd() * 40} r={0.8 + rnd() * 2.2} fill={red} />
      ));
      return (
        <>
          <path d="M106 86 Q112 74 124 78 Q138 80 134 92 Q128 100 112 98 Q102 96 106 86 Z" fill={red} />
          {drips}
          {dots}
          <path d="M36 198 q4 -6 8 0 q-2 8 -6 6 z" fill={red} />
        </>
      );
    }
    case "hands": {
      const red = "#9a121c";
      const spots: [number, number, number][] = [
        [74, 98, -18],
        [118, 92, 14],
        [92, 136, 6],
        [132, 150, 24],
        [70, 166, -30],
        [108, 190, -6],
      ];
      return spots.map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r + (rnd() - 0.5) * 10}) scale(${0.9 + rnd() * 0.25})`} fill={red}>
          <ellipse cx="0" cy="0" rx="8.5" ry="9.5" />
          <ellipse cx="-6.6" cy="-13" rx="2.5" ry="6.5" transform="rotate(-8 -6.6 -13)" />
          <ellipse cx="-2.2" cy="-15.5" rx="2.5" ry="7.2" />
          <ellipse cx="2.4" cy="-15" rx="2.4" ry="7" />
          <ellipse cx="6.6" cy="-12" rx="2.2" ry="5.8" transform="rotate(8 6.6 -12)" />
          <ellipse cx="-11" cy="-1" rx="2.6" ry="6" transform="rotate(-48 -11 -1)" />
        </g>
      ));
    }
    case "distress": {
      const hole = shade(base, -0.45);
      const edge = shade(base, 0.25);
      return Array.from({ length: 26 }, (_, i) => {
        const x = 58 + rnd() * 84;
        const y = 64 + rnd() * 180;
        const r = 0.9 + rnd() * 2.2;
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={r * 1.3} ry={r} fill={hole} />
            <ellipse cx={x} cy={y} rx={r * 1.3 + 0.8} ry={r + 0.8} fill="none" stroke={edge} strokeOpacity=".5" strokeWidth=".7" />
          </g>
        );
      });
    }
  }
}
