/**
 * Supabase clients. Server-only: the service role key must never reach the browser.
 * `server-only` makes any import from a "use client" file fail the build.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const IMAGE_BUCKET = "product-images";

/** Env values pasted into dashboards often carry stray spaces or quotes; strip them. */
const env = (v: string | undefined) => v?.trim().replace(/^(["'])(.*)\1$/, "$2").trim() || undefined;

// Referenced literally (not process.env[name]) so Next can inline the NEXT_PUBLIC_ ones.
const url = env(process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/+$/, "");
const anonKey = env(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const serviceKey = env(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const supabaseConfigured = Boolean(url && anonKey && serviceKey);
/** Publishable (anon) key, cleaned. Safe for the browser: RLS limits it to reading published products. */
export const supabasePublicKey = anonKey;

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

let anon: SupabaseClient | undefined;
let admin: SupabaseClient | undefined;

function missing(): never {
  const names = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);
  const where = process.env.VERCEL
    ? `Add ${names.length > 1 ? "them" : "it"} in Vercel → Project → Settings → Environment Variables, ticked for the ${
        process.env.VERCEL_ENV ?? "current"
      } environment, then redeploy (variables only apply to new deployments).`
    : "Add them to .env.local (see .env.example) and restart.";
  throw new Error(`Supabase is not configured: missing ${names.join(", ")}. ${where}`);
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
  return `${url}/storage/v1/object/public/${IMAGE_BUCKET}/`;
}
