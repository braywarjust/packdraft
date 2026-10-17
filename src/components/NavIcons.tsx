export const NAV_ICONS = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  leagues: "/league-logo-icon.svg",
  packs: "/packdraft-pack-icon.svg",
  collection: "/collection-icon.svg",
  mock: "M4 6h16M4 12h16M4 18h10",
  studio: "/team-studio-icon.svg",
  bets: "M3 7h18v10H3zM7 12h.01M17 12h.01M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H4V3h8",
  collapse: "M15 6l-6 6 6 6",
  expand: "M9 6l6 6-6 6",
};
/** Optical sizes for the solid image icons so they weigh the same as the 2px line icons. */
const MASK_SIZE: Record<string, [number, number]> = { "/packdraft-pack-icon.svg": [15, 15], "/league-logo-icon.svg": [16, 15], "/team-studio-icon.svg": [16, 15], "/collection-icon.svg": [16, 15] };
/** A nav icon at any size (18px in the sidebar). */
export function NavIcon({ d, size = 18 }: { d: string; size?: number }) {
  const k = size / 18;
  // Image icons (a public/ SVG path) are drawn as a mask in currentColor so they match the line icons' colour and states.
  if (d.startsWith("/")) {
    return (
      <span aria-hidden className="grid shrink-0 place-items-center" style={{ width: size, height: size }}>
        <span className="bg-current" style={{ width: (MASK_SIZE[d] ?? [15, 15])[0] * k, height: (MASK_SIZE[d] ?? [15, 15])[1] * k, mask: `url(${d}) center / contain no-repeat`, WebkitMask: `url(${d}) center / contain no-repeat` }} />
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
