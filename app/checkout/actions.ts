"use server";

import {
  createOrder,
  getOrder,
  getProduct,
  ordersEnabled,
  failPendingOrder,
  setOrderCheckoutRequest,
  type NewOrderLine,
} from "@/lib/db";
import { formatKES } from "@/lib/format";
import { MpesaError, mpesaConfigured, normalizePhone, settleOrder, stkPush, stkQuery } from "@/lib/mpesa";
import { sizesFor, type Product } from "@/lib/types";

/** What the bag sends. Only the keys and qty are used; price is compared, never charged. */
export interface CheckoutLineInput {
  productId: string;
  colorId: string;
  size: string;
  qty: number;
  price: number;
}

export interface CheckoutInput {
  name: string;
  phone: string;
  town: string;
  note: string;
  lines: CheckoutLineInput[];
  /** Honeypot: hidden field, people leave it empty. */
  company?: string;
}

export type CheckoutResult =
  | { ok: true; orderId: string; total: number; phone: string }
  | { ok: false; error: string; field?: "name" | "phone" | "town" | "note" };

export type OrderStatusResult =
  | { ok: true; status: "PENDING" | "PAID" | "FAILED" | "NEEDS_REVIEW"; receipt: string | null; total: number; reason?: string }
  | { ok: false; error: string };

const MAX_LINES = 20;
/** M-Pesa's per-transaction ceiling. */
const MPESA_MAX_KES = 250_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/**
 * Re-prices the bag from the database, checks stock per colour + size, stores a PENDING order
 * and sends the STK push. Rejects (and charges nothing) if any price, colour, size or stock
 * changed since the piece went into the bag. The client's price is only compared, never used.
 */
export async function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!ordersEnabled || !mpesaConfigured())
    return { ok: false, error: "M-Pesa checkout isn't set up yet. Order on WhatsApp for now." };
  if (text(input?.company, 100)) return { ok: false, error: "Couldn't start the payment. Try again." };

  const name = text(input?.name, 80);
  if (!name) return { ok: false, field: "name", error: "Enter your name." };
  const phone = normalizePhone(typeof input?.phone === "string" ? input.phone : "");
  if (!phone) return { ok: false, field: "phone", error: "Enter a Safaricom number like 0712 345 678." };
  const town = text(input?.town, 60);
  if (!town) return { ok: false, field: "town", error: "Enter your town for delivery." };
  const note = typeof input?.note === "string" ? input.note.trim().slice(0, 300) : "";

  const raw = Array.isArray(input?.lines) ? input.lines : [];
  if (!raw.length) return { ok: false, error: "Your bag is empty." };
  if (raw.length > MAX_LINES) return { ok: false, error: `That's a lot of pieces: up to ${MAX_LINES} lines per order.` };

  // Merge duplicate keys, validate qty (whole number 1–10 per line).
  const merged = new Map<string, CheckoutLineInput>();
  for (const l of raw) {
    const qty = Number(l?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) return { ok: false, error: "Each piece can be ordered 1 to 10 at a time." };
    if (typeof l.productId !== "string" || typeof l.colorId !== "string" || typeof l.size !== "string")
      return { ok: false, error: "Your bag has an item we don't recognise. Remove it and try again." };
    const key = `${l.productId}|${l.colorId}|${l.size}`;
    const prev = merged.get(key);
    const total = (prev?.qty ?? 0) + qty;
    if (total > 10) return { ok: false, error: "Each piece can be ordered 1 to 10 at a time." };
    merged.set(key, { ...l, qty: total });
  }

  // Re-price and check stock from the database (published products only).
  const products = new Map<string, Product | undefined>();
  const lines: NewOrderLine[] = [];
  const problems: string[] = [];
  for (const l of merged.values()) {
    if (!products.has(l.productId)) products.set(l.productId, await getProduct(l.productId));
    const p = products.get(l.productId);
    const c = p?.colors.find((x) => x.id === l.colorId);
    const sizeOk = p && (sizesFor(p) as readonly string[]).includes(l.size);
    if (!p || !c || !sizeOk) {
      problems.push(`${p?.name ?? "A piece"} is no longer available in that colour or size`);
      continue;
    }
    const label = `${p.name} (${c.name}, ${l.size})`;
    const stock = c.stock[l.size as keyof typeof c.stock] ?? 0;
    if (stock < l.qty) problems.push(stock > 0 ? `${label}: only ${stock} left` : `${label} is sold out`);
    if (Number(l.price) !== p.price) problems.push(`${label} is now ${formatKES(p.price)}`);
    lines.push({ product_id: p.id, colorway_id: c.id, size: l.size, qty: l.qty, unit_price_kes: p.price });
  }
  if (problems.length)
    return { ok: false, error: `Your bag changed: ${problems.join("; ")}. Update your bag and try again.` };

  const total = lines.reduce((n, l) => n + l.qty * l.unit_price_kes, 0);
  if (total > MPESA_MAX_KES)
    return { ok: false, error: `M-Pesa takes up to ${formatKES(MPESA_MAX_KES)} per payment. Split the order or order on WhatsApp.` };

  let orderId: string;
  try {
    orderId = await createOrder({ name, phone, town, note, total_kes: total }, lines);
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Couldn't save your order. Try again in a minute." };
  }

  let checkoutRequestId: string;
  try {
    checkoutRequestId = (await stkPush({ phone, amount: total })).checkoutRequestId;
  } catch (e) {
    console.error(e);
    await failPendingOrder(orderId, e instanceof MpesaError ? e.message : "The M-Pesa prompt couldn't be sent.").catch(() => undefined);
    return { ok: false, error: e instanceof MpesaError ? e.message : "Couldn't send the M-Pesa prompt. Try again." };
  }
  // The prompt is already on the customer's phone, so never fail the order from here on.
  // One retry; if it still fails the order stays PENDING without an id and needs a manual look.
  await setOrderCheckoutRequest(orderId, checkoutRequestId)
    .catch(() => setOrderCheckoutRequest(orderId, checkoutRequestId))
    .catch((e) => console.error(`[checkout] order ${orderId}: couldn't store CheckoutRequestID ${checkoutRequestId}`, e));
  return { ok: true, orderId, total, phone };
}

/** Last STK query per order, so polling every 3s doesn't hammer Daraja (best effort, per instance). */
const lastQuery = new Map<string, number>();
/** The callback normally settles the order; only ask Daraja ourselves once it is this late. */
const FALLBACK_AFTER_MS = 60_000;
const QUERY_EVERY_MS = 15_000;

/**
 * Polled by the checkout page. Returns the stored status, which the Daraja callback
 * (app/api/mpesa/callback/[secret]) normally sets. If the order is still PENDING 60s after it was
 * created, it asks Daraja once (STK query; again at most every 15s if Daraja says it's still
 * processing) and applies the answer the same way the callback would (settleOrder). A paid query
 * has no receipt number: the callback fills it in when it arrives.
 * The order id is an unguessable uuid and only status, receipt and total are returned.
 */
export async function getOrderStatus(orderId: string): Promise<OrderStatusResult> {
  if (typeof orderId !== "string" || !UUID.test(orderId)) return { ok: false, error: "Unknown order." };
  let order = await getOrder(orderId).catch(() => undefined);
  if (!order) return { ok: false, error: "Unknown order." };

  const age = Date.now() - new Date(order.created_at).getTime();
  const last = lastQuery.get(orderId) ?? 0;
  if (order.status === "PENDING" && order.checkout_request_id && age > FALLBACK_AFTER_MS && Date.now() - last > QUERY_EVERY_MS) {
    lastQuery.set(orderId, Date.now());
    try {
      const q = await stkQuery(order.checkout_request_id);
      if (q.state !== "pending") {
        await settleOrder(order, q.state === "paid" ? { paid: true, receipt: null, paidAt: new Date() } : { paid: false, resultDesc: q.resultDesc });
        order = (await getOrder(orderId)) ?? order;
        lastQuery.delete(orderId);
      }
    } catch (e) {
      console.error(e); // keep polling; the stored status is still correct
    }
  }
  return {
    ok: true,
    status: order.status,
    receipt: order.mpesa_receipt,
    total: order.total_kes,
    ...(order.status === "FAILED" && order.result_desc ? { reason: order.result_desc } : {}),
  };
}
