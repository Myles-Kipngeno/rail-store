/**
 * Supabase clients. Server-only: the service role key must never reach the browser.
 * `server-only` makes any import from a "use client" file fail the build.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const IMAGE_BUCKET = "product-images";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && anonKey && serviceKey);

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

let anon: SupabaseClient | undefined;
let admin: SupabaseClient | undefined;

function missing(): never {
  throw new Error(
    "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
  );
}

/** Public client: RLS applies, so it only ever sees published products. */
export function supabasePublic() {
  if (!url || !anonKey) missing();
  return (anon ??= createClient(url, anonKey, opts));
}

/** Service-role client: bypasses RLS. Admin reads/writes and storage uploads only. */
export function supabaseAdmin() {
  if (!url || !serviceKey) missing();
  return (admin ??= createClient(url, serviceKey, opts));
}

/** Public URL prefix of the image bucket, used to validate image URLs coming from the admin form. */
export function imageUrlPrefix() {
  if (!url) missing();
  return `${url.replace(/\/+$/, "")}/storage/v1/object/public/${IMAGE_BUCKET}/`;
}
