"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the page's server data every `ms`, but only while the tab is visible (and once right away when you come back). */
export function AutoRefresh({ ms = 4000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const tick = () => { if (!document.hidden) { last = Date.now(); router.refresh(); } };
    const t = setInterval(tick, ms);
    const onShow = () => { if (!document.hidden && Date.now() - last > ms) tick(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, [router, ms]);
  return null;
}
