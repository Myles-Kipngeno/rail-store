import type { Department } from "./types";

/** Store-wide settings. Change these to rebrand. */
export const STORE = {
  name: "RAIL",
  drop: "Drop 01",
  city: "Nakuru",
  description: "Streetwear on a rail. Pick a piece, pick a colour, pay with M-Pesa or order on WhatsApp.",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  /**
   * Home page pinned showcases below the rack, in this order (components/home/Showcase.tsx). A
   * department shows only with 2+ published pieces that have a photo or a drawing.
   */
  showcase: ["bottoms", "shoes"] as Department[],
  ticker: [
    "New drop on the rail",
    "Delivery across Kenya",
    "Free delivery in Nakuru over KES 5,000",
    "Pay with M-Pesa",
    "Order on WhatsApp",
  ],
};
