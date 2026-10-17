/** Small line icons (used instead of emoji). Inherit text colour; size via className (default 1em). */
type P = { className?: string; title?: string };
const svg = (d: string, fill = false) => function Icon({ className = "", title }: P) {
  return (
    // aria-label rather than an SVG <title>, which the browser would show as a hover tooltip.
    <svg viewBox="0 0 24 24" aria-hidden={!title} role={title ? "img" : undefined} aria-label={title} className={`inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em] ${className}`}
      fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
};
export const BoltIcon = svg("M13 2 4 14h7l-1 8 9-12h-7z", true);
export const LockIcon = svg("M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4");
export const CrownIcon = svg("M3 18h18l-2-11-5 5-2-7-2 7-5-5z", true);
export const XIcon = svg("M6 6l12 12M18 6 6 18");
export const StarIcon = svg("m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", true);
export const CheckIcon = svg("M5 12.5 10 17 19 7");
export const PlayIcon = svg("M7 4v16l13-8z", true);
export const ForwardIcon = svg("M4 5v14l8-7zM12 5v14l8-7z", true);
export const MicIcon = svg("M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3");
export const CameraIcon = svg("M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z");
export const ClockIcon = svg("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2");
