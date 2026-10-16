import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ".nosync" keeps iCloud Drive (Desktop & Documents sync) from touching build output mid-write.
  distDir: ".next.nosync",
};

export default nextConfig;
