import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Avoid serving stale homepage payloads after DB-only updates.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
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
    // Never cache the homepage document — clips change without a redeploy.
    exclude: [({ asset }: { asset: { name: string } }) => asset.name === "index.html"],
    runtimeCaching: [
      {
        urlPattern: /^\/(\?.*)?$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "homepage",
          networkTimeoutSeconds: 5,
          expiration: { maxAgeSeconds: 60 },
        },
      },
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
    serverBodySizeLimit: "500mb",
  },
};

export default withPWA(nextConfig);
