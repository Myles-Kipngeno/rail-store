import Link from "next/link";
import { formatKES } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Reveal } from "./Reveal";
import { Shot } from "./shot";

/** One shoe standing on the shelf (inside a .shelf > ul.shelf-row). */
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

/**
 * Shoes standing on a floating shelf. Hover lifts a shoe 10px, tips it -6deg and spreads its shadow
 * (CSS only: .shoe). Each one links to its product page.
 */
export function ShoeShelf({ shoes }: { shoes: Product[] }) {
  if (!shoes.length) return null;
  return (
    <section className="home-section shoes" aria-labelledby="shoes-h">
      <Reveal>
        <div className="row-head">
          <h2 className="home-h" id="shoes-h">
            Shoes
          </h2>
          <Link href="/shop/shoes" className="row-all">
            View all →
          </Link>
        </div>
        <div className="shelf">
          <ul className="shelf-row">
            {shoes.map((p) => (
              <li key={p.id}>
                <ShoeItem product={p} />
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
