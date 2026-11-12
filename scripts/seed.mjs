// Seeds Supabase from data/products.json and copies photos from ./uploads into the product-images bucket.
// Safe to re-run: products are upserted by id, files are upserted by name.
// Usage: npm run db:seed   (reads .env.local; needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const BUCKET = "product-images";
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif" };

// 1. Photos
const uploadDir = path.join(process.cwd(), "uploads");
const files = (await readdir(uploadDir).catch(() => [])).filter((f) => TYPES[path.extname(f).toLowerCase()]);
for (const f of files) {
  const body = await readFile(path.join(uploadDir, f));
  const { error } = await db.storage.from(BUCKET).upload(f, body, {
    contentType: TYPES[path.extname(f).toLowerCase()],
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error(`upload ${f}: ${error.message}`);
}
console.log(`photos: ${files.length} copied to ${BUCKET}`);

// 2. Products (legacy /uploads/<file> URLs are rewritten to the bucket's public URL)
const publicBase = `${url.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/`;
const fix = (u) => (typeof u === "string" && u.startsWith("/uploads/") ? publicBase + u.slice("/uploads/".length) : u);
const products = JSON.parse(await readFile(path.join(process.cwd(), "data", "products.json"), "utf8"));
for (const p of products) {
  for (const c of p.colors) if (c.images) c.images = { front: fix(c.images.front), back: fix(c.images.back) };
  const { error } = await db.rpc("upsert_product", { doc: p });
  if (error) throw new Error(`product ${p.id}: ${error.message}`);
}
const { error } = await db.rpc("reorder_products", { ids: products.map((p) => p.id) });
if (error) throw new Error(`reorder: ${error.message}`);
console.log(`products: ${products.length} upserted in rack order`);
