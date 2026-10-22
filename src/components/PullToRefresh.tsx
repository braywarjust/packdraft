"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatedLogo } from "./AnimatedLogo";
import { LoadingLogo } from "./LoadingLogo";
import { LOADER_MS } from "./NavShell";

const PULL = 70; // how far (px, after damping) you pull before letting go refreshes

/**
 * Pull down from the top of any page to reload it, on the iPhone home-screen app (Update 3.2.1). Safari in a browser
 * tab has its own pull-to-refresh, so this only runs when PackDraft is opened full screen from the home screen. The
 * logo follows your finger, then plays while the page's data reloads (for at least LOADER_MS, like every loader).
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (!standalone) return;
    const locked = () => document.documentElement.style.overflow === "hidden"; // a popup is open
    const onStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 && e.touches.length === 1 && !locked() ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) { pullRef.current = 0; setPull(0); return; }
      pullRef.current = Math.min(110, dy * 0.5);
      setPull(pullRef.current);
    };
    const onEnd = () => {
      if (startY.current == null) return;
      startY.current = null;
      const go = pullRef.current >= PULL;
      pullRef.current = 0;
      setPull(0);
      if (!go) return;
      setBusy(true);
      const t0 = performance.now();
      start(async () => {
        router.refresh();
        await new Promise((r) => setTimeout(r, Math.max(0, LOADER_MS - (performance.now() - t0))));
      });
    };
    addEventListener("touchstart", onStart, { passive: true });
    addEventListener("touchmove", onMove, { passive: true });
    addEventListener("touchend", onEnd);
    addEventListener("touchcancel", onEnd);
    return () => {
      removeEventListener("touchstart", onStart);
      removeEventListener("touchmove", onMove);
      removeEventListener("touchend", onEnd);
      removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  useEffect(() => { if (!pending) setBusy(false); }, [pending]);

  const shown = busy || pull > 0;
  if (!shown) return null;
  const ready = pull >= PULL;
  return (
    <div className="safe-top pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center lg:hidden" aria-live="polite">
      <div className="mt-14 rounded-full bg-panel/95 px-4 py-2 shadow-xl ring-1 ring-line backdrop-blur transition-transform duration-75"
        style={{ transform: busy ? undefined : `translateY(${pull - 40}px) scale(${0.6 + 0.4 * Math.min(1, pull / PULL)})`, opacity: busy ? 1 : Math.min(1, pull / 40) }}>
        {busy ? <LoadingLogo size={64} label="Reloading" />
          // While pulling, the logo turns with your finger; once far enough it starts playing (let go to reload).
          : <span role="status" aria-label={ready ? "Release to reload" : "Pull to reload"} className={`block ${ready ? "logo-play logo-fast" : ""}`}
              style={{ width: 64, transform: `rotate(${Math.min(1, pull / PULL) * 360 - 360}deg)` }}><AnimatedLogo className="block w-full" /></span>}
      </div>
    </div>
  );
}
