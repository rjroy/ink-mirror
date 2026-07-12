import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ink-mirror/shared"],
  allowedDevOrigins: ["*.raptor-piranha.ts.net"],
  // @ink-mirror/shared's relative imports use explicit ".js" extensions
  // (Node16/NodeNext style, needed so `bun`/daemon/CLI can run the .ts
  // sources directly). Neither webpack nor Turbopack resolve ".js" specifiers
  // to ".ts" files by default when transpiling a workspace package's source
  // — webpack needs resolve.extensionAlias to do it explicitly.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
