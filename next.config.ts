import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Which deploy this build is (Netlify sets DEPLOY_ID at build time), so open pages can
  // tell when DXV OS has been redeployed and offer a reload (stale-version-banner.tsx).
  env: { NEXT_PUBLIC_DEPLOY_ID: process.env.DEPLOY_ID ?? process.env.COMMIT_REF ?? "local" },
  experimental: {
    // Turbopack's build cache (.next/cache/turbopack) snapshots environment
    // variables — including secrets like SESSION_SECRET — to detect changes.
    // Netlify's secret scanner (rightly) fails the build when it finds them.
    // Builds are fast anyway, so don't write the cache: secrets never touch disk.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
