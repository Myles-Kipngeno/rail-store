import { Footer, Newsletter, OffTheRack, Row, Showcase } from "@/components/home";
import { departmentOf, frontPhoto, imgProps } from "@/components/home/shot";
import { Header } from "@/components/Chrome";
import Store from "@/components/Store";
import { STORE } from "@/lib/config";
import { getProducts } from "@/lib/db";
import { CATEGORIES, CATEGORY_LABELS, DEPARTMENT_LABELS, hasDrawnFallback, type Department, type Product } from "@/lib/types";

// Static page, rebuilt on demand when the admin saves (revalidatePath).
export const revalidate = 3600;

export default async function Home() {
  const products = await getProducts();
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
  const latest = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);

  return (
    <>
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
        <Row title="New arrivals" href="/shop" products={latest} />
        <Row title="Formal" href="/shop/formal" products={inDept("formal")} />
        <Row title="Accessories" href="/shop/accessories" products={inDept("accessories")} />
        <OffTheRack />
        <Newsletter />
      </div>
      <Footer />
    </>
  );
}
