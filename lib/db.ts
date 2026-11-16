/**
 * Product storage: Supabase Postgres (schema in supabase/migrations).
 * Every read/write goes through this file; signatures match the old JSON-file version.
 * Server-only: never import from a "use client" file.
 *
 * Reads come from the `product_documents` view, which returns each product already shaped as
 * the Product type. Public reads use the anon key (RLS = published only); draft reads and all
 * writes use the service role. Writes are Postgres functions so each one is a single transaction.
 *
 * Without Supabase env vars (local dev before setup, or a CI build) the store falls back to the
 * read-only sample rack in data/products.json. On Vercel a missing config is an error instead.
 */
import "server-only";
import sample from "@/data/products.json";
import { supabaseAdmin, supabaseConfigured, supabasePublic } from "./supabase";
import type { Product } from "./types";

type Opts = { includeDrafts?: boolean };

const useSample = !supabaseConfigured && !process.env.VERCEL;
if (useSample) console.warn("[db] Supabase env vars not set: serving the read-only sample rack from data/products.json.");

const SAMPLE = sample as Product[];

function fail(what: string, error: { message: string }): never {
  throw new Error(`[db] ${what}: ${error.message}`);
}

function readOnly(): never {
  throw new Error("Supabase is not configured, so products can't be saved. Add the keys to .env.local (see .env.example).");
}

export async function getProducts(opts: Opts = {}): Promise<Product[]> {
  if (useSample) return opts.includeDrafts ? SAMPLE : SAMPLE.filter((p) => p.published);
  const db = opts.includeDrafts ? supabaseAdmin() : supabasePublic();
  let q = db.from("product_documents").select("doc");
  if (!opts.includeDrafts) q = q.eq("published", true);
  const { data, error } = await q.order("position").order("created_at");
  if (error) fail("getProducts", error);
  return (data as { doc: Product }[]).map((r) => r.doc);
}

export async function getProduct(id: string, opts: Opts = {}): Promise<Product | undefined> {
  if (useSample) {
    const p = SAMPLE.find((x) => x.id === id);
    return p && (p.published || opts.includeDrafts) ? p : undefined;
  }
  const db = opts.includeDrafts ? supabaseAdmin() : supabasePublic();
  let q = db.from("product_documents").select("doc").eq("id", id);
  if (!opts.includeDrafts) q = q.eq("published", true);
  const { data, error } = await q.maybeSingle();
  if (error) fail("getProduct", error);
  return (data as { doc: Product } | null)?.doc;
}

export async function upsertProduct(product: Product) {
  if (useSample) readOnly();
  const { error } = await supabaseAdmin().rpc("upsert_product", { doc: product });
  if (error) fail("upsertProduct", error);
}

export async function deleteProduct(id: string) {
  if (useSample) readOnly();
  const { error } = await supabaseAdmin().from("products").delete().eq("id", id);
  if (error) fail("deleteProduct", error);
}

export async function reorderProducts(ids: string[]) {
  if (useSample) readOnly();
  const { error } = await supabaseAdmin().rpc("reorder_products", { ids });
  if (error) fail("reorderProducts", error);
}

/** Newsletter sign-up. Signing up twice is not an error (and doesn't reveal that the address is known). */
export async function addSubscriber(email: string, source = "home") {
  if (useSample) readOnly();
  const { error } = await supabaseAdmin()
    .from("subscribers")
    .upsert({ email, source }, { onConflict: "email", ignoreDuplicates: true });
  if (error) fail("addSubscriber", error);
}

// ---------------------------------------------------------------- orders (M-Pesa checkout; service role only)
export type OrderStatus = "PENDING" | "PAID" | "FAILED" | "NEEDS_REVIEW";

export interface NewOrder {
  name: string;
  phone: string;
  town: string;
  note: string;
  total_kes: number;
}

export interface NewOrderLine {
  product_id: string;
  colorway_id: string;
  size: string;
  qty: number;
  unit_price_kes: number;
}

export interface OrderRow extends NewOrder {
  id: string;
  status: OrderStatus;
  checkout_request_id: string | null;
  mpesa_receipt: string | null;
  result_desc: string | null;
  created_at: string;
  paid_at: string | null;
}

/** True when orders can be stored (they need Supabase; the sample rack is read-only). */
export const ordersEnabled = !useSample;

/** Inserts the order (PENDING) and its lines in one transaction. Returns the order id. */
export async function createOrder(order: NewOrder, lines: NewOrderLine[]): Promise<string> {
  if (useSample) readOnly();
  const { data, error } = await supabaseAdmin().rpc("create_order", { o: order, lines });
  if (error) fail("createOrder", error);
  return data as string;
}

export async function setOrderCheckoutRequest(id: string, checkoutRequestId: string) {
  const { error } = await supabaseAdmin().from("orders").update({ checkout_request_id: checkoutRequestId }).eq("id", id);
  if (error) fail("setOrderCheckoutRequest", error);
}

export async function getOrder(id: string): Promise<OrderRow | undefined> {
  if (useSample) return undefined;
  const { data, error } = await supabaseAdmin().from("orders").select("*").eq("id", id).maybeSingle();
  if (error) fail("getOrder", error);
  return (data as OrderRow | null) ?? undefined;
}

export async function getOrderByCheckoutRequest(checkoutRequestId: string): Promise<OrderRow | undefined> {
  if (useSample) return undefined;
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("*")
    .eq("checkout_request_id", checkoutRequestId)
    .maybeSingle();
  if (error) fail("getOrderByCheckoutRequest", error);
  return (data as OrderRow | null) ?? undefined;
}

/** PENDING → FAILED. Never touches an order that is already settled. Returns whether it changed. */
export async function failPendingOrder(id: string, resultDesc: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .update({ status: "FAILED", result_desc: resultDesc.slice(0, 300) })
    .eq("id", id)
    .eq("status", "PENDING")
    .select("id");
  if (error) fail("failPendingOrder", error);
  return (data?.length ?? 0) > 0;
}

/**
 * Money was taken but the order can't simply be PAID (wrong amount, or it was already marked
 * FAILED): keep the receipt, no stock change, and leave it for a person. PENDING/FAILED only.
 */
export async function flagOrderForReview(id: string, receipt: string | null, resultDesc: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .update({
      status: "NEEDS_REVIEW",
      result_desc: resultDesc.slice(0, 300),
      paid_at: new Date().toISOString(),
      ...(receipt ? { mpesa_receipt: receipt } : {}),
    })
    .eq("id", id)
    .in("status", ["PENDING", "FAILED"])
    .select("id");
  if (error) fail("flagOrderForReview", error);
  return (data?.length ?? 0) > 0;
}

export type MarkPaidResult = {
  result: "paid" | "needs_review" | "receipt_added" | "noop" | "not_found";
  product_ids: string[];
};

/**
 * mark_order_paid() (one transaction): PENDING → PAID with stock taken out, or NEEDS_REVIEW if
 * any line lacks stock. On an order already PAID without a receipt it only fills the receipt in.
 */
export async function markOrderPaid(id: string, receipt: string | null, paidAt: Date): Promise<MarkPaidResult> {
  const { data, error } = await supabaseAdmin().rpc("mark_order_paid", {
    order_id: id,
    receipt,
    paid_at: paidAt.toISOString(),
  });
  if (error) fail("markOrderPaid", error);
  return data as MarkPaidResult;
}
