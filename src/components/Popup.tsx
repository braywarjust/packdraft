"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LoadingLogo } from "./LoadingLogo";
import { LOADER_MS } from "./NavShell";
import { useScrollLock } from "./useScrollLock";

/** Size of the loading card every popup opens as (px). */
const SMALL = 112;
const EASE = "cubic-bezier(.2, .9, .25, 1)";

/**
 * Every popup in the app (Update 4.2): always centred on the screen, phone or computer. It opens as a small card with
 * the loading logo, plays it for LOADER_MS (the same time as every other loader, or until `ready`, whichever is
 * later), then grows into the full popup with its content fading in. Escape or a tap outside closes it.
 */
export function Popup({ onClose, ready = true, label, className = "max-w-md", z = "z-[70]", outer = "", children }: {
  onClose: () => void; ready?: boolean; label?: string; className?: string; z?: string; outer?: string; children: React.ReactNode;
}) {
  useScrollLock(true);
  const [played, setPlayed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPlayed(true), LOADER_MS);
    return () => clearTimeout(t);
  }, []);
  const open = played && ready;

  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Grow from the loading card's size into the real one (FLIP), then fade the content in.
  const card = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !card.current) return;
    const r = card.current.getBoundingClientRect();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    card.current.animate(
      [{ transform: `scale(${SMALL / r.width}, ${SMALL / r.height})`, borderRadius: "28px" }, { transform: "none" }],
      { duration: 340, easing: EASE },
    );
    body.current?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 380, easing: "ease-out" });
  }, [open]);

  return (
    <div className={`popup-backdrop fixed inset-0 ${z} flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm ${outer}`} onClick={() => close.current()}>
      {open ? (
        <div ref={card} role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}
          className={`relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain rounded-2xl border border-line bg-panel shadow-2xl ${className}`}>
          <div ref={body}>{children}</div>
        </div>
      ) : (
        <div onClick={(e) => e.stopPropagation()} className="popup-pop grid place-items-center rounded-[28px] border border-line bg-panel shadow-2xl" style={{ width: SMALL, height: SMALL }}>
          <LoadingLogo size={64} label={label ? `Loading ${label}` : "Loading"} />
        </div>
      )}
    </div>
  );
}
