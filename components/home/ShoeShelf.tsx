import Link from "next/link";
import { formatKES } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Shot } from "./shot";

/**
 * One shoe standing on the shelf (inside a .shelf > ul.shelf-row), on /shop/shoes. Hover lifts it 10px,
 * tips it -6deg and spreads its shadow (CSS only: .shoe).
 */
export function ShoeItem({ product: p }: { product: Product }) {
  return (
    <Link href={`/p/${p.id}`} className="shoe" aria-label={`${p.name}, ${formatKES(p.price)}`}>
      <span className="shoe-shadow" aria-hidden="true" />
      <span className="shoe-img">
        <Shot product={p} sizes="(max-width: 640px) 44vw, 220px" />
      </span>
      <span className="shoe-meta" aria-hidden="true">
        <span className="row-name">{p.name}</span>
        <span className="row-price mono">{formatKES(p.price)}</span>
      </span>
    </Link>
  );
}
