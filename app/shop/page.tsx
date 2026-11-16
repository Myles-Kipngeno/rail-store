import { redirect } from "next/navigation";

/** /shop (footer "Shop", New arrivals "View all") → the first department. */
export default function ShopIndex() {
  redirect("/shop/tops");
}
