"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PageLoading } from "./LoadingLogo";

/**
 * Every page switch shows the loader for at least this long, so it plays the same on every page instead of flickering
 * on fast ones. Set to the slowest page: locally pages take 15–110ms (the matchup page is the slowest), and the live
 * server adds roughly 150ms of network plus a slower CPU, so the slowest live page lands around 500–700ms.
 */
export const LOADER_MS = 700;

/**
 * Page switches feel instant (Update 3.2): the moment you tap a link to another page, the current page is swapped
 * for the logo loader, and the new page fills in behind it. The loader goes away when the address changes (the new
 * page, or its own loading.tsx, takes over) and LOADER_MS has passed since the tap, or after a while if the page
 * never changes (a redirect back here).
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  const path = usePathname();
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The new page is ready: keep the loader up until it has played for LOADER_MS, then show the page.
  const done = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPending(false), Math.max(0, LOADER_MS - (performance.now() - startedAt.current)));
  }, []);

  useEffect(() => done(), [path, done]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.noLoader != null) return;
      const to = new URL(a.href, location.href);
      if (to.origin !== location.origin || to.pathname.startsWith("/api/")) return;
      // Same page (or just a #section on it): nothing to load.
      if (to.pathname === location.pathname && to.search === location.search) return;
      clearTimeout(timer.current);
      startedAt.current = performance.now();
      setPending(true);
      window.scrollTo({ top: 0 });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPending(false), 15_000);
    return () => clearTimeout(t);
  }, [pending]);

  return (
    <>
      {/* Query-only changes (?week=3, ?u=2) also count as a new page. */}
      <Suspense fallback={null}><OnSearchChange done={done} /></Suspense>
      <div hidden={pending}>{children}</div>
      {pending && <PageLoading />}
    </>
  );
}

function OnSearchChange({ done }: { done: () => void }) {
  const q = useSearchParams()?.toString();
  useEffect(() => done(), [q, done]);
  return null;
}
