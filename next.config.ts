import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the build root to this project folder. Without this, Turbopack
  // walks up looking for lockfiles and can pick the wrong ancestor
  // directory as the "workspace root" if one happens to sit further up
  // the tree (e.g. a stray package-lock.json in Downloads) — which then
  // breaks how the Netlify server function gets packaged.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Forces a unique build ID (and therefore a different deploy content
  // hash) on every build. Netlify's CLI deploy dedupes uploads by content
  // hash across separate deploys of byte-identical output, and that
  // dedup was found to also skip re-attaching the server function on a
  // "nothing changed" match — pinning a fresh build ID sidesteps that.
  generateBuildId: async () => `deploy-${Date.now()}`,
};

export default nextConfig;
