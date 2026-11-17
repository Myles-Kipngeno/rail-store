import type { ReactNode } from "react";
import { inkFor, shade } from "@/lib/format";
import type { Colorway, GarmentType, Print, Side } from "@/lib/types";
import { GD, STITCH, clipId, tone, url, type Tone } from "./garment/shapes";
import { TROUSERS, WAISTBAND, type TrouserKind, type TrouserShape } from "./garment/shapes-bottoms";

/*
 * Drawn trousers (bottoms without a photo). Same 200 x 260 viewBox as the tops, hook top at y≈10, on a
 * clip hanger: a metal bar with a highlight and two spring clips gripping the waistband corners; the
 * waist sags a little between them. Outlines live in garment/shapes.ts, gradients/filters in the
 * page sprite (GarmentDefs.tsx).
 *   pants   belt loops, button, fly with J-stitch, slant pockets (coin pocket on denim), straight leg
 *   cargo   wide leg + bellows pockets with snapped flaps on the outer thighs
 *   joggers elastic rib waist + drawcord with aglets, tapered, gathered rib cuffs
 *   shorts  as pants, turned-up hem with a side split
 * Folds: crotch whiskers, a knee bend, a stacked break at the hem. Back: yoke, stitched back pockets,
 * waistband label. Tones from the colourway hex (shapes.ts tone()).
 * `trim`: joggers → rib waist and cuffs (+ a side stripe when it differs from hex); shorts → side stripe
 * when it differs; pants/cargo/shorts → thread colour (gold-ish by default on denim).
 * detail="high" adds fabric noise (and twill on denim), dashed stitching and the fine folds.
 */

const DISPLAY = { fontFamily: "var(--font-display)", fontWeight: 900, fontStretch: "125%" } as const;
const CLIP = "#262624";

type Props = {
  type: GarmentType;
  color: Colorway;
  side: Side;
  prints: Print[];
  label: string;
  className?: string;
  detail: "low" | "high";
  /** Denim (category "jeans"): coin pocket, rivet-free metal button, gold thread, twill texture. */
  denim?: boolean;
};

export function Trousers({ type, color, side, prints, label, className, detail, denim = false }: Props) {
  const kind: TrouserKind = type === "cargo" || type === "joggers" || type === "shorts" ? type : "pants";
  const s = TROUSERS[kind];
  const t = tone(color.hex);
  const high = detail === "high";
  const front = side === "front";
  const elastic = kind === "joggers";
  const differs = !!color.trim && color.trim.toLowerCase() !== color.hex.toLowerCase();
  const stripe = differs && (kind === "joggers" || kind === "shorts");
  const rib = elastic ? (color.trim ?? t.mid) : t.base;
  const thread = elastic ? shade(color.hex, 0.28) : denim ? (color.trim ?? "#c99a45") : differs ? color.trim! : shade(color.hex, 0.3);
  const clip = url(clipId(kind));

  return (
    <svg viewBox="0 0 200 260" className={`garment garment--bottom ${className ?? ""}`} role="img" aria-label={label}>
      <Hanger />

      <path d={s.body} fill={t.base} />

      <g clipPath={clip}>
        {/* per-leg roll-off + key light */}
        <rect x={s.legL[0]} y="44" width={s.legL[1] - s.legL[0]} height={s.hem - 44} fill={url(GD.cyl)} />
        <rect x={s.legR[0]} y="44" width={s.legR[1] - s.legR[0]} height={s.hem - 44} fill={url(GD.cyl)} />
        <rect x="40" y="40" width="120" height={s.hem - 36} fill={url(GD.key)} />
        {high && denim && <rect x="40" y="40" width="120" height={s.hem - 36} fill={url(GD.twill)} />}

        {stripe && s.out.map((d, i) => <path key={i} d={d} stroke={color.trim} strokeWidth="7" fill="none" strokeLinejoin="round" />)}

        <Folds s={s} t={t} kind={kind} front={front} high={high} />

        {front ? <Front t={t} kind={kind} denim={denim} thread={thread} high={high} /> : <Back t={t} kind={kind} thread={thread} high={high} />}

        {kind === "cargo" && <Cargo t={t} thread={thread} high={high} />}
        {elastic ? <Cuffs s={s} rib={rib} /> : <Hem s={s} t={t} kind={kind} thread={thread} high={high} />}

        {/* waistband */}
        <path d={WAISTBAND} fill={rib} />
        <path d={WAISTBAND} fill={url(GD.key)} />
        {elastic && <path d={WAISTBAND} fill={url(GD.rib)} />}
        <path d="M60 58 Q100 65 140 58" stroke={t.deep} strokeOpacity=".45" strokeWidth="1.2" fill="none" />
        {high && !elastic && (
          <>
            <path d="M62 48.5 Q100 55.3 138 48.5" stroke={thread} {...STITCH} />
            <path d="M61 55.5 Q100 62.4 139 55.5" stroke={thread} {...STITCH} />
          </>
        )}
        {!elastic && <Loops t={t} front={front} />}
        {!front && (
          <>
            {/* waistband label (centre back, under the loop) */}
            <rect x="93.5" y="50" width="13" height="7.5" rx=".8" fill="#ece7da" />
            <path d="M96 52.7 H104 M96 55.1 H102" stroke="#8c867a" strokeWidth=".6" />
          </>
        )}
        {front && !elastic && (
          <>
            <circle cx="100" cy="52.5" r="3.1" fill={denim ? url(GD.metal) : t.deep} />
            <circle cx="100" cy="52.5" r="3.1" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth=".6" />
            <circle cx="100" cy="52.5" r="1.1" fill="#000" opacity=".25" />
          </>
        )}

        {front && prints.map((p, i) => <g key={i}>{thighPrint(p, color, t)}</g>)}

        {/* gap between the legs + edges turning away */}
        {s.inner.map((d, i) => (
          <path key={i} d={d} stroke={t.deep} strokeOpacity=".55" strokeWidth="6" fill="none" filter={url(GD.soft)} />
        ))}
        <path d={s.body} fill="none" stroke={t.deep} strokeOpacity=".35" strokeWidth="7" filter={url(GD.softer)} />
        {high && <path d={s.body} fill="#000" opacity=".22" filter={url(GD.noise)} />}
      </g>

      {high && s.out.map((d, i) => <Outseam key={i} d={d} dir={i ? -1 : 1} thread={thread} />)}
      <path d={s.body} fill="none" stroke={t.deep} strokeOpacity=".7" strokeWidth=".9" strokeLinejoin="round" />
      <Clips />
    </svg>
  );
}

/** Clip hanger: hook, metal bar with a highlight (behind the waistband). */
function Hanger() {
  return (
    <>
      <path d="M100 31 V22 Q100 10 109 10 Q118 10 118 19" stroke="#8d8d88" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M101 29 V22 Q101 11.5 109 11.5" stroke="#efefea" strokeWidth=".8" fill="none" strokeLinecap="round" />
      <rect x="54" y="30" width="92" height="5" rx="2.5" fill={url(GD.metal)} />
      <path d="M57 31.4 H143" stroke="#fff" strokeOpacity=".7" strokeWidth=".7" strokeLinecap="round" />
    </>
  );
}

/** Two spring clips gripping the waistband corners. */
function Clips() {
  return (
    <>
      {[64, 136].map((x) => (
        <g key={x}>
          <rect x={x - 6} y="28" width="12" height="16" rx="2" fill={CLIP} />
          <rect x={x - 6} y="28" width="12" height="3" rx="1.5" fill="#3d3d3a" />
          {/* spring */}
          {[33, 35.5, 38].map((y) => (
            <path key={y} d={`M${x - 4.5} ${y} Q${x} ${y + 1.6} ${x + 4.5} ${y}`} stroke="#b9b9b3" strokeWidth=".7" fill="none" />
          ))}
          {/* jaw */}
          <path d={`M${x - 5} 44 H${x + 5} L${x + 4} 53 H${x - 4} Z`} fill="#1b1b19" />
          <path d={`M${x - 3.5} 52.2 H${x + 3.5}`} stroke="#6d6d68" strokeWidth=".8" strokeDasharray="1 .8" />
          <circle cx={x} cy="41" r="1.4" fill={url(GD.metal)} />
        </g>
      ))}
    </>
  );
}

/** Belt loops (front 4, back 5 incl. centre back). */
function Loops({ t, front }: { t: Tone; front: boolean }) {
  const xs = front ? [70, 86, 114, 130] : [68, 84, 100, 116, 132];
  return (
    <>
      {xs.map((x) => (
        <g key={x}>
          <rect x={x - 2.2} y="45.5" width="4.4" height="15" rx="1" fill={t.hi} />
          <path d={`M${x - 2.2} 46 V60.5 M${x + 2.2} 46 V60.5`} stroke={t.deep} strokeOpacity=".45" strokeWidth=".6" />
          <rect x={x - 2.2} y="58.5" width="4.4" height="2.4" fill={t.deep} opacity=".25" />
        </g>
      ))}
    </>
  );
}

function Front({ t, kind, denim, thread, high }: { t: Tone; kind: TrouserKind; denim: boolean; thread: string; high: boolean }) {
  const elastic = kind === "joggers";
  return (
    <>
      {/* slant pockets: opening + the shaded pocket bag behind it */}
      <path d="M70 59 Q74 80 58.5 97 Q56.5 76 60 58 Z" fill={t.deep} opacity=".22" />
      <path d="M130 59 Q126 80 141.5 97 Q143.5 76 140 58 Z" fill={t.deep} opacity=".22" />
      <path d="M70 59 Q74 80 58.5 97 M130 59 Q126 80 141.5 97" stroke={t.deep} strokeOpacity=".6" strokeWidth="1.2" fill="none" />
      <path d="M71.5 60 Q75.5 81 60 98.5 M128.5 60 Q124.5 81 140 98.5" stroke={t.hi} strokeOpacity=".7" strokeWidth=".9" fill="none" />
      {high && <path d="M73.5 61 Q77.5 82 62 100 M126.5 61 Q122.5 82 138 100" stroke={thread} {...STITCH} />}

      {elastic ? (
        <>
          {/* drawcord with aglets */}
          <circle cx="95" cy="57" r="1.3" fill={t.deep} />
          <circle cx="105" cy="57" r="1.3" fill={t.deep} />
          <path d="M95 57.5 Q93 70 89.5 84 M105 57.5 Q108 71 111.5 82" stroke={shade(t.base, 0.55)} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M95 57.5 Q93 70 89.5 84 M105 57.5 Q108 71 111.5 82" stroke="#000" strokeOpacity=".15" strokeWidth=".6" fill="none" transform="translate(.6 .4)" />
          <rect x="87.6" y="83" width="3.6" height="7" rx="1.2" fill={url(GD.metal)} transform="rotate(12 89.4 86.5)" />
          <rect x="110.2" y="81" width="3.6" height="7" rx="1.2" fill={url(GD.metal)} transform="rotate(-14 112 84.5)" />
          <path d="M100 62 V112" stroke={t.deep} strokeOpacity=".35" strokeWidth="1" />
        </>
      ) : (
        <>
          {/* fly with J-stitch (the button sits on the waistband, drawn after it) */}
          <path d="M100 62 V116" stroke={t.deep} strokeOpacity=".55" strokeWidth="1.1" />
          <path d="M107.5 62 V104 Q107.5 113.5 100 116" stroke={high ? thread : t.deep} strokeOpacity={high ? 1 : 0.4} {...(high ? STITCH : { strokeWidth: 1, fill: "none" })} />
          <path d="M101.5 62 V115" stroke={t.hi} strokeOpacity=".5" strokeWidth=".7" />
          {denim && (
            <>
              <path d="M117 62.5 L131 61.5 L131.6 75.5 L117.6 76.5 Z" fill={t.mid} opacity=".6" />
              <path d="M117 62.5 L131 61.5 L131.6 75.5 L117.6 76.5" stroke={t.deep} strokeOpacity=".5" strokeWidth=".7" fill="none" />
              {high && <path d="M118.5 64.5 L129.6 63.7" stroke={thread} {...STITCH} />}
            </>
          )}
        </>
      )}
    </>
  );
}

function Back({ t, kind, thread, high }: { t: Tone; kind: TrouserKind; thread: string; high: boolean }) {
  const welt = kind === "joggers";
  const pockets = "M67 85 L92 83 L93 108 L80.5 115 L68 108 Z M108 83 L133 85 L132 108 L119.5 115 L107 108 Z";
  return (
    <>
      {/* yoke + centre seam */}
      {!welt && <path d="M57 72 Q80 78 100 86 Q120 78 143 72" stroke={t.deep} strokeOpacity=".5" strokeWidth="1.1" fill="none" />}
      {high && !welt && <path d="M57 75.5 Q80 81.5 100 89.5 Q120 81.5 143 75.5" stroke={thread} {...STITCH} />}
      <path d="M100 60 V118" stroke={t.deep} strokeOpacity=".45" strokeWidth="1" />
      {welt ? (
        <path d="M70 92 H90 M110 92 H130" stroke={t.deep} strokeOpacity=".6" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <>
          <path d={pockets} fill={t.hi} opacity=".55" />
          <path d={pockets} fill="none" stroke={t.deep} strokeOpacity=".55" strokeWidth=".9" />
          <path d="M67 85 L92 83 L92.3 89 L67.2 91 Z M108 83 L133 85 L132.8 91 L107.7 89 Z" fill={t.deep} opacity=".12" />
          {high && (
            <path
              d="M69.5 87.5 L90 86 L90.8 106.6 L80.5 112.4 L70.4 106.6 Z M110 86 L130.5 87.5 L129.6 106.6 L119.5 112.4 L109.2 106.6 Z"
              stroke={thread}
              {...STITCH}
            />
          )}
        </>
      )}
    </>
  );
}

/** Whiskers at the crotch, a knee bend, a stacked break above the hem (joggers bunch above the cuff). */
function Folds({ s, t, kind, front, high }: { s: TrouserShape; t: Tone; kind: TrouserKind; front: boolean; high: boolean }) {
  const legs = [s.legL, s.legR];
  const short = kind === "shorts";
  const knee = 172;
  const crease = (d: string, w: number, o: number, c: string) => (
    <path d={d} stroke={c} strokeOpacity={o} strokeWidth={w} fill="none" strokeLinecap="round" filter={url(GD.soft)} />
  );
  return (
    <g>
      {/* crotch whiskers */}
      {front &&
        [
          ["M84 103 Q91 109 98 116", "M116 103 Q109 109 102 116"],
          ["M82 111 Q90 115 97.5 121", "M118 111 Q110 115 102.5 121"],
          ["M86 96 Q92 102 98.5 110", "M114 96 Q108 102 101.5 110"],
          ...(high ? [["M80 119 Q88 121 96 126", "M120 119 Q112 121 104 126"]] : []),
        ].map(([a, b], i) => (
          <g key={i}>
            {crease(a, 1.8, 0.55, t.hi)}
            {crease(b, 1.8, 0.55, t.hi)}
            <path d={a} transform="translate(0 1.8)" stroke={t.sh} strokeOpacity=".6" strokeWidth="1.2" fill="none" />
            <path d={b} transform="translate(0 1.8)" stroke={t.sh} strokeOpacity=".6" strokeWidth="1.2" fill="none" />
          </g>
        ))}
      {/* knee bend */}
      {!short &&
        legs.map(([l, r], i) => {
          const m = (l + r) / 2;
          return (
            <g key={i}>
              {crease(`M${l + 4} ${knee - 4} Q${m} ${knee - 11} ${r - 4} ${knee - 2}`, 5, 0.45, t.hi)}
              {crease(`M${l + 4} ${knee + 6} Q${m} ${knee + 1} ${r - 4} ${knee + 8}`, 4, 0.5, t.sh)}
              {high && crease(`M${m - 6} ${knee - 30} Q${m - 2} ${knee - 10} ${m + 2} ${knee + 12}`, 1.4, 0.35, t.mid)}
            </g>
          );
        })}
      {/* long vertical leg fold */}
      {legs.map(([l, r], i) => {
        const m = (l + r) / 2 + (i ? 3 : -3);
        return <g key={`v${i}`}>{crease(`M${m} 120 Q${m - 2} ${s.hem - 70} ${m + 1} ${s.hem - 30}`, 4, 0.18, t.sh)}</g>;
      })}
      {/* stacked break at the hem (2–3 folds) */}
      {!short &&
        kind !== "joggers" &&
        legs.map(([l, r], i) =>
          [222, 233, 243].slice(0, high ? 3 : 2).map((y, j) => (
            <g key={`${i}-${j}`}>
              {crease(`M${l + 2} ${y} Q${(l + r) / 2} ${y + 6} ${r - 2} ${y - 1}`, 2.4, 0.5, t.hi)}
              {crease(`M${l + 2} ${y + 3} Q${(l + r) / 2} ${y + 9} ${r - 2} ${y + 2}`, 2, 0.55, t.sh)}
            </g>
          )),
        )}
      {/* joggers: fabric bunching above the cuff */}
      {kind === "joggers" &&
        legs.map(([l, r], i) =>
          [206, 216, 225].map((y, j) => (
            <g key={`${i}-${j}`}>
              {crease(`M${l + 6 + j * 2} ${y} Q${(l + r) / 2} ${y - 5} ${r - 6 - j * 2} ${y + 1}`, 2.4, 0.5, t.hi)}
              {crease(`M${l + 6 + j * 2} ${y + 3} Q${(l + r) / 2} ${y - 2} ${r - 6 - j * 2} ${y + 4}`, 2, 0.55, t.sh)}
            </g>
          )),
        )}
    </g>
  );
}

/** Hem: stitched on pants/cargo; turned-up with a side split on shorts. */
function Hem({ s, t, kind, thread, high }: { s: TrouserShape; t: Tone; kind: TrouserKind; thread: string; high: boolean }) {
  const y = s.hem;
  if (kind === "shorts")
    return (
      <>
        <rect x="40" y={y - 10} width="120" height="10" fill={t.mid} />
        <rect x="40" y={y - 10} width="120" height="10" fill={url(GD.vert)} />
        <path d={`M40 ${y - 10} H160`} stroke={t.deep} strokeOpacity=".55" strokeWidth=".9" />
        <path d={`M40 ${y - 8.6} H160`} stroke={t.hi} strokeOpacity=".5" strokeWidth=".6" />
        {high && <path d={`M40 ${y - 6} H160`} stroke={thread} {...STITCH} />}
        {/* side splits */}
        <path d={`M50.8 ${y - 13} L50.2 ${y} M149.2 ${y - 13} L149.8 ${y}`} stroke={t.deep} strokeOpacity=".8" strokeWidth="1.1" />
        <path d={`M49 ${y} L50.2 ${y - 4} L51.6 ${y} Z M151 ${y} L149.8 ${y - 4} L148.4 ${y} Z`} fill={t.deep} opacity=".6" />
      </>
    );
  return (
    <>
      <path d={`M40 ${y - 6} H160`} stroke={t.deep} strokeOpacity=".3" strokeWidth=".8" />
      {high && <path d={`M40 ${y - 3.5} H160`} stroke={thread} {...STITCH} />}
    </>
  );
}

function Cuffs({ s, rib }: { s: TrouserShape; rib: string }) {
  const top = s.hem - 18;
  return (
    <>
      <path d={`M40 ${top} H160 V${s.hem} H40 Z`} fill={rib} />
      <path d={`M40 ${top} H160 V${s.hem} H40 Z`} fill={url(GD.rib)} />
      <path d={`M40 ${top} H160 V${s.hem} H40 Z`} fill={url(GD.vert)} />
      <path d={`M40 ${top} H160`} stroke="#000" strokeOpacity=".28" strokeWidth="1" />
    </>
  );
}

/** Bellows pockets with snapped flaps on the outer thighs (and the flap's shadow). */
function Cargo({ t, thread, high }: { t: Tone; thread: string; high: boolean }) {
  const pocket = (x0: number, x1: number) => {
    const m = (x0 + x1) / 2;
    return (
      <g key={x0}>
        <path d={`M${x0} 134 H${x1} L${x1 + 0.6} 178 Q${m} 183 ${x0} 178 Z`} fill={t.base} />
        <path d={`M${x0} 134 H${x1} L${x1 + 0.6} 178 Q${m} 183 ${x0} 178 Z`} fill={url(GD.cyl)} />
        {/* bellows gussets */}
        <path d={`M${x0} 134 L${x0 + 3} 136 L${x0 + 3} 177 L${x0} 178 Z M${x1} 134 L${x1 - 3} 136 L${x1 - 3} 177 L${x1 + 0.6} 178 Z`} fill={t.sh} opacity=".6" />
        <path d={`M${m} 140 V178`} stroke={t.deep} strokeOpacity=".35" strokeWidth="1" />
        <path d={`M${x0} 134 H${x1} L${x1 + 0.6} 178 Q${m} 183 ${x0} 178 Z`} fill="none" stroke={t.deep} strokeOpacity=".6" strokeWidth="1" />
        {/* flap + its shadow */}
        <path d={`M${x0 - 1} 139.5 H${x1 + 1} V142 Q${m} 146 ${x0 - 1} 142 Z`} fill="#000" opacity=".28" filter={url(GD.soft)} />
        <path d={`M${x0 - 1} 125 H${x1 + 1} L${x1 + 1.2} 139 Q${m} 143 ${x0 - 1.2} 139 Z`} fill={t.hi} />
        <path d={`M${x0 - 1} 125 H${x1 + 1} L${x1 + 1.2} 139 Q${m} 143 ${x0 - 1.2} 139 Z`} fill="none" stroke={t.deep} strokeOpacity=".6" strokeWidth="1" />
        {high && <path d={`M${x0 + 1.5} 137 Q${m} 140.5 ${x1 - 1.5} 137`} stroke={thread} {...STITCH} />}
        <circle cx={m} cy="136" r="2.3" fill={url(GD.metal)} />
        <circle cx={m} cy="136" r=".8" fill="#000" opacity=".3" />
      </g>
    );
  };
  return (
    <>
      {pocket(52, 79)}
      {pocket(121, 148)}
    </>
  );
}

/** Double stitch along an outseam: two dashed lines just inside it. */
function Outseam({ d, dir, thread }: { d: string; dir: 1 | -1; thread: string }) {
  return (
    <>
      <path d={d} transform={`translate(${2 * dir} 0)`} stroke={thread} {...STITCH} strokeOpacity=".75" strokeWidth=".7" />
      <path d={d} transform={`translate(${3.8 * dir} 0)`} stroke={thread} {...STITCH} strokeOpacity=".6" strokeWidth=".7" />
    </>
  );
}

/** Small graphics on the left thigh (the wearer's left, so the viewer's right). */
function thighPrint(p: Print, color: Colorway, t: Tone): ReactNode {
  const x = 120;
  const ink = inkFor(color.hex);
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
        <text x={x} y="124" fontSize="5.5" textAnchor="middle" fill={ink} letterSpacing=".8" style={DISPLAY}>
          {(p.t ?? "").toUpperCase()}
        </text>
      );
    case "letter":
      return (
        <text x={x} y="146" fontSize="22" textAnchor="middle" fill={color.trim ?? ink} stroke={t.deep} strokeWidth="1.4" paintOrder="stroke" style={DISPLAY}>
          {(p.t ?? "R").slice(0, 2).toUpperCase()}
        </text>
      );
    default:
      return null;
  }
}
