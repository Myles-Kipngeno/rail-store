"use server";

import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { deleteProduct, getProducts, reorderProducts, upsertProduct } from "@/lib/db";
import { isHex, slugify } from "@/lib/format";
import { GARMENT_TYPES, PRINT_KINDS, SIZES, type Product } from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const MAX_BYTES = 6 * 1024 * 1024;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif" };

function refresh(id?: string) {
  revalidatePath("/");
  if (id) revalidatePath(`/p/${id}`);
  revalidatePath("/admin");
}

function clean(input: Product): Result<{ product: Product }> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Give the piece a name." };
  if (!GARMENT_TYPES.includes(input.type)) return { ok: false, error: "Pick a garment type." };
  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Price must be more than 0." };
  if (!input.colors?.length) return { ok: false, error: "Add at least one colour." };

  const seen = new Set<string>();
  const colors = [];
  for (const c of input.colors) {
    const cname = c.name?.trim();
    if (!cname) return { ok: false, error: "Every colour needs a name." };
    if (!isHex(c.hex)) return { ok: false, error: `"${cname}" needs a valid colour.` };
    let id = slugify(cname);
    while (seen.has(id)) id += "-2";
    seen.add(id);
    const stock: Product["colors"][number]["stock"] = {};
    for (const s of SIZES) stock[s] = Math.max(0, Math.floor(Number(c.stock?.[s] ?? 0)) || 0);
    colors.push({
      id,
      name: cname,
      hex: c.hex,
      ...(c.trim && isHex(c.trim) ? { trim: c.trim } : {}),
      ...(c.sleeve && isHex(c.sleeve) ? { sleeve: c.sleeve } : {}),
      ...(c.images?.front || c.images?.back ? { images: { front: c.images?.front, back: c.images?.back } } : {}),
      stock,
    });
  }

  const prints = (list: Product["print"]["front"] = []) =>
    list
      .filter((p) => PRINT_KINDS.includes(p.k))
      .slice(0, 4)
      .map((p) => ({ k: p.k, ...(p.t ? { t: String(p.t).slice(0, 40) } : {}), ...(p.n ? { n: String(p.n).slice(0, 3) } : {}) }));

  return {
    ok: true,
    product: {
      id: input.id,
      name: name.slice(0, 80),
      type: input.type,
      category: input.category?.trim().slice(0, 30) || "Other",
      price,
      colors,
      print: { front: prints(input.print?.front), back: prints(input.print?.back) },
      description: (input.description ?? "").trim().slice(0, 1200),
      details: (input.details ?? []).map((d) => d.trim()).filter(Boolean).slice(0, 12),
      published: Boolean(input.published),
      createdAt: input.createdAt || new Date().toISOString(),
    },
  };
}

export async function saveProduct(input: Product, isNew: boolean): Promise<Result<{ id: string }>> {
  const res = clean(input);
  if (!res.ok) return res;
  const product = res.product;
  if (isNew) {
    const taken = new Set((await getProducts({ includeDrafts: true })).map((p) => p.id));
    let id = slugify(product.name);
    for (let n = 2; taken.has(id); n++) id = `${slugify(product.name)}-${n}`;
    product.id = id;
    product.createdAt = new Date().toISOString();
  }
  await upsertProduct(product);
  refresh(product.id);
  return { ok: true, id: product.id };
}

export async function removeProduct(id: string): Promise<Result> {
  await deleteProduct(id);
  refresh(id);
  return { ok: true };
}

export async function saveOrder(ids: string[]): Promise<Result> {
  await reorderProducts(ids);
  refresh();
  return { ok: true };
}

export async function uploadImage(form: FormData): Promise<Result<{ url: string }>> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file received." };
  const ext = EXT[file.type];
  if (!ext) return { ok: false, error: "Use a PNG, JPG, WebP or AVIF photo." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Photos must be under 6 MB." };
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { ok: true, url: `/uploads/${name}` };
}
