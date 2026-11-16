import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Product photos upload straight from the browser to Supabase Storage (signed URLs), so server
  // actions only carry JSON and the default 1 MB body limit is enough (Vercel caps bodies at 4.5 MB).
  images: {
    // next/image on the home page: product photos live in the public product-images bucket.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/product-images/**" }],
  },
  // The home page lists public/off-the-rack/*.jpg when it renders. It re-renders on the server
  // (revalidate / admin saves), where public/ is only present if traced into the function.
  outputFileTracingIncludes: { "/": ["./public/off-the-rack/**"] },
};

export default nextConfig;
