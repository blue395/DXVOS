import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack's build cache (.next/cache/turbopack) snapshots environment
    // variables — including secrets like SESSION_SECRET — to detect changes.
    // Netlify's secret scanner (rightly) fails the build when it finds them.
    // Builds are fast anyway, so don't write the cache: secrets never touch disk.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
