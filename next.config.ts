import type { NextConfig } from "next";

// Security headers on every response (Blue, 2026-10-06 security review):
// - no other site may show DXV OS inside a frame (stops "clickjacking": tricking someone
//   into clicking a hidden DXV button), and no plugins or <base> tricks;
// - browsers always use HTTPS for DXV OS (HSTS, two years);
// - browsers never guess a file's type (an upload can't be run as a web page);
// - links out of DXV OS only tell the other site our domain, never the page address
//   (invite and sign-in link pages carry one-time tokens in their address);
// - no camera, microphone, location or payment access.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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
