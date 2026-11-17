import type { ReactNode } from "react";
import { inkFor, luminance, seeded, shade } from "@/lib/format";
import type { Colorway, GarmentType, Print, Side } from "@/lib/types";
import { GD, SLEEVE_L, SLEEVE_R, STITCH, TOPS, clipId, tone, url, type TopShape, type Tone } from "./garment/shapes";

/*
 * Drawn tops (Garment.tsx delegates here; loaded via next/dynamic). viewBox 200 x 260, wire hanger with the
 * hook top at y≈10. See Garment.tsx for the detail levels and the shared sprite.
 */

type TopType = "tee" | "jersey" | "long" | "shirt" | "hoodie" | "jacket" | "tank";

const SHAPE: Record<TopType, TopShape> = {
  tee: "tee",
  jersey: "tee",
  long: "long",
  shirt: "long",
  hoodie: "long",
  jacket: "long",
  tank: "tank",
};

const DISPLAY = {
  fontFamily: "var(--font-display)",
  fontWeight: 900,
  fontStretch: "125%",
} as const;


type Props = {
  productId: string;
  type: GarmentType;
  color: Colorway;
  side: Side;
  prints: Print[];
  label: string;
  className?: string;
  detail: "low" | "high";
};

export function Top({ productId, type, color, side, prints, label, className, detail }: Props) {
  const top = type as TopType;
  const shape = SHAPE[top];
  const body = TOPS[shape];
  const t = tone(color.hex);
  const high = detail === "high";
  const front = side === "front";
  const trim = color.trim ?? t.mid;
  const thread = shade(color.hex, luminance(color.hex) > 0.55 ? -0.3 : 0.3);
  const ink = inkFor(color.hex);
  const rnd = seeded(`${productId}-${side}`);
  const clip = url(clipId(shape));

  return (
    <svg viewBox="0 0 200 260" className={`garment ${className ?? ""}`} role="img" aria-label={label}>
      <Hanger />

      {top === "hoodie" && front && (
        <>
          {/* hood behind the neck, with its depth */}
          <path d="M66 49 Q68 14 100 12 Q132 14 134 49 Q100 68 66 49 Z" fill={t.sh} />
          <path d="M74 47 Q76 24 100 22 Q124 24 126 47 Q100 62 74 47 Z" fill={t.deep} />
          <path d="M78 46 Q80 28 100 26 Q120 28 122 46" stroke="#000" strokeOpacity=".25" strokeWidth="5" fill="none" filter={url(GD.soft)} />
          <path d="M66 49 Q68 14 100 12 Q132 14 134 49" stroke={t.hi} strokeOpacity=".6" strokeWidth="1.2" fill="none" />
        </>
      )}

      <path d={body} fill={t.base} />
      {top === "jacket" && (
        <>
          <path d={SLEEVE_L} fill={color.sleeve ?? t.base} />
          <path d={SLEEVE_R} fill={color.sleeve ?? t.base} />
        </>
      )}

      <g clipPath={clip}>
        {typeDetails(top, side, color, t, trim, thread, high)}
        {prints.map((p, i) => (
          <g key={i}>{renderPrint(p, top, side, ink, color.hex, color, rnd)}</g>
        ))}
        <Folds shape={shape} t={t} high={high} />
        {/* torso roll-off + key light + bottom fall-off */}
        <rect x="48" y="40" width="104" height="216" fill={url(GD.cyl)} />
        <rect width="200" height="260" fill={url(GD.key)} />
        <rect width="200" height="260" fill={url(GD.vert)} />
        {shape !== "tank" && <Sleeves shape={shape} t={t} />}
        <path d={body} fill="none" stroke={t.deep} strokeOpacity=".35" strokeWidth="7" filter={url(GD.softer)} />
        <Seams shape={shape} t={t} thread={thread} high={high} front={front} />
        {high && <path d={body} fill="#000" opacity=".2" filter={url(GD.noise)} />}
      </g>

      <path d={body} fill="none" stroke={t.deep} strokeOpacity=".7" strokeWidth=".9" strokeLinejoin="round" />
      {neckline(top, side, t, trim, high, thread)}
    </svg>
  );
}

/** Wire hanger: shoulder bar behind the garment, hook above it, with a small highlight. */
function Hanger() {
  return (
    <>
      <path d="M56 52 L100 30 L144 52" stroke="#262624" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M100 31 V22 Q100 10 109 10 Q118 10 118 19" stroke="#262624" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M101 28 V22 Q101 11.6 108.5 11.6" stroke="#8a8a85" strokeWidth=".8" fill="none" strokeLinecap="round" />
    </>
  );
}

/** Sleeve folds (and the elbow on long sleeves). Drawn over the body, inside its outline. */
function Sleeves({ shape, t }: { shape: TopShape; t: Tone }) {
  const pair = (d: string, k: string) => (
    <g key={k}>
      <path d={d} stroke={t.hi} strokeOpacity=".5" strokeWidth="2.2" fill="none" strokeLinecap="round" filter={url(GD.soft)} />
      <path d={d} transform="translate(0 2.4)" stroke={t.sh} strokeOpacity=".6" strokeWidth="1.6" fill="none" strokeLinecap="round" filter={url(GD.soft)} />
    </g>
  );
  if (shape === "tee")
    return (
      <>
        {pair("M30 88 Q38 82 46 88", "a")}
        {pair("M154 88 Q162 82 170 88", "b")}
        {pair("M36 98 Q42 94 48 97", "c")}
        {pair("M152 97 Q158 94 164 98", "d")}
      </>
    );
  return (
    <>
      {pair("M24 140 Q32 134 42 140", "a")}
      {pair("M22 154 Q30 148 40 155", "b")}
      {pair("M158 140 Q168 134 176 140", "c")}
      {pair("M160 155 Q170 148 178 154", "d")}
      {pair("M28 100 Q36 96 44 101", "e")}
      {pair("M156 101 Q164 96 172 100", "f")}
    </>
  );
}

/** Body folds and the hem drape (2–3 soft folds). Shadows multiply, so prints underneath follow them. */
function Folds({ shape, t, high }: { shape: TopShape; t: Tone; high: boolean }) {
  const soft = url(GD.soft);
  return (
    <>
    <g style={{ mixBlendMode: "multiply" }}>
      <path d="M80 118 Q74 182 82 252" stroke={t.sh} strokeOpacity=".5" strokeWidth="6" fill="none" filter={soft} />
      <path d="M124 140 Q130 196 120 252" stroke={t.sh} strokeOpacity=".45" strokeWidth="5" fill="none" filter={soft} />
      {/* hem drape */}
      <path d="M66 214 Q62 234 68 252" stroke={t.sh} strokeOpacity=".55" strokeWidth="3.2" fill="none" filter={soft} />
      <path d="M102 220 Q98 238 103 252" stroke={t.sh} strokeOpacity=".5" strokeWidth="3" fill="none" filter={soft} />
      <path d="M136 210 Q141 232 134 252" stroke={t.sh} strokeOpacity=".55" strokeWidth="3.2" fill="none" filter={soft} />
      {high && (
        <>
          <path d="M92 70 Q88 92 94 112" stroke={t.sh} strokeOpacity=".35" strokeWidth="2" fill="none" filter={soft} />
          <path d="M60 150 Q58 170 62 186" stroke={t.sh} strokeOpacity=".35" strokeWidth="2" fill="none" filter={soft} />
        </>
      )}
    </g>
    {/* lit ridges beside the hem folds */}
    {shape !== "tank" || high ? (
      <path d="M70 216 Q66 236 72 252 M106 222 Q102 238 107 252 M140 212 Q145 232 138 252" stroke={t.hi} strokeOpacity=".4" strokeWidth="1.4" fill="none" filter={url(GD.soft)} />
    ) : null}
    </>
  );
}

/** Shoulder + armhole seams and the hem; dashed thread on "high". */
function Seams({ shape, t, thread, high, front }: { shape: TopShape; t: Tone; thread: string; high: boolean; front: boolean }) {
  const arm =
    shape === "tee"
      ? "M50 50 Q57 72 50 96 M150 50 Q143 72 150 96"
      : shape === "long"
        ? "M50 50 Q58 80 48 112 M150 50 Q142 80 152 112"
        : "";
  const shoulder = shape === "tank" ? "" : "M76 45.5 L51 51 M124 45.5 L149 51";
  return (
    <>
      {arm && <path d={arm} stroke={t.deep} strokeOpacity=".45" strokeWidth=".9" fill="none" />}
      {shoulder && <path d={shoulder} stroke={t.deep} strokeOpacity={front ? 0.25 : 0.35} strokeWidth=".8" fill="none" />}
      <path d="M40 245 H160" stroke={t.deep} strokeOpacity=".3" strokeWidth=".8" />
      {high && (
        <>
          {arm && <path d={arm} stroke={thread} {...STITCH} strokeOpacity=".9" />}
          <path d="M40 248.5 H160" stroke={thread} {...STITCH} />
        </>
      )}
    </>
  );
}

function neckline(type: TopType, side: Side, t: Tone, trim: string, high: boolean, thread: string): ReactNode {
  if (type === "tank") return null;
  if (side === "back")
    return (
      <>
        <path d="M76 45 Q100 52 124 45 L122.5 49.5 Q100 56.5 77.5 49.5 Z" fill={type === "hoodie" ? t.sh : trim} />
        <path d="M76 45 Q100 52 124 45 L122.5 49.5 Q100 56.5 77.5 49.5 Z" fill={url(GD.rib)} />
        {/* neck label */}
        <rect x="95" y="51" width="10" height="6" rx=".6" fill="#ece7da" />
      </>
    );
  if (type === "shirt" || type === "jacket" || type === "jersey") return null;
  if (type === "hoodie")
    return <path d="M74 46 Q100 72 126 46" stroke={t.deep} strokeWidth="4" fill="none" strokeLinecap="round" />;
  // crew neck rib
  return (
    <>
      <path d="M74 44 Q100 58 126 44 L123 49.5 Q100 63 77 49.5 Z" fill={trim} />
      <path d="M74 44 Q100 58 126 44 L123 49.5 Q100 63 77 49.5 Z" fill={url(GD.rib)} />
      <path d="M77 49.5 Q100 63 123 49.5" stroke={t.deep} strokeOpacity=".45" strokeWidth=".8" fill="none" />
      {high && <path d="M78.5 52 Q100 65.5 121.5 52" stroke={thread} {...STITCH} />}
    </>
  );
}

function typeDetails(type: TopType, side: Side, color: Colorway, t: Tone, trim: string, thread: string, high: boolean): ReactNode {
  const front = side === "front";
  const ribCuffs = (fill: string) => (
    <>
      <path d="M15.5 196 L35.5 200 L34 210 L14 206 Z M184.5 196 L164.5 200 L166 210 L186 206 Z" fill={fill} />
      <path d="M15.5 196 L35.5 200 L34 210 L14 206 Z M184.5 196 L164.5 200 L166 210 L186 206 Z" fill={url(GD.rib)} />
    </>
  );
  const ribHem = (fill: string) => (
    <>
      <rect x="48" y="238" width="104" height="14" fill={fill} />
      <rect x="48" y="238" width="104" height="14" fill={url(GD.rib)} />
      <path d="M48 238 H152" stroke={t.deep} strokeOpacity=".4" strokeWidth=".8" />
    </>
  );
  switch (type) {
    case "long":
      return ribCuffs(trim);
    case "shirt":
      return front ? (
        <>
          {/* placket + buttons with holes */}
          <path d="M96 58 V252 M104 58 V252" stroke={t.deep} strokeOpacity=".4" strokeWidth=".9" />
          <rect x="96" y="58" width="8" height="194" fill={t.hi} opacity=".35" />
          {high && <path d="M97.6 60 V250 M102.4 60 V250" stroke={thread} {...STITCH} />}
          {[88, 118, 148, 178, 208, 238].map((y) => (
            <g key={y}>
              <circle cx="100" cy={y} r="2.5" fill={shade(color.hex, 0.18)} stroke={t.deep} strokeOpacity=".6" strokeWidth=".6" />
              <circle cx="99.2" cy={y} r=".45" fill={t.deep} />
              <circle cx="100.8" cy={y} r=".45" fill={t.deep} />
            </g>
          ))}
          {/* collar */}
          <path d="M74 44 L100 62 L88 78 Z" fill={t.hi} stroke={t.deep} strokeOpacity=".45" strokeWidth=".8" />
          <path d="M126 44 L100 62 L112 78 Z" fill={t.hi} stroke={t.deep} strokeOpacity=".45" strokeWidth=".8" />
          <path d="M88 78 L100 62 L112 78" stroke="#000" strokeOpacity=".2" strokeWidth="2.4" fill="none" filter={url(GD.soft)} />
          {/* cuffs */}
          <path d="M15.5 196 L35.5 200 L34 210 L14 206 Z M184.5 196 L164.5 200 L166 210 L186 206 Z" fill={t.hi} opacity=".6" />
          <path d="M18 196 L36 199 M182 196 L164 199" stroke={t.deep} strokeOpacity=".5" strokeWidth="1.2" />
          {/* chest pocket */}
          <path d="M112 92 H132 V112 Q122 116 112 112 Z" fill="none" stroke={t.deep} strokeOpacity=".4" strokeWidth=".9" />
        </>
      ) : (
        <>
          <path d="M52 76 Q100 86 148 76" stroke={t.deep} strokeOpacity=".45" strokeWidth="1.1" fill="none" />
          <path d="M100 80 V96" stroke={t.deep} strokeOpacity=".35" strokeWidth="1" />
          {high && <path d="M52 79.5 Q100 89.5 148 79.5" stroke={thread} {...STITCH} />}
        </>
      );
    case "hoodie":
      return (
        <>
          {ribCuffs(t.mid)}
          {ribHem(t.mid)}
          {front ? (
            <>
              {/* kangaroo pocket: shaded openings */}
              <path d="M64 184 L136 184 L146 236 L54 236 Z" fill={t.hi} opacity=".25" />
              <path d="M64 184 L136 184 L146 236 L54 236 Z" fill="none" stroke={t.deep} strokeOpacity=".55" strokeWidth="1.2" />
              <path d="M64 184 L54 236 L60 236 L68 190 Z M136 184 L146 236 L140 236 L132 190 Z" fill={t.deep} opacity=".35" />
              {high && <path d="M66 187 L134 187" stroke={thread} {...STITCH} />}
              {/* drawcords with aglets */}
              <path d="M92 58 Q90 84 90 106 M108 58 Q110 84 110 106" stroke={shade(color.hex, 0.4)} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d="M92 58 Q90 84 90 106 M108 58 Q110 84 110 106" stroke="#000" strokeOpacity=".18" strokeWidth=".7" fill="none" transform="translate(.7 .4)" />
              <rect x="88.4" y="104" width="3.4" height="8" rx="1.2" fill={url(GD.metal)} />
              <rect x="108.2" y="104" width="3.4" height="8" rx="1.2" fill={url(GD.metal)} />
              <circle cx="92" cy="57" r="1.6" fill={t.deep} />
              <circle cx="108" cy="57" r="1.6" fill={t.deep} />
            </>
          ) : (
            <>
              {/* hood hanging down the back */}
              <path d="M66 46 Q100 40 134 46 Q130 102 100 106 Q70 102 66 46 Z" fill={t.sh} />
              <path d="M100 44 V106" stroke={t.deep} strokeOpacity=".45" strokeWidth=".9" />
              {high && <path d="M102.4 46 V104" stroke={thread} {...STITCH} />}
              <path d="M66 46 Q100 40 134 46 Q130 102 100 106 Q70 102 66 46 Z" fill="none" stroke={t.deep} strokeOpacity=".5" strokeWidth="1" />
            </>
          )}
        </>
      );
    case "jacket":
      return (
        <>
          <rect x="48" y="238" width="104" height="14" fill={trim} />
          <rect x="48" y="238" width="104" height="14" fill={url(GD.rib)} />
          <path d="M48 242 H152 M48 247 H152" stroke={color.hex} strokeWidth="1.6" />
          <path d="M14 196 L35 200 L34 210 L14 206 Z" fill={trim} />
          <path d="M186 196 L165 200 L166 210 L186 206 Z" fill={trim} />
          <path d="M70 44 Q100 64 130 44" stroke={trim} strokeWidth="9" fill="none" />
          <path d="M70 44 Q100 64 130 44" stroke={url(GD.rib)} strokeWidth="9" fill="none" />
          {front && (
            <>
              {/* zip: tape, teeth, pull */}
              <path d="M100 56 V238" stroke={t.deep} strokeOpacity=".5" strokeWidth="3.6" />
              <path d="M98.9 57 V238" stroke="#c9c9c3" strokeWidth="1.6" strokeDasharray="1.1 1.1" />
              <path d="M101.1 57.55 V238" stroke="#a5a59f" strokeWidth="1.6" strokeDasharray="1.1 1.1" />
              <rect x="97.6" y="60" width="4.8" height="9" rx="1.2" fill={url(GD.metal)} />
              <rect x="98.6" y="68" width="2.8" height="7" rx="1.2" fill={url(GD.metal)} />
              {high && <path d="M95.5 58 V237 M104.5 58 V237" stroke={thread} {...STITCH} />}
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
          {high && <rect x="40" y="40" width="120" height="216" fill={url(GD.mesh)} opacity=".6" />}
        </>
      );
    case "tank":
      return (
        <>
          <path d="M76 44 Q100 76 124 44" stroke={t.deep} strokeWidth="4" fill="none" />
          <path d="M66 46 Q66 82 48 98 M134 46 Q134 82 152 98" stroke={t.deep} strokeWidth="3" fill="none" />
          {high && <path d="M77 49 Q100 80 123 49" stroke={thread} {...STITCH} />}
        </>
      );
    default:
      return null;
  }
}

function renderPrint(
  p: Print,
  type: TopType,
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
