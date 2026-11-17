"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  addLookbookItem,
  deleteLookbookItem,
  deleteProduct,
  getLookbook,
  getProduct,
  getProducts,
  reorderLookbook,
  reorderProducts,
  updateLookbookItem,
  upsertProduct,
} from "@/lib/db";
import { IMAGE_BUCKET, imageUrlPrefix, supabaseAdmin, supabaseConfigured, supabasePublicKey } from "@/lib/supabase";
import { isHex, slugify } from "@/lib/format";
import { ImageRejected, lookbookPhoto, prepareGarmentPhoto } from "@/lib/image";
import { storeProductImage } from "@/lib/storage";
import {
  CATEGORY_LABELS,
  DEPARTMENT_LABELS,
  DRAWN_TYPES,
  hasDrawnFallback,
  printKindsFor,
  isCategoryOf,
  isDepartment,
  sizesFor,
  type ImageCredit,
  type Product,
} from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_BYTES = 6 * 1024 * 1024;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif" };

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/shop/[department]", "page"); // every department page (a piece may have changed department)
  if (id) revalidatePath(`/p/${id}`);
  revalidatePath("/admin");
}

/** Only photos in our own bucket are accepted (legacy /uploads/<file> paths are redirected there). */
function cleanImage(url: unknown): string | undefined {
  if (typeof url !== "string" || !url) return undefined;
  if (/^\/uploads\/[a-z0-9-]+\.(png|jpe?g|webp|avif)$/i.test(url)) return url;
  if (!supabaseConfigured) return undefined;
  const prefix = imageUrlPrefix();
  return url.startsWith(prefix) && /^[a-z0-9-]+\.(png|jpe?g|webp|avif)$/i.test(url.slice(prefix.length)) ? url : undefined;
}

/**
 * `credits`: front photo URL → its stock-photo credit, read from the database (never from the client).
 * A credit stays only while its photo is still the colour's front; replacing the photo drops it.
 */
function clean(input: Product, credits: Map<string, ImageCredit> = new Map()): Result<{ product: Product }> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Give the piece a name." };
  if (!isDepartment(input.department)) return { ok: false, error: "Pick a department." };
  const department = input.department;
  if (!isCategoryOf(department, input.category)) return { ok: false, error: `Pick a ${DEPARTMENT_LABELS[department].toLowerCase()} category.` };
  const category = input.category;
  // `type` shapes the drawn garment: one of DRAWN_TYPES[department]. Tops must pick one; bottoms and shoes
  // fall back to their department's first shape (older rows carry a "tee" placeholder). Departments
  // without drawings keep a valid placeholder for the column.
  const allowed = DRAWN_TYPES[department];
  const type = !allowed ? "tee" : allowed.includes(input.type) ? input.type : department === "tops" ? undefined : allowed[0];
  if (!type) return { ok: false, error: "Pick a garment type." };
  const sizes = sizesFor({ department, category });
  const published = Boolean(input.published);
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
    const front = cleanImage(c.images?.front);
    const back = cleanImage(c.images?.back);
    const stock: Product["colors"][number]["stock"] = {};
    // Only this product's size system is kept; anything else the client sends is dropped.
    for (const s of sizes) stock[s] = Math.max(0, Math.floor(Number(c.stock?.[s] ?? 0)) || 0);
    if (published && !front && !hasDrawnFallback({ department }))
      return {
        ok: false,
        error: `${CATEGORY_LABELS[category]} have no drawn version: add a front photo for "${cname}" before publishing, or save as a draft.`,
      };
    colors.push({
      id,
      name: cname,
      hex: c.hex,
      ...(c.trim && isHex(c.trim) ? { trim: c.trim } : {}),
      ...(c.sleeve && isHex(c.sleeve) ? { sleeve: c.sleeve } : {}),
      ...(front || back
        ? {
            images: {
              ...(front ? { front } : {}),
              ...(back ? { back } : {}),
              ...(front && credits.get(front) ? { credit: credits.get(front) } : {}),
            },
          }
        : {}),
      stock,
    });
  }

  // Graphics only exist on the drawn garment, and each shape takes its own kinds (none on shoes).
  const kinds = hasDrawnFallback({ department }) ? printKindsFor(type) : [];
  const prints = (list: Product["print"]["front"] = []) =>
    list
      .filter((p) => kinds.includes(p.k))
      .slice(0, 4)
      .map((p) => ({ k: p.k, ...(p.t ? { t: String(p.t).slice(0, 40) } : {}), ...(p.n ? { n: String(p.n).slice(0, 3) } : {}) }));

  return {
    ok: true,
    product: {
      id: input.id,
      name: name.slice(0, 80),
      type,
      department,
      category,
      price,
      colors,
      print: { front: prints(input.print?.front), back: prints(input.print?.back) },
      description: (input.description ?? "").trim().slice(0, 1200),
      details: (input.details ?? []).map((d) => d.trim()).filter(Boolean).slice(0, 12),
      published,
      createdAt: input.createdAt || new Date().toISOString(),
    },
  };
}

export async function saveProduct(input: Product, isNew: boolean): Promise<Result<{ id: string }>> {
  const before = isNew || typeof input?.id !== "string" ? undefined : await getProduct(input.id, { includeDrafts: true });
  const credits = new Map<string, ImageCredit>();
  for (const c of before?.colors ?? []) if (c.images?.front && c.images.credit) credits.set(c.images.front, c.images.credit);
  const res = clean(input, credits);
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
  const product = await getProduct(id, { includeDrafts: true });
  await deleteProduct(id);
  refresh(id);
  // Best effort: drop the piece's photos from the bucket. The product is already gone either way.
  if (product && supabaseConfigured) {
    const prefix = imageUrlPrefix();
    const files = product.colors
      .flatMap((c) => [c.images?.front, c.images?.back])
      .filter((u): u is string => !!u && u.startsWith(prefix))
      .map((u) => u.slice(prefix.length));
    if (files.length) await supabaseAdmin().storage.from(IMAGE_BUCKET).remove(files).catch(() => undefined);
  }
  return { ok: true };
}

export async function saveOrder(ids: string[]): Promise<Result> {
  await reorderProducts(ids);
  refresh();
  return { ok: true };
}

/** Raw uploads land here; only finalizeImageUpload() reads them, and cleanImage() never accepts them. */
const INCOMING = "incoming/";
const INCOMING_RE = /^incoming\/[0-9a-f-]{36}\.(png|jpg|webp|avif)$/;

/**
 * Step 1 of a photo upload. Validates type and size, then returns a one-time signed upload URL
 * for a raw file under incoming/. The browser PUTs the file straight to Supabase Storage, so photos
 * never pass through the Vercel function (its request body limit is 4.5 MB). The bucket enforces
 * type and size again. Step 2 is finalizeImageUpload(path).
 */
export async function createImageUpload(meta: { type: string; size: number }): Promise<
  Result<{ uploadUrl: string; path: string; apiKey: string; removesBackground: boolean }>
> {
  if (!supabaseConfigured) return { ok: false, error: "Photo uploads need Supabase. Add the keys to .env.local." };
  const ext = EXT[meta?.type];
  if (!ext) return { ok: false, error: "Use a PNG, JPG, WebP or AVIF photo." };
  if (!(meta.size > 0) || meta.size > MAX_BYTES) return { ok: false, error: "Photos must be under 6 MB." };
  const path = `${INCOMING}${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from(IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Try again." };
  return {
    ok: true,
    uploadUrl: data.signedUrl,
    path,
    apiKey: supabasePublicKey ?? "",
    // Only tells the admin UI whether to say "Removing background…"; the key itself never leaves the server.
    removesBackground: Boolean(process.env.REMOVE_BG_API_KEY?.trim()),
  };
}

/**
 * Step 2 of a photo upload. Downloads the raw file from incoming/. If it is opaque and
 * REMOVE_BG_API_KEY is set, remove.bg cuts the background out first (otherwise opaque photos are
 * rejected). Then it is framed with sharp
 * (lib/image.ts: transparent 1000x1300 WebP that hangs like the drawn garments), stores it as
 * <uuid>.webp at the bucket root and returns its public URL. The raw file is always removed.
 */
export async function finalizeImageUpload(path: string): Promise<Result<{ publicUrl: string }>> {
  if (!supabaseConfigured) return { ok: false, error: "Photo uploads need Supabase. Add the keys to .env.local." };
  if (typeof path !== "string" || !INCOMING_RE.test(path)) return { ok: false, error: "Unknown upload. Try again." };
  const storage = supabaseAdmin().storage.from(IMAGE_BUCKET);
  try {
    const { data: raw, error } = await storage.download(path);
    if (error || !raw) return { ok: false, error: "Couldn't read the upload. Try again." };
    if (!EXT[raw.type] && raw.type) return { ok: false, error: "Use a PNG, JPG, WebP or AVIF photo." };
    if (!(raw.size > 0) || raw.size > MAX_BYTES) return { ok: false, error: "Photos must be under 6 MB." };

    let framed: Buffer;
    try {
      framed = await prepareGarmentPhoto(Buffer.from(await raw.arrayBuffer()), raw.type, process.env.REMOVE_BG_API_KEY?.trim());
    } catch (e) {
      if (e instanceof ImageRejected) return { ok: false, error: e.message };
      throw e;
    }
    try {
      return { ok: true, publicUrl: await storeProductImage(framed) };
    } catch {
      return { ok: false, error: "Couldn't save the photo. Try again." };
    }
  } catch {
    return { ok: false, error: "Couldn't process the photo. Try again." };
  } finally {
    await storage.remove([path]).catch(() => undefined);
  }
}

// ---------------------------------------------------------------- lookbook ("Off the rack")
// Uploads reuse step 1 (createImageUpload); step 2 is uploadLookbookImage, which skips the garment
// cutout/framing. Every action validates its input like clean() does for products.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function refreshLookbook() {
  revalidatePath("/");
  revalidatePath("/admin");
}

type LookPatch = { caption?: unknown; productId?: unknown; published?: unknown };

/** Validates caption (≤140 chars, one line), product link (must exist) and the publish flag. */
async function cleanLook(input: LookPatch): Promise<Result<{ caption?: string; product_id?: string | null; published?: boolean }>> {
  const out: { caption?: string; product_id?: string | null; published?: boolean } = {};
  if (input.caption !== undefined) {
    if (typeof input.caption !== "string") return { ok: false, error: "Caption must be text." };
    const caption = input.caption.replace(/\s+/g, " ").trim();
    if (caption.length > 140) return { ok: false, error: "Keep the caption under 140 characters." };
    out.caption = caption;
  }
  if (input.productId !== undefined) {
    if (input.productId === null || input.productId === "") out.product_id = null;
    else if (typeof input.productId !== "string" || !/^[a-z0-9-]{1,80}$/.test(input.productId))
      return { ok: false, error: "Unknown product." };
    else {
      if (!(await getProduct(input.productId, { includeDrafts: true }))) return { ok: false, error: "Unknown product." };
      out.product_id = input.productId;
    }
  }
  if (input.published !== undefined) {
    if (typeof input.published !== "boolean") return { ok: false, error: "Invalid publish setting." };
    out.published = input.published;
  }
  return { ok: true, ...out };
}

/**
 * Step 2 of a lookbook upload: reads the raw file from incoming/, auto-orients it, scales it to at most
 * 1400px tall, saves WebP q80 without metadata (lib/image.ts lookbookPhoto) at the bucket root, and adds
 * it to the end of the lookbook as a draft. The raw file is always removed.
 */
export async function uploadLookbookImage(path: string, meta: LookPatch = {}): Promise<Result<{ id: string }>> {
  if (!supabaseConfigured) return { ok: false, error: "Photo uploads need Supabase. Add the keys to .env.local." };
  if (typeof path !== "string" || !INCOMING_RE.test(path)) return { ok: false, error: "Unknown upload. Try again." };
  const fields = await cleanLook({ caption: meta.caption ?? "", productId: meta.productId ?? null });
  if (!fields.ok) return fields;
  const storage = supabaseAdmin().storage.from(IMAGE_BUCKET);
  try {
    const { data: raw, error } = await storage.download(path);
    if (error || !raw) return { ok: false, error: "Couldn't read the upload. Try again." };
    if (!EXT[raw.type] && raw.type) return { ok: false, error: "Use a PNG, JPG, WebP or AVIF photo." };
    if (!(raw.size > 0) || raw.size > MAX_BYTES) return { ok: false, error: "Photos must be under 6 MB." };
    let webp: Buffer;
    try {
      webp = await lookbookPhoto(Buffer.from(await raw.arrayBuffer()));
    } catch (e) {
      if (e instanceof ImageRejected) return { ok: false, error: e.message };
      throw e;
    }
    const name = `${randomUUID()}.webp`;
    const put = await storage.upload(name, webp, { contentType: "image/webp", cacheControl: "31536000" });
    if (put.error) return { ok: false, error: "Couldn't save the photo. Try again." };
    const id = await addLookbookItem({
      src: storage.getPublicUrl(name).data.publicUrl,
      caption: fields.caption ?? "",
      product_id: fields.product_id ?? null,
      published: false,
    });
    refreshLookbook();
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Couldn't process the photo. Try again." };
  } finally {
    await storage.remove([path]).catch(() => undefined);
  }
}

/** Caption, product link and publish flag of one photo. */
export async function saveLookbookItem(id: string, patch: LookPatch): Promise<Result> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "Unknown photo." };
  const fields = await cleanLook(patch ?? {});
  if (!fields.ok) return fields;
  const { ok: _ok, ...update } = fields;
  if (!Object.keys(update).length) return { ok: true };
  await updateLookbookItem(id, update);
  refreshLookbook();
  return { ok: true };
}

export async function removeLookbookItem(id: string): Promise<Result> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "Unknown photo." };
  const src = await deleteLookbookItem(id);
  refreshLookbook();
  // Best effort: drop the file. The row is already gone either way.
  const file = src && cleanImage(src) && supabaseConfigured ? src.slice(imageUrlPrefix().length) : undefined;
  if (file) await supabaseAdmin().storage.from(IMAGE_BUCKET).remove([file]).catch(() => undefined);
  return { ok: true };
}

export async function saveLookbookOrder(ids: string[]): Promise<Result> {
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((x) => typeof x === "string" && UUID_RE.test(x)))
    return { ok: false, error: "Invalid order." };
  const known = new Set((await getLookbook({ includeDrafts: true })).map((l) => l.id));
  await reorderLookbook(ids.filter((x) => known.has(x)));
  refreshLookbook();
  return { ok: true };
}
