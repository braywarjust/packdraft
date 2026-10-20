import type { MetadataRoute } from "next";

/** Home-screen install info (Android and desktop use this; iPhone uses apple-icon plus the appleWebApp metadata). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PackDraft",
    short_name: "PackDraft",
    description: "Fantasy NBA with your friends, plus mystery packs to rip.",
    start_url: "/",
    display: "standalone",
    background_color: "#1b2130",
    theme_color: "#1b2130",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
