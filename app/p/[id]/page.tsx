import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/ProductDetail";
import { getProduct, getProducts } from "@/lib/db";
import { formatKES } from "@/lib/format";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ id: p.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).id);
  return p ? { title: p.name, description: `${formatKES(p.price)} · ${p.description}` } : {};
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
