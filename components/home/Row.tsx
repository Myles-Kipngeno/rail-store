import Link from "next/link";
import { formatKES } from "@/lib/format";
import type { Product } from "@/lib/types";
import { Reveal } from "./Reveal";
import { RowArrows } from "./RowArrows";
import { Shot } from "./shot";

/** Photo on a light card, name, price; links to the product page. Rows and the accessories grid. */
export function ProductCard({ product: p, sizes }: { product: Product; sizes: string }) {
  return (
    <Link href={`/p/${p.id}`} className="row-card">
      <span className="row-shot">
        <Shot product={p} sizes={sizes} />
      </span>
      <span className="row-name">{p.name}</span>
      <span className="row-price mono">{formatKES(p.price)}</span>
    </Link>
  );
}

/** A titled, horizontally scrolling (scroll-snap) row of product cards. Renders nothing when empty. */
export function Row({ title, href, products }: { title: string; href: string; products: Product[] }) {
  if (!products.length) return null;
  const id = `row-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="home-section row" aria-labelledby={id}>
      <Reveal>
        <div className="row-head">
          <h2 className="home-h" id={id}>
            {title}
          </h2>
          <Link href={href} className="row-all">
            View all →
          </Link>
          <RowArrows label={title} />
        </div>
        <ul className="row-track">
          {products.map((p) => (
            <li key={p.id} className="row-item">
              <ProductCard product={p} sizes="(max-width: 640px) 62vw, 240px" />
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
