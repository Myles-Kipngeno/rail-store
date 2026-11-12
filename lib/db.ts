/**
 * Product storage. Phase 1 keeps products in a JSON file so the store runs with zero setup.
 * Every read/write goes through this file, so swapping to MySQL (Prisma) later only changes this module.
 * Server-only: never import from a "use client" file.
 */
import { promises as fs } from "fs";
import path from "path";
import type { Product } from "./types";

const DATA_FILE = process.env.DATA_FILE ?? path.join(process.cwd(), "data", "products.json");

async function readAll(): Promise<Product[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as Product[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(products: Product[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(products, null, 2));
  await fs.rename(tmp, DATA_FILE); // atomic replace
}

export async function getProducts(opts: { includeDrafts?: boolean } = {}) {
  const all = await readAll();
  return opts.includeDrafts ? all : all.filter((p) => p.published);
}

export async function getProduct(id: string, opts: { includeDrafts?: boolean } = {}) {
  const p = (await readAll()).find((x) => x.id === id);
  return p && (p.published || opts.includeDrafts) ? p : undefined;
}

export async function upsertProduct(product: Product) {
  const all = await readAll();
  const i = all.findIndex((p) => p.id === product.id);
  if (i >= 0) all[i] = product;
  else all.push(product);
  await writeAll(all);
}

export async function deleteProduct(id: string) {
  await writeAll((await readAll()).filter((p) => p.id !== id));
}

export async function reorderProducts(ids: string[]) {
  const all = await readAll();
  const rank = new Map(ids.map((id, i) => [id, i]));
  all.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  await writeAll(all);
}
