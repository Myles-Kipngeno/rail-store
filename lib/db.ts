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
