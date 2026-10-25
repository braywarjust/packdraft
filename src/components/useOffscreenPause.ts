"use client";

import { useEffect, type RefObject } from "react";

// One shared IntersectionObserver for every animated shop item. When an element scrolls out of view it gets
// `data-paused`, and globals.css pauses every animation inside it, so off-screen items cost nothing while they look
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

export function useOffscreenPause(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    const o = observer();
    if (!el || !o) return;
    o.observe(el);
    return () => o.unobserve(el);
  }, [ref]);
}
