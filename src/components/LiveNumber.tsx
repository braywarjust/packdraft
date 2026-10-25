"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A points number that animates when it changes (used by <Coins live> and <Fpts live>).
 * Gains count up, bump the number, pop the currency icon with a ring and a burst of sparks, and float a "+N" chip
 * (with the icon) up off the number. Drops just count down quietly. Nothing animates on first render.
 * Everything runs on the Web Animations API and direct text updates, so it never re-renders React per frame, and the
 * effects are drawn in a layer on <body> so cards with overflow-hidden can't clip them.
 */
type Kind = "pp" | "fp";
const COLORS: Record<Kind, { text: string; spark: string[] }> = {
  pp: { text: "#facc15", spark: ["#facc15", "#fde68a", "#fef3c7"] },
  fp: { text: "#ffffff", spark: ["#38bdf8", "#bae6fd", "#ffffff"] },
};

/** from: count up from this value when it first appears. */
export function LiveNumber({ value, digits = 0, kind, icon, from, className = "" }: { value: number; digits?: number; kind: Kind; icon?: React.ReactNode; from?: number; className?: string }) {
  const fmt = (v: number) => (digits ? v.toFixed(digits) : Math.round(v).toLocaleString("en-US"));
  const [first] = useState(() => fmt(from ?? value)); // React only renders the starting text; changes are written directly
  const numRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const shown = useRef(from ?? value);
  const target = useRef(from ?? value);
  const raf = useRef(0);

  useEffect(() => {
    const el = numRef.current;
    const delta = value - target.current;
    target.current = value;
    if (!el || (delta === 0 && shown.current === value)) return;
    cancelAnimationFrame(raf.current);
    const quiet = document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quiet) { shown.current = value; el.textContent = fmt(value); return; }

    const from = shown.current, start = performance.now();
    const size = Math.abs(delta) * (digits ? 10 ** digits : 1);
    const dur = delta > 0 ? 500 + Math.min(700, Math.log10(size + 1) * 200) : 380;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      shown.current = k === 1 ? value : from + (value - from) * (1 - (1 - k) ** 3);
      const s = fmt(shown.current);
      if (el.textContent !== s) el.textContent = s;
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    if (delta > 0) celebrate(el, iconRef.current, kind, `+${digits ? delta.toFixed(digits) : Math.round(delta).toLocaleString("en-US")}`, size);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <span className={`inline-flex items-center whitespace-nowrap ${className}`}>
      {icon && <span ref={iconRef} className="inline-flex">{icon}</span>}
      <span ref={numRef} className="inline-block tabular-nums">{first}</span>
    </span>
  );
}

/** Where to draw: page coordinates, or viewport ones if the number sits in something fixed (header, sidebar). */
function anchor(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  let fixed = false;
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const p = getComputedStyle(n).position;
    if (p === "fixed" || p === "sticky") { fixed = true; break; }
  }
  return { cx: r.left + r.width / 2 + (fixed ? 0 : scrollX), cy: r.top + r.height / 2 + (fixed ? 0 : scrollY), top: r.top + (fixed ? 0 : scrollY), w: r.width, h: r.height, fixed, nearTop: r.top < 64 };
}

function layer(fixed: boolean, css: Partial<CSSStyleDeclaration>) {
  const d = document.createElement("span");
  Object.assign(d.style, { position: fixed ? "fixed" : "absolute", left: "0", top: "0", pointerEvents: "none", zIndex: "90" }, css);
  document.body.appendChild(d);
  return d;
}

function celebrate(num: HTMLElement, icon: HTMLElement | null, kind: Kind, label: string, size: number) {
  // Skip copies that aren't on screen (e.g. the mobile top bar's balance on a desktop layout).
  const box = num.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const c = COLORS[kind];
  const big = Math.min(1, Math.log10(size + 1) / 4); // 0 for tiny gains, 1 for 10,000+

  num.animate([{ transform: "scale(1)" }, { transform: `scale(${1.14 + big * 0.08})`, offset: 0.25 }, { transform: "scale(1)" }], { duration: 520, easing: "cubic-bezier(.3,.9,.4,1)" });

  // Floating "+N" chip with the currency icon, rising off the number (or dropping below it right at the top of the screen).
  const a = anchor(num);
  const dir = a.nearTop ? 1 : -1;
  const fs = Math.max(11, Math.min(20, parseFloat(getComputedStyle(num).fontSize) * 0.6));
  const chip = layer(a.fixed, {
    left: `${a.cx}px`, top: `${a.nearTop ? a.top + a.h : a.top}px`, display: "inline-flex", alignItems: "center", gap: "0.25em", whiteSpace: "nowrap",
    padding: "2px 8px", borderRadius: "999px", background: "rgba(12,18,27,.9)", boxShadow: "0 0 0 1px rgba(255,255,255,.12), 0 6px 16px rgba(0,0,0,.35)",
    color: c.text, fontSize: `${fs}px`, fontWeight: "800", lineHeight: "1.3", fontVariantNumeric: "tabular-nums",
  });
  chip.textContent = label;
  const glyph = icon?.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (glyph) chip.appendChild(glyph);
  chip.animate([
    { transform: `translate(-50%, ${dir < 0 ? 0 : -60}%) scale(.6)`, opacity: 0 },
    { transform: `translate(-50%, ${dir < 0 ? -110 : 40}%) scale(1.08)`, opacity: 1, offset: 0.2 },
    { transform: `translate(-50%, ${dir < 0 ? -150 : 80}%) scale(1)`, opacity: 1, offset: 0.65 },
    { transform: `translate(-50%, ${dir < 0 ? -230 : 160}%) scale(.96)`, opacity: 0 },
  ], { duration: 1300 + big * 400, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => chip.remove();

  if (!icon) return;
  icon.animate([
    { transform: "scale(1) rotate(0)" }, { transform: "scale(1.55) rotate(-14deg)", offset: 0.3 }, { transform: "scale(.9) rotate(8deg)", offset: 0.6 },
    { transform: "scale(1.06) rotate(-3deg)", offset: 0.82 }, { transform: "scale(1) rotate(0)" },
  ], { duration: 720, easing: "ease-out" });

  const ia = anchor(icon);
  const s = Math.max(14, ia.w);
  const ring = layer(ia.fixed, { left: `${ia.cx - s}px`, top: `${ia.cy - s}px`, width: `${s * 2}px`, height: `${s * 2}px`, borderRadius: "50%", border: `2px solid ${c.spark[0]}` });
  ring.animate([
    { transform: "scale(.25)", opacity: 1, easing: "cubic-bezier(.2,.8,.3,1)" },
    { transform: `scale(${0.8 + big * 0.4})`, opacity: 0.7, offset: 0.5 },
    { transform: `scale(${1 + big * 0.5})`, opacity: 0 },
  ], { duration: 650 }).onfinish = () => ring.remove();

  const n = 6 + Math.round(big * 10);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const dist = s * (0.9 + Math.random() * 0.9) * (1 + big * 0.6);
    const d = (3.5 + Math.random() * 3) * Math.max(1, Math.min(1.8, s / 24));
    const dot = layer(ia.fixed, { left: `${ia.cx - d / 2}px`, top: `${ia.cy - d / 2}px`, width: `${d}px`, height: `${d}px`, borderRadius: "50%", background: c.spark[i % c.spark.length] });
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
    // Shoot out fast, hang for a moment, then fade as they slow.
    dot.animate([
      { transform: "translate(0,0) scale(1.2)", opacity: 1, easing: "cubic-bezier(.15,.8,.3,1)" },
      { transform: `translate(${x * 0.85}px, ${y * 0.85}px) scale(1)`, opacity: 1, offset: 0.55, easing: "ease-out" },
      { transform: `translate(${x}px, ${y}px) scale(.3)`, opacity: 0 },
    ], { duration: 600 + Math.random() * 300 }).onfinish = () => dot.remove();
  }
}
