import { IMAGE_BUCKET, supabaseConfigured } from "@/lib/supabase";

// Photos now live in the Supabase Storage bucket `product-images` (served from its CDN).
// This route only keeps old `/uploads/<file>` links working: run `npm run db:seed` to copy the
// local uploads/ folder into the bucket, and these paths redirect to the same file there.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!supabaseConfigured || !/^[a-z0-9-]+\.(png|jpe?g|webp|avif)$/i.test(file)) {
    return new Response("Not found", { status: 404 });
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "");
  return Response.redirect(`${base}/storage/v1/object/public/${IMAGE_BUCKET}/${file}`, 308);
}
