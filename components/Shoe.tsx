import { shade } from "@/lib/format";
import type { Colorway, GarmentType, Side } from "@/lib/types";

/*
 * Drawn shoes (shoes without a photo). viewBox 240 x 140, ground at y=132.
 *   "front" side = profile, toe to the right; "back" side = the heel, seen from behind.
 * hex = upper, trim = sole. Sneaker: sole + midsole line, upper, laces and eyelets, tongue, heel tab,
 * toe cap. Boot: Chelsea shaft with an elastic gusset and a pull tab, stacked heel. Slide: footbed + strap.
 * Garment.tsx delegates here; a real photo replaces the drawing as for everything else.
 */

type Props = { uid: string; type: GarmentType; color: Colorway; side: Side; label: string; className?: string };

export function Shoe({ uid, type, color, side, label, className }: Props) {
  const upper = color.hex;
  const dark = shade(upper, -0.25);
  const sole = color.trim ?? (type === "boot" ? "#2a2522" : "#f1efe8");
  const soleDark = shade(sole, -0.18);
  const kind = type === "boot" || type === "slide" ? type : "sneaker";

  return (
    <svg
      viewBox="0 0 240 140"
      preserveAspectRatio="xMidYMid meet"
      className={`garment garment--shoe ${className ?? ""}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={`${uid}v`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".14" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".16" />
        </linearGradient>
      </defs>
      {side === "front"
        ? profile(kind, uid, upper, dark, sole, soleDark)
        : heel(kind, uid, upper, dark, sole, soleDark)}
    </svg>
  );
}

const line = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

function profile(kind: "sneaker" | "boot" | "slide", uid: string, upper: string, dark: string, sole: string, soleDark: string) {
  const sheen = `url(#${uid}v)`;
  if (kind === "slide") {
    return (
      <>
        <path d="M16 116 Q14 130 28 131 L212 131 Q232 129 229 114 Q227 106 214 106 L30 106 Q16 106 16 116 Z" fill={sole} />
        <path d="M20 112 Q120 116 226 111" stroke={soleDark} strokeWidth="1.4" {...line} />
        <path d="M100 108 Q106 62 156 60 Q198 62 210 108 Z" fill={upper} />
        <path d="M100 108 Q106 62 156 60 Q198 62 210 108 Z" fill={sheen} />
        <path d="M112 100 Q118 72 156 70 Q190 72 198 100" stroke={dark} strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="3 3" {...line} />
        <path d="M100 108 Q106 62 156 60 Q198 62 210 108" stroke="#000" strokeOpacity=".2" strokeWidth="1" {...line} />
      </>
    );
  }
  if (kind === "boot") {
    return (
      <>
        {/* sole: stacked heel + forefoot */}
        <path d="M22 112 L22 132 L64 132 L66 122 L214 122 Q230 121 229 112 Z" fill={sole} />
        <path d="M22 122 H64" stroke={soleDark} strokeWidth="1.2" />
        {/* upper */}
        <path d="M24 114 L26 22 Q26 14 36 14 L82 14 Q90 14 90 24 L94 64 Q136 70 178 80 Q224 90 228 114 Z" fill={upper} />
        {/* elastic gusset */}
        <path d="M66 16 L84 16 L88 62 Q78 70 70 62 Z" fill={dark} />
        {[70, 74, 78, 82].map((x) => (
          <path key={x} d={`M${x} 18 L${x + 2} 62`} stroke="#000" strokeOpacity=".2" strokeWidth=".8" />
        ))}
        {/* pull tab */}
        <path d="M26 20 Q16 6 30 4 Q38 4 38 14" stroke={dark} strokeWidth="4" {...line} />
        <path d="M24 114 L26 22 Q26 14 36 14 L82 14 Q90 14 90 24 L94 64 Q136 70 178 80 Q224 90 228 114 Z" fill={sheen} />
        <path d="M24 114 Q120 118 228 114" stroke="#000" strokeOpacity=".25" strokeWidth="1.2" {...line} />
        <path d="M24 114 L26 22 Q26 14 36 14 L82 14 Q90 14 90 24 L94 64 Q136 70 178 80 Q224 90 228 114" stroke="#000" strokeOpacity=".2" strokeWidth="1" {...line} />
      </>
    );
  }
  return (
    <>
      {/* outsole + midsole */}
      <path d="M14 114 Q12 130 26 132 L214 132 Q232 130 230 114 L228 106 L18 106 Z" fill={sole} />
      <path d="M16 121 Q120 124 229 120" stroke={soleDark} strokeWidth="1.4" {...line} />
      {/* upper */}
      <path d="M20 108 L22 70 Q24 50 44 48 L66 50 Q92 64 120 62 L148 60 Q178 70 200 82 Q226 92 228 108 Z" fill={upper} />
      {/* toe cap + side panel stitching */}
      <path d="M186 78 Q222 90 228 108 L190 108 Q194 92 186 78 Z" fill={shade(upper, -0.06)} />
      <path d="M60 104 Q64 78 94 74 L150 70 Q170 74 180 86" stroke={dark} strokeOpacity=".4" strokeWidth="1.1" strokeDasharray="3 3" {...line} />
      {/* heel tab */}
      <path d="M20 62 Q22 50 34 48 L38 84 L22 88 Z" fill={dark} />
      {/* tongue */}
      <path d="M64 51 Q74 40 92 42 L110 60 Q86 62 64 51 Z" fill={shade(upper, 0.08)} stroke={dark} strokeOpacity=".4" strokeWidth="1" />
      {/* collar */}
      <path d="M40 50 Q54 44 68 52" stroke={dark} strokeWidth="3" {...line} />
      {/* eyelets + laces */}
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 86 + i * 15;
        const y = 58 + i * 3.4;
        return (
          <g key={i}>
            <path d={`M${x - 5} ${y - 6} L${x + 9} ${y - 2}`} stroke={shade(upper, 0.5)} strokeWidth="2.4" {...line} />
            <circle cx={x} cy={y} r="1.8" fill={dark} />
          </g>
        );
      })}
      <path d="M20 108 L22 70 Q24 50 44 48 L66 50 Q92 64 120 62 L148 60 Q178 70 200 82 Q226 92 228 108 Z" fill={sheen} />
      <path d="M20 108 L22 70 Q24 50 44 48 L66 50 Q92 64 120 62 L148 60 Q178 70 200 82 Q226 92 228 108" stroke="#000" strokeOpacity=".2" strokeWidth="1" {...line} />
    </>
  );
}

function heel(kind: "sneaker" | "boot" | "slide", uid: string, upper: string, dark: string, sole: string, soleDark: string) {
  const sheen = `url(#${uid}v)`;
  if (kind === "slide") {
    return (
      <>
        <path d="M78 112 Q76 131 92 131 L148 131 Q164 131 162 112 Z" fill={sole} />
        <path d="M82 118 H158" stroke={soleDark} strokeWidth="1.2" />
        <path d="M84 112 Q84 64 120 62 Q156 64 156 112" stroke={upper} strokeWidth="14" {...line} />
        <path d="M84 112 Q84 64 120 62 Q156 64 156 112" stroke="#000" strokeOpacity=".12" strokeWidth="14" {...line} />
        <path d="M84 112 Q84 64 120 62 Q156 64 156 112" stroke={upper} strokeWidth="11" {...line} />
      </>
    );
  }
  const tall = kind === "boot";
  const top = tall ? 14 : 42;
  const body = `M88 120 L84 ${top + 30} Q84 ${top} 120 ${top - 2} Q156 ${top} 156 ${top + 30} L152 120 Z`;
  return (
    <>
      <path d={tall ? "M88 116 L88 132 L152 132 L152 116 Z" : "M84 114 Q82 132 96 132 L144 132 Q158 132 156 114 Z"} fill={sole} />
      <path d={tall ? "M88 124 H152" : "M86 122 H154"} stroke={soleDark} strokeWidth="1.3" />
      <path d={body} fill={upper} />
      {/* heel tab / pull tab */}
      {tall ? (
        <path d={`M112 ${top + 2} Q110 ${top - 12} 120 ${top - 12} Q130 ${top - 12} 128 ${top + 2}`} stroke={dark} strokeWidth="4" {...line} />
      ) : (
        <path d={`M112 ${top - 1} H128 V${top + 34} Q120 ${top + 38} 112 ${top + 34} Z`} fill={dark} />
      )}
      {/* collar opening */}
      <path d={`M94 ${top + 6} Q120 ${top - 4} 146 ${top + 6}`} stroke={dark} strokeWidth="3" {...line} />
      <path d={body} fill={sheen} />
      <path d={body} fill="none" stroke="#000" strokeOpacity=".2" strokeWidth="1" />
    </>
  );
}
