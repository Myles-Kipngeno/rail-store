import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Product images uploaded from the admin go through a server action.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
