"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useScrollLock } from "./useScrollLock";

const IN_MS = 340, OUT_MS = 240;

/** Close the popup you're inside with its slide-down animation, then run `after` (e.g. resolve a confirm). */
const CloseCtx = createContext<(after?: () => void) => void>((after) => after?.());
export const useClosePopup = () => useContext(CloseCtx);

/**
 * Every popup in the app (Update 4.2): a sheet that slides up from the bottom of the screen and fills it, except a
 * strip at the top so the page behind still shows. `size="auto"` (confirmations) is only as tall as its content.
 * A tap on the strip, Escape, or useClosePopup() slides it back down before `onClose` runs.
 */
export function Popup({ onClose, label, size = "full", className = "max-w-3xl", z = "z-[70]", outer = "", children }: {
  onClose: () => void; label?: string; size?: "full" | "auto"; className?: string; z?: string; outer?: string; children: React.ReactNode;
}) {
  useScrollLock(true);
  const [leaving, setLeaving] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const close = useCallback((after?: () => void) => {
    setLeaving(true);
    setTimeout(() => { after?.(); closeRef.current(); }, OUT_MS);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <CloseCtx.Provider value={close}>
      <div className={`fixed inset-0 ${z} flex items-end justify-center bg-black/55 backdrop-blur-[2px] ${outer}`} onClick={() => close()}
        style={{ animation: `${leaving ? "popupFadeOut" : "popupFade"} ${leaving ? OUT_MS : 200}ms ease-out both` }}>
        <div role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}
          className={`relative flex w-full flex-col overflow-hidden rounded-t-3xl border border-b-0 border-line bg-panel shadow-[0_-12px_40px_rgba(0,0,0,.45)] ${
            size === "full" ? "h-[calc(100dvh-4.5rem)]" : "max-h-[calc(100dvh-4.5rem)]"} ${className}`}
          style={{ animation: `${leaving ? `popupDown ${OUT_MS}ms cubic-bezier(.4, 0, 1, 1)` : `popupUp ${IN_MS}ms cubic-bezier(.2, .9, .25, 1)`} both` }}>
          <button type="button" onClick={() => close()} aria-label="Close" className="flex w-full shrink-0 justify-center pb-1 pt-2.5">
            <span className="h-1.5 w-10 rounded-full bg-zinc-500/50" />
          </button>
          <div className="safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </div>
      </div>
    </CloseCtx.Provider>
  );
}
