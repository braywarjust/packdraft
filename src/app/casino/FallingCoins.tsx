/**
 * Pack Points icons drifting down behind the casino, a shade lighter than the page, so it feels like a game floor.
 * Pure CSS (no JavaScript): each coin falls on a loop with a gentle sway and spin. Bigger coins are a touch lighter
 * and fall faster, which gives a little depth. Positions come from a fixed seed, so the server and browser agree.
 */
function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r = seeded(77);
const N = 30;
const COINS = Array.from({ length: N }, (_, i) => {
  const depth = r(); // 0 = far, 1 = near
  const size = Math.round(36 + depth * 32);
  const dur = +(30 - depth * 12 + r() * 4).toFixed(1);
  return {
    left: +(((i + r() * 0.9) / N) * 100).toFixed(2), // spread evenly across the width, jittered
    size,
    dur,
    delay: -+(r() * dur).toFixed(1), // already mid-fall on load
    sway: +(3 + r() * 3).toFixed(1),
    r0: Math.round(r() * 50 - 25),
    spin: Math.round((r() < 0.5 ? -1 : 1) * (30 + r() * 60)),
    dx: Math.round(r() * 60 - 30),
    y: +(r() * 100).toFixed(1),
    color: depth > 0.6 ? "#2a3347" : depth > 0.3 ? "#273043" : "#242c3e",
  };
});

export function FallingCoins() {
  const mask = "url(/packbucks.svg) center / contain no-repeat";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden lg:left-[var(--sb)]">
      {COINS.map((c, i) => (
        <span key={i} className="pp-fall" style={{ left: `${c.left}%`, "--dur": `${c.dur}s`, "--delay": `${c.delay}s`, "--r0": `${c.r0}deg`, "--r1": `${c.r0 + c.spin}deg`, "--dx": `${c.dx}px`, "--y": `${c.y}vh` } as React.CSSProperties}>
          <span className="pp-sway" style={{ "--sway": `${c.sway}s` } as React.CSSProperties}>
            <span className="block" style={{ width: c.size * 1.2, height: c.size * 0.88, background: c.color, mask, WebkitMask: mask }} />
          </span>
        </span>
      ))}
    </div>
  );
}
