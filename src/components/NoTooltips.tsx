"use client";

import { useEffect } from "react";

/**
 * Turns off the browser's hover tooltips app-wide. Mount once (root layout). A `title` is removed the moment the
 * pointer reaches it, before the browser can show it; when the element has no visible text, the title is kept as its
 * aria-label so screen readers still announce it.
 */
export function NoTooltips() {
  useEffect(() => {
    const strip = (e: Event) => {
      let el = e.target as Element | null;
      while (el && el !== document.documentElement) {
        const t = el.getAttribute?.("title");
        if (t != null) {
          el.removeAttribute("title");
          if (t && !el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", t);
        }
        el = el.parentElement;
      }
    };
    document.addEventListener("pointerover", strip, true);
    document.addEventListener("focusin", strip, true);
    return () => {
      document.removeEventListener("pointerover", strip, true);
      document.removeEventListener("focusin", strip, true);
    };
  }, []);
  return null;
}
