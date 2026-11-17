import Link from "next/link";
import type { CSSProperties } from "react";
import { formatKES, totalStock } from "@/lib/format";
import type { Product } from "@/lib/types";
import { RowArrows, RowShell } from "./RowShell";
import { Shot } from "./shot";

/**
 * A product tile: `--tile` background, 4:5, the piece centred, name + price under it. Hover/focus
 * darkens the tile 4%, scales the piece to 1.03 and crossfades front → back (0.35s) when there is a
 * back to show. Shows the first colour that has stock; "Sold out" when no colour does.
 * Used by the home rows and the accessories grid.
 */
export function ProductCard({ product: p, sizes }: { product: Product; sizes: string }) {
  const inStock = p.colors.filter((c) => totalStock(c) > 0);
  const withPhoto = (list: Product["colors"]) => list.find((c) => c.images?.front);
  const color = withPhoto(inStock) ?? withPhoto(p.colors) ?? inStock[0] ?? p.colors[0];
  const back = Shot({ product: p, sizes, side: "back", color });
  return (
    <Link href={`/p/${p.id}`} className="row-card" draggable={false}>
      <span className={`row-shot ${back ? "has-back" : ""}`}>
        <span className="row-face row-face--front">
          <Shot product={p} sizes={sizes} color={color} />
        </span>
        {back && (
          <span className="row-face row-face--back" aria-hidden="true">
            {back}
          </span>
        )}
        {!inStock.length && <span className="row-sold mono">Sold out</span>}
      </span>
      <span className="row-name">{p.name}</span>
      <span className="row-price mono">{formatKES(p.price)}</span>
    </Link>
  );
}

/**
 * A titled row of product cards: eyebrow + title, "View all" and ← → on the right, a scroll-snap track
 * under it. RowShell adds the reveal (20% in view: header and cards fade up 16px, 60ms stagger, once),
 * mouse drag and the buttons. Renders nothing when empty.
 */
export function Row({
  id,
  eyebrow,
  title,
  href,
  products,
}: {
  id: string;
  eyebrow: string;
  title: string;
  href: string;
  products: Product[];
}) {
  if (!products.length) return null;
  const hId = `${id}-h`;
  return (
    <section className="home-section row" id={id} aria-labelledby={hId}>
      <RowShell>
        <div className="row-head" style={{ "--i": 0 } as CSSProperties}>
          <div className="row-titles">
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="home-h" id={hId}>
              {title}
            </h2>
          </div>
          <Link href={href} className="row-all">
            View all
          </Link>
          <RowArrows label={title} />
        </div>
        <ul className="row-track">
          {products.map((p, i) => (
            // Stagger only what can be on screen; later cards come in with the last of them.
            <li key={p.id} className="row-item" style={{ "--i": Math.min(i + 1, 6) } as CSSProperties}>
              <ProductCard product={p} sizes="(max-width: 640px) 60vw, 24vw" />
            </li>
          ))}
        </ul>
      </RowShell>
    </section>
  );
}
