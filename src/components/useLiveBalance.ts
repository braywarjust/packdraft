"use client";

import { useEffect, useState } from "react";

// Lets a page push a new Pack Points balance to the header and sidebar instantly, without router.refresh()
// re-rendering the whole page (which made the casino stutter on every bet).
const EVENT = "packdraft:balance";

export function announceBalance(n: number) {
  window.dispatchEvent(new CustomEvent<number>(EVENT, { detail: n }));
}

export function useLiveBalance(initial: number) {
  const [n, setN] = useState(initial);
  useEffect(() => setN(initial), [initial]);
  useEffect(() => {
    const on = (e: Event) => setN((e as CustomEvent<number>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return n;
}
