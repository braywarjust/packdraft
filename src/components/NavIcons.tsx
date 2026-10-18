export const NAV_ICONS = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  leagues: "/league-logo-icon.svg",
  packs: "/packdraft-pack-icon.svg",
  collection: "/collection-icon.svg",
  mock: "M4 6h16M4 12h16M4 18h10",
  studio: "/team-studio-icon.svg",
  bets: "/sportsbook-icon.svg",
  casino: "/casino-icon.svg",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H4V3h8",
  collapse: "M15 6l-6 6 6 6",
  expand: "M9 6l6 6-6 6",
};
/** Optical sizes for the solid image icons so they weigh the same as the 2px line icons. */
const MASK_SIZE: Record<string, [number, number]> = { "/packdraft-pack-icon.svg": [15, 15], "/league-logo-icon.svg": [16, 15], "/team-studio-icon.svg": [16, 15], "/collection-icon.svg": [16, 15], "/casino-icon.svg": [17, 15],
  // Two cards side by side: drawn twice as wide so each card matches the single-card icons (16×15).
  "/sportsbook-icon.svg": [32, 15] };
/** A nav icon at any size (18px in the sidebar). `box` widens the slot so wide icons (Sportsbook) don't crowd the label. */
export function NavIcon({ d, size = 18, box, maxW }: { d: string; size?: number; box?: number; maxW?: number }) {
  // maxW: shrink a wide image icon to fit a tile (page headers).
  const k = Math.min(size / 18, maxW ? maxW / (MASK_SIZE[d] ?? [15, 15])[0] : Infinity);
  // Image icons (a public/ SVG path) are drawn as a mask in currentColor so they match the line icons' colour and states.
  if (d.startsWith("/")) {
    // A wider-than-slot icon gets equal negative margins so it overflows both sides evenly and stays centred.
    const w = (MASK_SIZE[d] ?? [15, 15])[0] * k;
    return (
      <span aria-hidden className="grid shrink-0 place-items-center" style={{ width: box ?? size, height: size }}>
        <span className="bg-current" style={{ width: w, height: (MASK_SIZE[d] ?? [15, 15])[1] * k, marginInline: Math.min(0, ((box ?? size) - w) / 2), mask: `url(${d}) center / contain no-repeat`, WebkitMask: `url(${d}) center / contain no-repeat` }} />
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="shrink-0" style={box ? { marginInline: (box - size) / 2 } : undefined} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
