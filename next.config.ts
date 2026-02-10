import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  fallbacks: {
    // image: "/static/images/fallback.png",
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
    additionalManifestEntries: [
      { url: "/offline", revision: "1" },
      { url: "/downloads", revision: "1" },
      { url: "/downloads/reel", revision: "1" },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // cacheComponents: true, // Disabled due to compatibility with searchParamsCache
  // reactCompiler: true, // Disabled due to Turbopack + Bun compatibility issue
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
};

export default withPWA(nextConfig);
