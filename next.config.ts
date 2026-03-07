import type { NextConfig } from "next";
// @ts-expect-error -- next-pwa has no type declarations
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Don't precache the share-target API route
  buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig: NextConfig = {
  turbopack: {}
  /* config options here */
};

export default withPWA(nextConfig);
