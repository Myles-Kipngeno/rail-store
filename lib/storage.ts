/**
 * Product photo storage: the public `product-images` bucket, files at its root as <uuid>.webp.
 * Used by the admin upload actions and scripts/demo-photos.ts. Server-only.
 */
import "server-only";
import { randomUUID } from "crypto";
import { IMAGE_BUCKET, supabaseAdmin } from "./supabase";

/** Stores a finished WebP and returns its public URL. Throws on failure. */
export async function storeProductImage(webp: Buffer): Promise<string> {
  const storage = supabaseAdmin().storage.from(IMAGE_BUCKET);
  const name = `${randomUUID()}.webp`;
  const put = await storage.upload(name, webp, { contentType: "image/webp", cacheControl: "31536000" });
  if (put.error) throw new Error(`Couldn't save the photo: ${put.error.message}`);
  return storage.getPublicUrl(name).data.publicUrl;
}
