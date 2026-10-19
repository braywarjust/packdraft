"use client";

import { useEffect, useState } from "react";
import type { SlabData } from "./Slab";

// The pack cover reels (api/pack-showcase), fetched once per page load and shared by every PackArt on the page.
type Reels = Record<string, SlabData[]>;
let cache: Reels | null = null;
let pending: Promise<Reels> | null = null;

export function usePackShowcase(packId: string) {
  const [reels, setReels] = useState<Reels | null>(cache);
  useEffect(() => {
    if (cache) return;
    pending ??= fetch("/api/pack-showcase").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    let live = true;
    pending.then((r) => { cache = r; if (live) setReels(r); });
    return () => { live = false; };
  }, []);
  return reels?.[packId] ?? null;
}
