"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { LoadingLogo, PageLoading } from "./LoadingLogo";

/**
 * Every loader shows for at least this long, so it plays the same on every page instead of flickering on fast ones.
 * Set to the slowest page: locally pages take 15–110ms (the matchup page is the slowest), and the live server adds
 * roughly 150ms of network plus a slower CPU, so the slowest live page lands around 500–700ms.
 */
export const LOADER_MS = 700;

/**
 * What a tap is loading, which decides where the loader goes (Update 3.2):
 * - "section": another nav bar item (Home, Collection, another league…): the whole page area shows the loader.
 * - "page": another page in the same section (a league tab, a matchup): only the part under the section's own header
 *   and tabs (a <PageShell>), or the whole page area when the section has none.
 * - "query": the same page with other filters (?week=3, ?u=2): only the results under the filters (a <QueryArea>).
 */
type Kind = "section" | "page" | "query";

/** The nav bar item a page belongs to: each league is its own, everything else is its first path segment. */
function sectionOf(path: string) {
  const [first = "", second = ""] = path.split("/").filter(Boolean);
  return first === "league" ? `league/${second}` : first;
}

const NavCtx = createContext<{ kind: Kind | null; shells: React.RefObject<number> }>({ kind: null, shells: { current: 0 } });

/**
 * The moment you tap a link to another page, the part that changes is swapped for the logo loader and the new page
 * fills in behind it. The loader goes away when the address changes and LOADER_MS has passed since the tap, or after
 * a while if the address never changes (a redirect back here).
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const path = usePathname();
  const shells = useRef(0);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The new page is ready: keep the loader up until it has played for LOADER_MS, then show the page.
  const done = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setKind(null), Math.max(0, LOADER_MS - (performance.now() - startedAt.current)));
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
      const k: Kind = sectionOf(to.pathname) !== sectionOf(location.pathname) ? "section" : to.pathname !== location.pathname ? "page" : "query";
      clearTimeout(timer.current);
      startedAt.current = performance.now();
      setKind(k);
      if (k !== "query") window.scrollTo({ top: 0 });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!kind) return;
    const t = setTimeout(() => setKind(null), 15_000);
    return () => clearTimeout(t);
  }, [kind]);

  // A new page in a section without a PageShell has nothing smaller to swap, so it gets the full loader too.
  const full = kind === "section" || (kind === "page" && !shells.current);
  return (
    <NavCtx.Provider value={{ kind, shells }}>
      {/* Query-only changes (?week=3, ?u=2) also count as a new page. */}
      <Suspense fallback={null}><OnSearchChange done={done} /></Suspense>
      <div hidden={full}>{children}</div>
      {full && <PageLoading />}
    </NavCtx.Provider>
  );
}

function OnSearchChange({ done }: { done: () => void }) {
  const q = useSearchParams()?.toString();
  useEffect(() => done(), [q, done]);
  return null;
}

/** A section's pages, under its header and tabs (the league layout): switching pages here only swaps this part. */
export function PageShell({ children }: { children: React.ReactNode }) {
  const { kind, shells } = useContext(NavCtx);
  useEffect(() => {
    shells.current++;
    return () => { shells.current--; };
  }, [shells]);
  return (
    <>
      <div hidden={kind === "page"}>{children}</div>
      {kind === "page" && <PageLoading />}
    </>
  );
}

/** The results under a page's filters: changing a filter only swaps this part. */
export function QueryArea({ children, className }: { children: React.ReactNode; className?: string }) {
  const { kind } = useContext(NavCtx);
  return (
    <>
      <div className={className} hidden={kind === "query"}>{children}</div>
      {kind === "query" && <div className="page-loading grid min-h-[240px] place-items-center"><LoadingLogo size={110} /></div>}
    </>
  );
}
