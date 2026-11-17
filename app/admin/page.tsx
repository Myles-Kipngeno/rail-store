import type { Metadata } from "next";
import AdminEditor from "@/components/AdminEditor";
import { getLookbook, getProducts } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const [products, lookbook] = await Promise.all([getProducts({ includeDrafts: true }), getLookbook({ includeDrafts: true })]);
  return <AdminEditor products={products} lookbook={lookbook} />;
}
