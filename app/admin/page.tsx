import type { Metadata } from "next";
import AdminEditor from "@/components/AdminEditor";
import { getProducts } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage() {
  const products = await getProducts({ includeDrafts: true });
  return <AdminEditor products={products} />;
}
