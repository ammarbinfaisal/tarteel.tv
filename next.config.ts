import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // cacheComponents: true, // Disabled due to compatibility with searchParamsCache
  // reactCompiler: true, // Disabled due to Turbopack + Bun compatibility issue
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default nextConfig;

