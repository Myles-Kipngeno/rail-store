import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Product photos upload straight from the browser to Supabase Storage (signed URLs), so server
  // actions only carry JSON and the default 1 MB body limit is enough (Vercel caps bodies at 4.5 MB).
};

export default nextConfig;
