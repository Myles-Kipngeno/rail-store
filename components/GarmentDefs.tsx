import { GD, TOPS, clipId } from "./garment/shapes";
import { TROUSERS } from "./garment/shapes-bottoms";
import { SHOE_UPPER } from "./garment/shapes-shoes";

/**
 * The garment sprite: ONE hidden <svg> per page (app/layout.tsx) with the gradients, filters, patterns
 * and outline clipPaths every drawn garment references by id (ids in garment/shapes.ts, all "gd-").
 * Not display:none: browsers drop gradients defined inside a display:none SVG. Server component, no JS.
 */
export function GarmentDefs() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {/* light */}
        <linearGradient id={GD.key} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".2" />
          <stop offset=".42" stopColor="#fff" stopOpacity="0" />
          <stop offset=".72" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".16" />
        </linearGradient>
        <linearGradient id={GD.cyl} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".2" />
          <stop offset=".2" stopColor="#000" stopOpacity=".03" />
          <stop offset=".36" stopColor="#fff" stopOpacity=".1" />
          <stop offset=".62" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <linearGradient id={GD.vert} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".06" />
          <stop offset="1" stopColor="#000" stopOpacity=".1" />
        </linearGradient>
        <linearGradient id={GD.metal} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a5a55" />
          <stop offset=".3" stopColor="#d6d6d0" />
          <stop offset=".48" stopColor="#f6f6f2" />
          <stop offset=".72" stopColor="#8c8c86" />
          <stop offset="1" stopColor="#3c3c39" />
        </linearGradient>
        <linearGradient id={GD.sole} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".42" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".18" />
        </linearGradient>
        <linearGradient id={GD.reflect} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8f9496" />
          <stop offset=".45" stopColor="#f2f5f6" />
          <stop offset=".55" stopColor="#c5cacc" />
          <stop offset="1" stopColor="#7d8284" />
        </linearGradient>
        <radialGradient id={GD.ground}>
          <stop offset="0" stopColor="#000" stopOpacity=".34" />
          <stop offset=".6" stopColor="#000" stopOpacity=".12" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {/* filters */}
        {/* Fixed user-space regions: an objectBoundingBox region on a thin, near-straight stroke is only a
            few px tall and clips the blur away. Covers both viewBoxes (200x260, 240x140). */}
        <filter id={GD.soft} filterUnits="userSpaceOnUse" x="-40" y="-40" width="340" height="360">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={GD.softer} filterUnits="userSpaceOnUse" x="-40" y="-40" width="340" height="360">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        {/* Fabric noise: dark specks from fractal noise, kept inside the element's own shape. */}
        <filter id={GD.noise} x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.2 0 0 0 -0.52" result="specks" />
          <feComposite in="specks" in2="SourceGraphic" operator="in" />
        </filter>

        {/* patterns */}
        <pattern id={GD.twill} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <line x1="0" y1="0" x2="0" y2="3.2" stroke="#fff" strokeOpacity=".09" strokeWidth="1.1" />
        </pattern>
        <pattern id={GD.rib} width="2.6" height="10" patternUnits="userSpaceOnUse">
          <line x1=".6" y1="0" x2=".6" y2="10" stroke="#000" strokeOpacity=".16" strokeWidth=".8" />
          <line x1="1.9" y1="0" x2="1.9" y2="10" stroke="#fff" strokeOpacity=".08" strokeWidth=".5" />
        </pattern>
        <pattern id={GD.mesh} width="4" height="3.4" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".75" fill="#000" fillOpacity=".2" />
          <circle cx="3" cy="2.7" r=".75" fill="#000" fillOpacity=".2" />
        </pattern>
        <pattern id={GD.perf} width="4.6" height="4.2" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r=".7" fill="#000" fillOpacity=".38" />
          <circle cx="3.5" cy="3.3" r=".7" fill="#000" fillOpacity=".38" />
        </pattern>
        <pattern id={GD.emboss} width="7" height="5" patternUnits="userSpaceOnUse">
          <path d="M.5 3.6 L3.5 1.2 L6.5 3.6" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth=".7" />
          <path d="M.5 4.4 L3.5 2 L6.5 4.4" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth=".6" />
        </pattern>
        <pattern id={GD.knit} width="3" height="3" patternUnits="userSpaceOnUse">
          <path d="M0 1.5 L1.5 0 L3 1.5" fill="none" stroke="#000" strokeOpacity=".06" strokeWidth=".6" />
        </pattern>

        {/* outlines as clipPaths (same user space as every garment's viewBox) */}
        {Object.entries(TROUSERS).map(([k, s]) => (
          <clipPath key={k} id={clipId(k)}>
            <path d={s.body} />
          </clipPath>
        ))}
        {Object.entries(TOPS).map(([k, d]) => (
          <clipPath key={k} id={clipId(k)}>
            <path d={d} />
          </clipPath>
        ))}
        {Object.entries(SHOE_UPPER).map(([k, d]) => (
          <clipPath key={k} id={clipId(`upper-${k}`)}>
            <path d={d} />
          </clipPath>
        ))}
      </defs>
    </svg>
  );
}
