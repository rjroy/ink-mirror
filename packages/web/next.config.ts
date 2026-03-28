import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ink-mirror/shared"],
  allowedDevOrigins: ["*.raptor-piranha.ts.net"],
};

export default nextConfig;
