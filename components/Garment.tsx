"use client";

import dynamic from "next/dynamic";
import { drawnType, isBottomType, isShoeType, type Colorway, type Product, type Side } from "@/lib/types";

// Split out: the home rack is tops only, so the trouser and shoe drawings load only where they're drawn
// (still server-rendered). Keeps them off the home page's first-load JS.
const Shoe = dynamic(() => import("./Shoe").then((m) => m.Shoe));
const Trousers = dynamic(() => import("./Trousers").then((m) => m.Trousers));
// Tops too: still server-rendered, but their drawing code loads as its own chunk after the first paint,
// which keeps the home page's first-load JS within budget.
const Top = dynamic(() => import("./Top").then((m) => m.Top));

/*
 * Garment illustration. viewBox 200 x 260. The hanger hook tops out at y≈10, which is where the rack's
 * rod sits, so every garment hangs from the same line. When a colour has a real photo for this side, the
 * photo is shown instead. Bottoms are drawn by Trousers.tsx (same viewBox, clip hanger) and shoes by
 * Shoe.tsx (240 x 140).
 *
 * Gradients, filters, patterns and outline clipPaths come from the page sprite (GarmentDefs.tsx, ids in
 * garment/shapes.ts), so no garment defines its own <defs> and ids never clash or mismatch on hydration.
 * detail="low" (rack slots, row cards, thumbnails): shapes + gradients, no noise filter, so rack hover
 * stays smooth. detail="high" (item view, showcase, product page): adds fabric noise, stitching and the
 * fine folds.
 *
 * Tops: shoulder + armhole seams, sleeve folds, a hem drape with soft folds, rib collar/cuffs, placket
 * and buttons on shirts, hood depth + drawcords with aglets on hoodies, zip teeth on jackets. Prints sit
 * under the fold shading (multiply), so they follow the folds.
 */

export type Detail = "low" | "high";

type GarmentProps = {
  product: Pick<Product, "id" | "type" | "print" | "name"> & Partial<Pick<Product, "department" | "category">>;
  color: Colorway;
  side?: Side;
  className?: string;
  /** Rack only: a highlight masked to the photo's alpha that follows --sx/--sy (set by the rack on pointermove). */
  sheen?: boolean;
  /** "low" (default): rack, rows, thumbnails. "high": item view, showcase, product page (texture + stitching). */
  detail?: Detail;
};

export function Garment({ product, color, side = "front", className, sheen, detail = "low" }: GarmentProps) {
  const photo = color.images?.[side];

  if (photo) {
    return (
      <div className={`garment garment--photo ${className ?? ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt={`${product.name}, ${color.name}, ${side}`} draggable={false} loading="lazy" decoding="async" />
        {sheen && (
          <span
            className="garment-sheen"
            aria-hidden="true"
            style={{ maskImage: `url("${photo}")`, WebkitMaskImage: `url("${photo}")` }}
          />
        )}
      </div>
    );
  }

  const type = drawnType(product);
  const label = `${product.name}, ${color.name}, ${side}`;
  const prints = side === "front" ? product.print.front : product.print.back;
  if (isShoeType(type)) return <Shoe type={type} color={color} side={side} label={label} className={className} detail={detail} />;
  if (isBottomType(type))
    return (
      <Trousers
        type={type}
        color={color}
        side={side}
        prints={prints}
        label={label}
        className={className}
        detail={detail}
        denim={product.category === "jeans"}
      />
    );

  return (
    <Top
      productId={product.id}
      type={type}
      color={color}
      side={side}
      prints={prints}
      label={label}
      className={className}
      detail={detail}
    />
  );
}
