// next/image's own prop builder, imported from its module rather than from "next/image": that entry
// also imports the "use client" <Image>, which Next would then ship to the browser (~5 kB) even though
// nothing here renders it. This is exactly what next/image's getImageProps() does (Next 15.5, pinned):
// node_modules/next/dist/shared/lib/image-external.js. Re-check that file if Next is upgraded.
import { getImgProps } from "next/dist/shared/lib/get-img-props";
import type { ImageConfigComplete } from "next/dist/shared/lib/image-config";
import defaultLoader from "next/dist/shared/lib/image-loader";
import type { Product } from "@/lib/types";
import { Garment } from "../Garment";

/** First colour with a front photo. Non-tops can't be published without one (clean() in admin actions). */
export const frontPhoto = (p: Product) => p.colors.find((c) => c.images?.front)?.images?.front;

/** Pre-migration rows have no department; they were all tops (see 20261116000000_departments.sql). */
export const departmentOf = (p: Product) => p.department ?? "tops";

export type ImgProps = ReturnType<typeof getImgProps>["props"];

/**
 * next/image's optimized, lazy-loading <img> props (srcset from `sizes`, `fill` = covers its positioned
 * parent), computed on the server. Rendering a plain <img> with them keeps next/image's client code off
 * the home page's first load. Legacy /uploads/<file> links redirect to Storage, which the optimizer
 * doesn't follow, so those skip optimization.
 */
export function imgProps(src: string, alt: string, sizes: string): ImgProps {
  const { props } = getImgProps(
    { src, alt, sizes, fill: true, unoptimized: src.startsWith("/uploads/") },
    // Replaced at build time with next.config's images settings (same as next/image).
    { defaultLoader, imgConf: process.env.__NEXT_IMAGE_OPTS as unknown as ImageConfigComplete },
  );
  // Drop undefined props so the object serializes cleanly to the client (Showcase).
  for (const k of Object.keys(props) as (keyof typeof props)[]) if (props[k] === undefined) delete props[k];
  return props;
}

/** The product's photo (optimized, lazy), or the drawn garment for tops without one. */
export function Shot({ product, sizes, className = "" }: { product: Product; sizes: string; className?: string }) {
  const src = frontPhoto(product);
  if (!src) return <Garment product={product} color={product.colors[0]} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...imgProps(src, product.name, sizes)} className={`shot-img ${className}`} />;
}
