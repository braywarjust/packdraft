"use client";

import { useEffect } from "react";

// Count of open popups, so closing one popup over another doesn't unlock the page early.
let locks = 0;

/** Stops the page behind a popup from scrolling while `active` is true. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    if (locks++ === 0) {
      // Keep the layout from shifting when the scrollbar disappears.
      const bar = window.innerWidth - html.clientWidth;
      html.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      if (bar) html.style.paddingRight = `${bar}px`;
    }
    return () => {
      if (--locks === 0) {
        html.style.overflow = "";
        document.body.style.overflow = "";
        html.style.paddingRight = "";
      }
    };
  }, [active]);
}
