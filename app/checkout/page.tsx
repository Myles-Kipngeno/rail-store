import type { Metadata } from "next";
import { Header } from "@/components/Chrome";
import { ordersEnabled } from "@/lib/db";
import { mpesaConfigured } from "@/lib/mpesa";
import CheckoutView from "./CheckoutView";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="checkout-page">
      <Header />
      <CheckoutView enabled={ordersEnabled && mpesaConfigured()} />
    </div>
  );
}
