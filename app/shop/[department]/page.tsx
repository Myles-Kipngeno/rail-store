import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Chrome";
import { Footer } from "@/components/home/Footer";
import { ProductCard } from "@/components/home/Row";
import { ShoeItem } from "@/components/home/ShoeShelf";
import { departmentOf } from "@/components/home/shot";
import { CategoryFilter } from "@/components/shop/CategoryFilter";
import Store from "@/components/Store";
import { getProducts } from "@/lib/db";
import { CATEGORIES, CATEGORY_LABELS, DEPARTMENT_LABELS, DEPARTMENTS, isDepartment, type Department } from "@/lib/types";

/*
 * /shop/<department>: one static page per department (SSG), rebuilt hourly and whenever the admin
 * saves (revalidatePath("/shop/[department]", "page") in app/admin/actions.ts).
 *   tops, formal  → the rack (components/Store.tsx, same component as the home page)
 *   bottoms       → the rack with trousers folded over the hanger bar (rackStyle="folded")
 *   shoes         → the shelf (components/home/ShoeShelf ShoeItem)
 *   accessories   → a card grid (components/home/Row ProductCard)
 * Category chips come from CATEGORIES[department]; ?category=<slug> deep-links (read on the client,
 * so the pages stay static).
 */
export const revalidate = 3600;
export const dynamicParams = false; // anything not in DEPARTMENTS is a 404

export function generateStaticParams() {
  return DEPARTMENTS.map((department) => ({ department }));
}

type Params = { params: Promise<{ department: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { department } = await params;
  return isDepartment(department) ? { title: DEPARTMENT_LABELS[department] } : {};
}

const RACK: Partial<Record<Department, "hanging" | "folded">> = { tops: "hanging", formal: "hanging", bottoms: "folded" };

export default async function DepartmentPage({ params }: Params) {
  const { department } = await params;
  if (!isDepartment(department)) notFound();
  const label = DEPARTMENT_LABELS[department];
  const products = (await getProducts()).filter((p) => departmentOf(p) === department);
  const chips = CATEGORIES[department].map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

  if (!products.length) {
    return (
      <>
        <Header count={0} />
        <main className="shop-empty">
          <h1 className="home-h">{label}</h1>
          <p className="muted">Nothing on the rail here yet. New pieces land every drop.</p>
          <Link href="/" className="btn btn--outline btn--sm">
            Back to the rack
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const rack = RACK[department];
  if (rack) {
    return (
      <>
        <h1 className="sr-only">{label}</h1>
        <Store products={products} categories={chips} rackStyle={rack} />
        <Footer />
      </>
    );
  }

  const items = products.map((p) => ({
    id: p.id,
    category: p.category,
    node:
      department === "shoes" ? (
        <ShoeItem product={p} />
      ) : (
        <ProductCard product={p} sizes="(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 260px" />
      ),
  }));

  return (
    <>
      <Header count={products.length} />
      <main className={`shop shop--${department}`}>
        <h1 className="shop-h">{label}</h1>
        <CategoryFilter
          label={label}
          chips={chips}
          items={items}
          wrapClassName={department === "shoes" ? "shelf" : undefined}
          listClassName={department === "shoes" ? "shelf-row shelf-row--wrap" : "shop-grid"}
        />
      </main>
      <Footer />
    </>
  );
}
