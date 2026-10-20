import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ".nosync" keeps iCloud Drive (Desktop & Documents sync) from touching build output mid-write.
  // NEXT_DIST_DIR lets a production build run next to the dev server without sharing its folder.
  distDir: process.env.NEXT_DIST_DIR || ".next.nosync",
};

export default nextConfig;
