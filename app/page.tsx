import Store from "@/components/Store";
import { getProducts } from "@/lib/db";

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
  return <Store products={products} />;
}
