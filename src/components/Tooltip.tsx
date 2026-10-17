"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The app's only hover tooltip: the full name of a slab when it's cut off with "…" (mark the element data-slab-name;
 * give it a value to show something other than its text). Mount <TooltipHost /> once (root layout).
 * The browser's own tooltip is switched off app-wide: a `title` is moved to data-tip on first hover (and kept as
 * aria-label when the element has no text, so screen readers still get it) and never shown.
 */
type Tip = { text: string; x: number; y: number; below: boolean };

const DELAY = 350;
const GAP = 8;

export function TooltipHost() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [shown, setShown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cur = useRef<Element | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hide = () => {
      if (timer.current) clearTimeout(timer.current);
      cur.current = null;
      setShown(false);
      setTip(null);
    };
    const adopt = (el: Element) => {
      const t = el.getAttribute("title");
      if (t != null) {
        el.removeAttribute("title");
        if (t) el.setAttribute("data-tip", t);
        if (t && !el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", t);
      }
      return el.getAttribute("data-tip");
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = e.target as Element | null;
      // Titles never show (the browser's tooltip is switched off app-wide)...
      const titled = target?.closest?.("[title]");
      if (titled) adopt(titled);
      // ...the only tooltip is a slab name that's cut off with "…".
      const name = target?.closest?.("[data-slab-name]") as HTMLElement | null;
      const cut = !!name && (name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1);
      const el: Element | null = cut ? name : null;
      const custom = name?.getAttribute("data-slab-name");
      const text = cut ? ((custom && custom !== "true" ? custom : null) || name!.textContent?.trim() || null) : null;
      if (!el) { if (cur.current) hide(); return; }
      if (el === cur.current) return;
      if (timer.current) clearTimeout(timer.current);
      cur.current = el;
      setShown(false);
      setTip(null);
      if (!text) return;
      timer.current = setTimeout(() => {
        if (cur.current !== el || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        const below = r.top < 44;
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + GAP : r.top - GAP, below });
      }, DELAY);
    };
    const out = (e: PointerEvent) => {
      if (!cur.current) return;
      const to = e.relatedTarget as Node | null;
      if (to && cur.current.contains(to)) return;
      hide();
    };
    document.addEventListener("pointerover", over, true);
    document.addEventListener("pointerout", out, true);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", over, true);
      document.removeEventListener("pointerout", out, true);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  // Keep it on screen horizontally once its width is known, then fade it in.
  useEffect(() => {
    if (!tip || !box.current) return;
    const w = box.current.offsetWidth;
    const x = Math.min(window.innerWidth - 8 - w / 2, Math.max(8 + w / 2, tip.x));
    box.current.style.left = `${x}px`;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={box} role="tooltip"
      className="pointer-events-none fixed z-[200] max-w-[260px] rounded-md border border-white/10 bg-[#0f141f]/95 px-2 py-1 text-xs font-medium leading-snug text-zinc-800 shadow-lg shadow-black/40 backdrop-blur transition duration-100 ease-out"
      style={{
        left: tip.x, top: tip.y,
        transform: `translate(-50%, ${tip.below ? "0" : "-100%"}) translateY(${shown ? 0 : tip.below ? -3 : 3}px)`,
        opacity: shown ? 1 : 0,
      }}>
      {tip.text}
    </div>
  );
}
