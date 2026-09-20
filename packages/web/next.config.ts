import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ink-mirror/shared"],
  allowedDevOrigins: ["*.raptor-piranha.ts.net"],
  // @ink-mirror/shared's relative imports use explicit ".js" extensions
  // (Node16/NodeNext style, needed so `bun`/daemon/CLI can run the .ts
  // sources directly). webpack needs resolve.extensionAlias to map those
  // back to ".ts" when transpiling a workspace package's source. Turbopack
  // has no equivalent (its resolveAlias only remaps exact bare specifiers,
  // not extension patterns) — both `dev` and `build` scripts pass
  // `--webpack` for this reason; don't switch either back to Turbopack
  // without an alternative fix for this resolution.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
