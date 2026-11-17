import { luminance, shade } from "@/lib/format";
import type { Colorway, GarmentType, Side } from "@/lib/types";
import { GD, STITCH, clipId, tone, url, type Tone } from "./garment/shapes";
import { SHOE_UPPER, type ShoeKind } from "./garment/shapes-shoes";

/*
 * Drawn shoes (shoes without a photo). viewBox 240 x 140, ground at y=132, toe to the right.
 *   "front" side = profile; "back" side = the heel view: the pair seen from behind.
 * Profile: the toe springs up ~6°, the heel sits a little higher than the forefoot, the sole curves up
 * under the arch, and a contact shadow sits on the ground.
 *   sneaker  cupsole with tread notches + stitched midsole, toe cap with perforations, vamp, eyestay
 *            with 6 eyelets, laces crossing over/under with loose ends, padded collar, heel counter,
 *            pull tab, tongue with a plain woven label
 *   runner   mesh upper, sculpted midsole with a gradient, saddle overlay, reflective heel strip
 *   boot     Chelsea: ribbed elastic gusset, pull loop, stacked heel, welt stitch
 *   slide    moulded footbed, thick strap with an embossed (plain chevron) pattern
 * No brand marks. hex = upper, trim = sole. detail="high" adds texture (mesh, perforations, emboss,
 * noise) and stitching.
 */

type Props = { type: GarmentType; color: Colorway; side: Side; label: string; className?: string; detail: "low" | "high" };

export function Shoe({ type, color, side, label, className, detail }: Props) {
  const kind: ShoeKind = type === "boot" || type === "slide" || type === "runner" ? type : "sneaker";
  const t = tone(color.hex);
  const solePaint = color.trim ?? (kind === "boot" ? "#2a2522" : kind === "slide" ? t.sh : "#f1efe8");
  const sole = tone(solePaint);
  const high = detail === "high";
  return (
    <svg
      viewBox="0 0 240 140"
      preserveAspectRatio="xMidYMid meet"
      className={`garment garment--shoe ${className ?? ""}`}
      role="img"
      aria-label={label}
    >
      {side === "front" ? <Profile kind={kind} t={t} sole={sole} high={high} /> : <Heels kind={kind} t={t} sole={sole} high={high} />}
    </svg>
  );
}

type P = { kind: ShoeKind; t: Tone; sole: Tone; high: boolean };

const lace = (t: Tone) => (luminance(t.base) > 0.6 ? "#f8f7f3" : luminance(t.base) < 0.12 ? "#e9e8e3" : shade(t.base, 0.55));
const edge = (t: Tone) => ({ stroke: t.deep, strokeOpacity: 0.75, strokeWidth: 0.9, fill: "none", strokeLinejoin: "round" as const });

function Ground({ cx = 124, rx = 108 }: { cx?: number; rx?: number }) {
  return <ellipse cx={cx} cy="133" rx={rx} ry="5.5" fill={url(GD.ground)} />;
}

function Profile({ kind, t, sole, high }: P) {
  if (kind === "slide") return <Slide t={t} sole={sole} high={high} />;
  if (kind === "boot") return <Boot t={t} sole={sole} high={high} />;
  const runner = kind === "runner";
  const upper = SHOE_UPPER[kind];
  const clip = url(clipId(`upper-${kind}`));
  const thread = shade(t.base, luminance(t.base) > 0.5 ? -0.3 : 0.35);
  // Sole stack: midsole (heel higher than the toe, arch lifted), outsole band with tread notches.
  const mid = runner
    ? "M23 98 Q70 101 120 106 L226 107 Q234 111 229 118 Q212 127 184 127.5 L142 127.5 Q112 123.5 84 127.5 L31 127.5 Q19 126 20 114 Z"
    : "M21 102 L120 108 L228 109 Q233 112.5 228 117 Q210 125.5 182 125.5 L140 125.5 Q112 122.5 86 125.5 L30 125.5 Q19 124.5 20 114 Z";
  const out = runner
    ? "M20 120 Q19 127.5 31 127.5 L84 127.5 Q112 123.5 142 127.5 L184 127.5 Q212 127 229 118 Q231 124 225 126.5 Q210 132.5 182 132.5 L140 132.5 Q112 129.5 86 132.5 L30 132.5 Q18 131.5 20 120 Z"
    : "M20 118 Q19 125.5 30 125.5 L86 125.5 Q112 122.5 140 125.5 L182 125.5 Q210 125.5 228 117 Q231 123 225 126 Q210 132 182 132 L140 132 Q112 129 86 132 L30 132 Q18 131 20 118 Z";
  return (
    <>
      <Ground />
      {/* upper */}
      <path d={upper} fill={t.base} />
      <g clipPath={clip}>
        <rect x="10" y="20" width="230" height="100" fill={url(GD.key)} />
        <rect x="10" y="40" width="230" height="75" fill={url(GD.vert)} />
        {high && runner && <rect x="10" y="40" width="230" height="75" fill={url(GD.mesh)} />}
        {/* toe cap (+ perforations) */}
        <path d="M186 81 Q222 93 228 109 L184 111 Q191 96 186 81 Z" fill={runner ? t.mid : t.hi} />
        {high && !runner && <path d="M192 88 Q214 96 220 106 L193 107 Q196 97 192 88 Z" fill={url(GD.perf)} />}
        <path d="M186 81 Q191 96 184 111" {...edge(t)} />
        {high && <path d="M182.5 83 Q187.5 97 180.5 110.5" stroke={thread} {...STITCH} />}
        {/* heel counter */}
        <path d={runner ? "M24 101 L24 72 Q26 60 40 57 Q52 76 56 104 Z" : "M22 104 L22 70 Q24 58 38 55 Q50 72 54 105 Z"} fill={t.mid} />
        <path d={runner ? "M40 57 Q52 76 56 104" : "M38 55 Q50 72 54 105"} {...edge(t)} />
        {high && <path d={runner ? "M43.5 58 Q55.5 77 59.5 104" : "M41.5 56 Q53.5 73 57.5 105"} stroke={thread} {...STITCH} />}
        {runner && <path d="M24 74 L35 71 L41 99 L25 101 Z" fill={url(GD.reflect)} />}
        {/* saddle / side panel */}
        {runner ? (
          <path d="M90 107 Q98 82 118 66 L132 66 Q116 86 112 108 Z" fill={t.sh} opacity=".75" />
        ) : (
          <path d="M60 104 Q64 80 94 75 L150 71 Q170 75 180 87" {...edge(t)} />
        )}
        {high && !runner && <path d="M63 104 Q67 83 95 78 L150 74 Q168 78 177 89" stroke={thread} {...STITCH} />}
        {/* eyestay */}
        <path d={runner ? "M62 54 Q92 66 122 62 L156 65 L158 74 Q124 77 92 75 Q72 71 60 62 Z" : "M62 51 Q90 64 118 62 L152 63 L155 73 Q120 76 88 74 Q70 70 60 60 Z"} fill={t.mid} />
        <path d={runner ? "M60 62 Q72 71 92 75 Q124 77 158 74" : "M60 60 Q70 70 88 74 Q120 76 155 73"} {...edge(t)} />
        <rect x="10" y="20" width="230" height="100" fill="none" />
        {high && <path d="M60 65 Q71 74 89 77.5 Q121 79.5 156 76.5" stroke={thread} {...STITCH} />}
      </g>
      {/* tongue poking up, with a plain woven label */}
      <path d={runner ? "M62 54 Q66 39 82 38 Q94 39 97 48 L102 60 Q82 61 62 55 Z" : "M61 51 Q63 40 77 38.5 Q89 39 93 47 L100 60 Q80 61 61 52 Z"} fill={t.hi} />
      <path d={runner ? "M62 54 Q66 39 82 38 Q94 39 97 48" : "M61 51 Q63 40 77 38.5 Q89 39 93 47"} {...edge(t)} />
      <g transform={runner ? "rotate(-12 80 44)" : "rotate(-14 76 44)"}>
        <rect x={runner ? 74 : 70} y={runner ? 41 : 41} width="12" height="6.5" rx=".6" fill="#efece3" />
        <path d={runner ? "M76 43.4 H84 M76 45.3 H82" : "M72 43.4 H80 M72 45.3 H78"} stroke="#8a8578" strokeWidth=".55" />
      </g>
      {/* padded collar + pull tab */}
      <path d={runner ? "M26 66 Q30 54 46 52 Q58 52 64 56" : "M24 64 Q28 50 44 48 Q56 48 63 52"} stroke={t.hi} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d={runner ? "M28 68 Q32 57 46 55.5 Q57 55.5 63 59" : "M26 66 Q30 53 44 51.5 Q55 51.5 62 55"} stroke={t.deep} strokeOpacity=".5" strokeWidth="1" fill="none" />
      <path d={runner ? "M26 62 Q20 46 30 44 L35 46 Q34 54 36 58 Z" : "M23 60 Q18 43 28 41 L33 43 Q32 52 34 56 Z"} fill={t.sh} />
      <Laces t={t} runner={runner} />
      <path d={upper} {...edge(t)} />

      {/* sole */}
      <path d={mid} fill={sole.base} />
      <path d={mid} fill={url(GD.sole)} />
      {runner ? (
        <>
          <path d="M26 116 Q60 106 94 117 Q130 128 168 116 Q200 107 226 113" stroke={sole.deep} strokeOpacity=".45" strokeWidth="1.1" fill="none" />
          <path d="M26 114.5 Q60 104.5 94 115.5 Q130 126.5 168 114.5 Q200 105.5 226 111.5" stroke="#fff" strokeOpacity=".45" strokeWidth=".8" fill="none" />
        </>
      ) : (
        <path d="M24 116.5 Q120 119.5 226 115" stroke={sole.deep} strokeOpacity=".55" strokeWidth=".9" fill="none" {...(high ? { strokeDasharray: "2.2 1.6" } : {})} />
      )}
      <path d={mid} {...edge(sole)} />
      <path d={out} fill={sole.sh} />
      <path d="M30 132.3 L86 132.3 Q112 129.3 140 132.3 L182 132.3 Q206 132 222 127" stroke={sole.deep} strokeWidth="3.2" strokeDasharray="1.3 3.4" fill="none" />
      <path d={out} {...edge(sole)} />
      {high && <path d={upper} fill="#000" opacity=".16" filter={url(GD.noise)} />}
    </>
  );
}

/** 6 eyelets along the eyestay, laces crossing over/under (a shadow under each bar), loose ends. */
function Laces({ t, runner }: { t: Tone; runner: boolean }) {
  const c = lace(t);
  const pts = Array.from({ length: 6 }, (_, i) => ({ x: (runner ? 74 : 72) + i * 14.5, y: (runner ? 60 : 57) + i * 2.6 }));
  return (
    <g>
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2.1" fill={t.deep} />
          <circle cx={p.x} cy={p.y} r="2.1" fill="none" stroke={t.hi} strokeWidth=".6" />
        </g>
      ))}
      {pts.slice(0, -1).map((p, i) => {
        const q = pts[i + 1];
        const under = i % 2 === 1;
        return (
          <g key={`l${i}`} opacity={under ? 0.82 : 1}>
            <path d={`M${p.x - 4} ${p.y - 4.5} L${q.x + 2} ${q.y - 1}`} stroke="#000" strokeOpacity=".22" strokeWidth="2.6" strokeLinecap="round" transform="translate(.5 1.2)" />
            <path d={`M${p.x - 4} ${p.y - 4.5} L${q.x + 2} ${q.y - 1}`} stroke={c} strokeWidth="2.4" strokeLinecap="round" />
            <path d={`M${p.x - 3.4} ${p.y - 5.2} L${q.x + 1.6} ${q.y - 1.8}`} stroke="#fff" strokeOpacity=".5" strokeWidth=".6" strokeLinecap="round" />
          </g>
        );
      })}
      {/* loose ends from the top eyelet */}
      <path d={`M${pts[0].x - 2} ${pts[0].y - 3} Q${pts[0].x - 12} ${pts[0].y + 10} ${pts[0].x - 7} ${pts[0].y + 26}`} stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={`M${pts[0].x} ${pts[0].y - 3} Q${pts[0].x + 2} ${pts[0].y + 14} ${pts[0].x + 7} ${pts[0].y + 28}`} stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={`M${pts[0].x - 7.6} ${pts[0].y + 24} l.8 4 M${pts[0].x + 6.4} ${pts[0].y + 26} l1.4 3.6`} stroke={t.deep} strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

function Boot({ t, sole, high }: Omit<P, "kind">) {
  const upper = SHOE_UPPER.boot;
  const clip = url(clipId("upper-boot"));
  const thread = shade(t.base, 0.3);
  return (
    <>
      <Ground cx={126} rx={104} />
      {/* pull loop */}
      <path d="M30 20 Q20 4 33 3 Q41 3 41 15" stroke={t.sh} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d={upper} fill={t.base} />
      <g clipPath={clip}>
        <rect x="10" y="0" width="230" height="120" fill={url(GD.key)} />
        <rect x="20" y="0" width="80" height="110" fill={url(GD.cyl)} />
        {/* elastic gusset, ribbed */}
        <path d="M63 15 L87 15 L91 63 Q78 74 67 63 Z" fill={t.deep} />
        <path d="M63 15 L87 15 L91 63 Q78 74 67 63 Z" fill={url(GD.rib)} />
        <path d="M63 15 L67 63 Q78 74 91 63 L87 15" stroke={t.deep} strokeWidth="1.2" fill="none" />
        {high && <path d="M60 15 L64 64 Q78 78 94 64 L90 15" stroke={thread} {...STITCH} />}
        {/* vamp / quarter seam + toe highlight */}
        <path d="M94 64 Q120 82 112 105" {...edge(t)} />
        <path d="M150 78 Q200 86 220 100" stroke="#fff" strokeOpacity=".22" strokeWidth="5" fill="none" filter={url(GD.soft)} />
        {/* creases over the instep */}
        <path d="M104 70 Q112 76 116 86 M112 70 Q120 77 124 86" stroke={t.deep} strokeOpacity=".35" strokeWidth="1" fill="none" />
      </g>
      <path d={upper} {...edge(t)} />
      {high && <path d={upper} fill="#000" opacity=".14" filter={url(GD.noise)} />}
      {/* welt + sole: stacked heel, forefoot touching the ground, arch lifted, toe sprung */}
      <path d="M22 103 L226 104 Q234 109 229 116 Q214 129 196 132 L150 132 Q120 124 86 124 L70 124 L68 132 L24 132 Z" fill={sole.base} />
      <path d="M22 103 L226 104 Q234 109 229 116 L24 110 Z" fill={sole.hi} />
      <path d="M24 106.6 L224 107.6" stroke={shade(sole.base, 0.45)} {...STITCH} />
      {[118, 122.5, 127].map((y) => (
        <path key={y} d={`M24.5 ${y} H68.5`} stroke={sole.deep} strokeOpacity=".8" strokeWidth=".8" />
      ))}
      <path d="M22 103 L226 104 Q234 109 229 116 Q214 129 196 132 L150 132 Q120 124 86 124 L70 124 L68 132 L24 132 Z" {...edge(sole)} />
    </>
  );
}

function Slide({ t, sole, high }: Omit<P, "kind">) {
  const strap = "M98 109 Q102 58 156 56 Q202 58 214 109 Z";
  return (
    <>
      <Ground />
      {/* moulded footbed: slab + raised rim + toe ridge */}
      <path d="M16 117 Q14 131 28 131.5 L212 131.5 Q233 129.5 230 115 Q228 106 214 106 L30 106 Q16 106 16 117 Z" fill={sole.base} />
      <path d="M16 117 Q14 131 28 131.5 L212 131.5 Q233 129.5 230 115 Q228 106 214 106 L30 106 Q16 106 16 117 Z" fill={url(GD.sole)} />
      <path d="M22 110 Q30 103 46 105 Q96 109 146 107 Q192 104.5 222 108" stroke={sole.hi} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M24 113 Q100 117 224 112" stroke={sole.deep} strokeOpacity=".5" strokeWidth="1" fill="none" />
      <path d="M200 105.5 Q212 102 222 106" stroke={sole.deep} strokeOpacity=".4" strokeWidth="1" fill="none" />
      <path d="M16 117 Q14 131 28 131.5 L212 131.5 Q233 129.5 230 115 Q228 106 214 106 L30 106 Q16 106 16 117 Z" {...edge(sole)} />
      {/* strap: thickness band at the bottom, embossed face */}
      <path d={strap} fill={t.base} />
      <path d={strap} fill={url(GD.key)} />
      {high && <path d={strap} fill={url(GD.emboss)} />}
      <path d="M104 100 Q108 66 156 64 Q197 66 208 100" stroke={t.hi} strokeOpacity=".55" strokeWidth="1.2" fill="none" />
      {high && <path d="M101.5 104 Q105 62 156 60 Q199.5 62 211 104" stroke={shade(t.base, 0.3)} {...STITCH} />}
      <path d="M98 109 L214 109 L212 104 L100 104 Z" fill={t.deep} opacity=".55" />
      <path d={strap} {...edge(t)} />
    </>
  );
}

/** Heel view: the pair from behind, sole width, counters, pull tabs, a shadow under each heel. */
function Heels({ kind, t, sole, high }: P) {
  return (
    <>
      {[92, 148].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="133" rx="30" ry="4.5" fill={url(GD.ground)} />
          <Heel cx={cx} kind={kind} t={t} sole={sole} high={high} />
        </g>
      ))}
    </>
  );
}

function Heel({ cx, kind, t, sole, high }: P & { cx: number }) {
  const w = 24; // half width at the counter
  if (kind === "slide") {
    return (
      <>
        <path d={`M${cx - w} 114 Q${cx - w - 2} 131.5 ${cx - w + 12} 131.5 L${cx + w - 12} 131.5 Q${cx + w + 2} 131.5 ${cx + w} 114 Z`} fill={sole.base} />
        <path d={`M${cx - w} 114 Q${cx - w - 2} 131.5 ${cx - w + 12} 131.5 L${cx + w - 12} 131.5 Q${cx + w + 2} 131.5 ${cx + w} 114 Z`} fill={url(GD.sole)} />
        <path d={`M${cx - w + 3} 114 Q${cx - w + 3} 70 ${cx} 68 Q${cx + w - 3} 70 ${cx + w - 3} 114`} stroke={t.base} strokeWidth="12" fill="none" />
        <path d={`M${cx - w + 3} 114 Q${cx - w + 3} 70 ${cx} 68 Q${cx + w - 3} 70 ${cx + w - 3} 114`} stroke={high ? url(GD.emboss) : t.base} strokeWidth="12" fill="none" />
        <path d={`M${cx - w - 3} 114 Q${cx - w - 3} 64 ${cx} 62 Q${cx + w + 3} 64 ${cx + w + 3} 114`} {...edge(t)} />
      </>
    );
  }
  const boot = kind === "boot";
  const top = boot ? 14 : kind === "runner" ? 46 : 42;
  const body = `M${cx - w + 2} 116 L${cx - w} ${top + 26} Q${cx - w} ${top} ${cx} ${top - 2} Q${cx + w} ${top} ${cx + w} ${top + 26} L${cx + w - 2} 116 Z`;
  const outsole = boot
    ? `M${cx - w + 2} 112 L${cx - w + 2} 132.5 L${cx + w - 2} 132.5 L${cx + w - 2} 112 Z`
    : `M${cx - w - 1} 110 Q${cx - w - 3} 132.5 ${cx - w + 10} 132.5 L${cx + w - 10} 132.5 Q${cx + w + 3} 132.5 ${cx + w + 1} 110 Z`;
  return (
    <>
      <path d={body} fill={t.base} />
      <path d={body} fill={url(GD.cyl)} />
      <path d={body} fill={url(GD.key)} />
      {high && kind === "runner" && <path d={body} fill={url(GD.mesh)} />}
      {!boot && (
        <>
          {/* heel counter cup */}
          <path d={`M${cx - w + 1} 114 L${cx - w + 0.5} ${top + 40} Q${cx} ${top + 32} ${cx + w - 0.5} ${top + 40} L${cx + w - 1} 114 Z`} fill={t.mid} />
          <path d={`M${cx - w + 0.5} ${top + 40} Q${cx} ${top + 32} ${cx + w - 0.5} ${top + 40}`} {...edge(t)} />
          {high && <path d={`M${cx - w + 1} ${top + 44} Q${cx} ${top + 36} ${cx + w - 1} ${top + 44}`} stroke={shade(t.base, 0.3)} {...STITCH} />}
          {kind === "runner" && <rect x={cx - 3} y={top + 8} width="6" height="34" rx="2" fill={url(GD.reflect)} />}
          {/* pull tab + padded collar */}
          <path d={`M${cx - 6} ${top - 1} Q${cx} ${top - 14} ${cx + 6} ${top - 1} L${cx + 5} ${top + 8} Q${cx} ${top + 10} ${cx - 5} ${top + 8} Z`} fill={t.sh} />
          <path d={`M${cx - w + 4} ${top + 7} Q${cx} ${top - 4} ${cx + w - 4} ${top + 7}`} stroke={t.hi} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}
      {boot && <path d={`M${cx - 5} ${top - 1} Q${cx} ${top - 14} ${cx + 5} ${top - 1}`} stroke={t.sh} strokeWidth="3.5" fill="none" strokeLinecap="round" />}
      <path d={body} {...edge(t)} />
      {high && <path d={body} fill="#000" opacity=".14" filter={url(GD.noise)} />}
      <path d={outsole} fill={sole.base} />
      <path d={outsole} fill={url(GD.sole)} />
      {boot ? (
        [118, 122.5, 127].map((y) => <path key={y} d={`M${cx - w + 2} ${y} H${cx + w - 2}`} stroke={sole.deep} strokeOpacity=".8" strokeWidth=".8" />)
      ) : (
        <>
          <path d={`M${cx - w} 121 H${cx + w}`} stroke={sole.deep} strokeOpacity=".55" strokeWidth=".9" />
          <path d={`M${cx - w + 6} 132 H${cx + w - 6}`} stroke={sole.deep} strokeWidth="2.4" strokeDasharray="1.2 3" />
        </>
      )}
      <path d={outsole} {...edge(sole)} />
    </>
  );
}
