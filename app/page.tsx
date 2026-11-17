import { Lookbook, Row, Showcase, SiteFooter } from "@/components/home";
import type { Look } from "@/components/home/Lookbook";
import { departmentOf, frontPhoto, imgProps } from "@/components/home/shot";
import { Header } from "@/components/Chrome";
import Store from "@/components/Store";
import { STORE } from "@/lib/config";
import { getLookbook, getProducts } from "@/lib/db";
import { luminance, shade } from "@/lib/format";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DEPARTMENT_LABELS,
  hasDrawnFallback,
  type Category,
  type Department,
  type Product,
} from "@/lib/types";

// Static page, rebuilt on demand when the admin saves (revalidatePath).
export const revalidate = 3600;

export default async function Home() {
  const [products, lookbook] = await Promise.all([getProducts(), getLookbook()]);
  if (!products.length) {
    return (
      <main className="empty">
        <h1>The rack is empty</h1>
        <p>Add your first piece in the admin at /admin.</p>
      </main>
    );
  }

  const inDept = (d: Department) => products.filter((p) => departmentOf(p) === d);
  // A piece shows if it has a photo or can be drawn (tops, bottoms, shoes).
  const showable = (list: Product[]) => list.filter((p) => frontPhoto(p) || hasDrawnFallback(p));
  const tops = inDept("tops");
  // Pinned showcases (STORE.showcase), each piece in its first colour with a photo, else drawn.
  const showcases = STORE.showcase
    .map((d) => ({
      d,
      items: showable(inDept(d)).map((p) => {
        const photoColor = p.colors.find((c) => c.images?.front);
        const base = { id: p.id, name: p.name, price: p.price };
        return photoColor?.images?.front
          ? { ...base, colorId: photoColor.id, img: imgProps(photoColor.images.front, p.name, "(max-width: 640px) 90vw, 44vw") }
          : { ...base, colorId: p.colors[0].id, drawn: p };
      }),
    }))
    .filter((s) => s.items.length >= 2);

  // Rows: the 8 newest, then one per category (rack order) with at least 3 pieces.
  const rowable = showable(products);
  const latest = [...rowable].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const byCategory = new Map<Category, Product[]>();
  for (const p of rowable) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p]);
  const categoryRows = [...byCategory].filter(([, list]) => list.length >= 3);

  // Lookbook: published photos, or drawn placeholders until there are some.
  const looks: Look[] = lookbook.length
    ? lookbook.map((l) => ({
        id: l.id,
        caption: l.caption,
        productId: l.product_id ?? undefined,
        img: imgProps(l.src, l.caption || `Worn by a ${STORE.name} customer`, "(max-width: 640px) 220px, 300px"),
      }))
    : products
        .filter(hasDrawnFallback)
        .slice(0, 7)
        .map((p, i) => {
          const c = p.colors[i % p.colors.length];
          return {
            id: `demo-${p.id}`,
            caption: `@rail.ke · ${p.name}`,
            productId: p.id,
            drawn: { product: p, colorId: c.id, // A pale wash of the colour (light colours get a slightly darker one so the piece stands out).
            bg: shade(c.hex, luminance(c.hex) > 0.7 ? -0.14 : 0.62) },
          };
        });

  return (
    <>
      {/* Everything above the footer; the footer is revealed from under it (globals.css). */}
      <div className="page-main">
        {/* 1. The rack hero: tops only. */}
        {tops.length ? (
          <Store products={tops} categories={CATEGORIES.tops.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
        ) : (
          <Header count={0} />
        )}
        {/* Sections below hide themselves when they have nothing to show. */}
        <div className="home">
          {showcases.map(({ d, items }) => (
            <Showcase
              key={d}
              id={d}
              title={DEPARTMENT_LABELS[d]}
              unit={d === "bottoms" || d === "shoes" ? "pairs" : "pieces"}
              items={items}
            />
          ))}
          <Row id="new-arrivals" eyebrow="Just in" title="New arrivals" href="/shop" products={latest} />
          {categoryRows.map(([cat, list]) => {
            const d = departmentOf(list[0]);
            return (
              <Row
                key={cat}
                id={`row-${cat}`}
                eyebrow={DEPARTMENT_LABELS[d]}
                title={CATEGORY_LABELS[cat]}
                href={`/shop/${d}?category=${cat}`}
                products={list}
              />
            );
          })}
          {looks.length > 0 && <Lookbook looks={looks} />}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
