/* eslint-disable @next/next/no-img-element */
// Two source files from Brayden:
//  - packdraft-logo-full.svg: blue + red badge with white lettering (for light backgrounds)
//  - packdraft-logo-simple.svg: light-grey badge with cut-out lettering (for dark/coloured backgrounds, watermarks)
export type LogoColor = "full" | "simple" | "white" | "black" | "red";

const SRC: Record<LogoColor, string> = {
  full: "/packdraft-logo-full.svg",
  red: "/packdraft-logo-full.svg", // legacy name: the brand-colour logo
  simple: "/packdraft-logo-simple.svg",
  white: "/packdraft-logo-simple.svg",
  black: "/packdraft-logo-simple.svg",
};
const FILTER: Partial<Record<LogoColor, string>> = {
  white: "brightness(0) invert(1)",
  black: "brightness(0)",
};
const RATIO: Record<LogoColor, number> = { full: 323 / 179, red: 323 / 179, simple: 311 / 167, white: 311 / 167, black: 311 / 167 };

/** The PackDraft wordmark. */
export function Logo({ height = 40, color = "full", className = "", style }: { height?: number; color?: LogoColor; className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src={SRC[color]}
      alt="PackDraft"
      height={height}
      width={Math.round(height * RATIO[color])}
      className={className}
      style={{ height, width: "auto", filter: FILTER[color], ...style }}
    />
  );
}

/** Oversized, faint logo used as a background watermark. Place inside a `relative overflow-hidden` parent. */
export function LogoWatermark({ color = "full", opacity = 0.07, height = 220, className = "" }: { color?: LogoColor; opacity?: number; height?: number; className?: string }) {
  return (
    <Logo
      color={color}
      height={height}
      className={`pointer-events-none absolute select-none ${className}`}
      style={{ opacity, transform: "rotate(-8deg)" }}
    />
  );
}
