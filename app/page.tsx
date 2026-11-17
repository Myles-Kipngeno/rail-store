import { Bottoms, Footer, Newsletter, OffTheRack, Row, ShoeShelf } from "@/components/home";
import { departmentOf, frontPhoto, imgProps } from "@/components/home/shot";
import { Header } from "@/components/Chrome";
import Store from "@/components/Store";
import { getProducts } from "@/lib/db";
import { CATEGORIES, CATEGORY_LABELS, hasDrawnFallback, type Department, type Product } from "@/lib/types";

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
  const pairs = showable(inDept("bottoms")).map((p) => {
    const photo = frontPhoto(p);
    return photo
      ? { id: p.id, name: p.name, price: p.price, img: imgProps(photo, p.name, "(max-width: 640px) 80vw, 34vw") }
      : { id: p.id, name: p.name, price: p.price, drawn: p };
  });
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
        {pairs.length > 0 && <Bottoms pairs={pairs} />}
        <ShoeShelf shoes={showable(inDept("shoes"))} />
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
