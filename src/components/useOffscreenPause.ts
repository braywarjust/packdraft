"use client";

import { useEffect, type RefObject } from "react";

// One shared IntersectionObserver for every animated slab and pack. When an element scrolls out of view it gets
// `data-paused`, and globals.css pauses every animation inside it, so off-screen slabs cost nothing while they look
// exactly the same when they come back. It sets the attribute directly, so nothing re-renders.
let io: IntersectionObserver | null = null;
function observer() {
  if (!io && typeof IntersectionObserver !== "undefined") {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) (e.target as HTMLElement).toggleAttribute("data-paused", !e.isIntersecting);
    }, { rootMargin: "150px" });
  }
  return io;
}

/** `enabled = false` leaves the element alone (e.g. a slab that is always still). */
export function useOffscreenPause(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    const o = observer();
    if (!el || !o || !enabled) return;
    o.observe(el);
    return () => o.unobserve(el);
  }, [ref, enabled]);
}
