/* eslint-disable @next/next/no-img-element */
export type LogoColor = "red" | "white" | "black";

// The source SVG is red; CSS filters recolor it so one file serves every variant.
const FILTER: Record<LogoColor, string | undefined> = {
  red: undefined,
  white: "brightness(0) invert(1)",
  black: "brightness(0)",
};

/** The PackDraft wordmark. */
export function Logo({ height = 40, color = "red", className = "", style }: { height?: number; color?: LogoColor; className?: string; style?: React.CSSProperties }) {
  return (
    <img
      src="/packdraft-logo.svg"
      alt="PackDraft"
      height={height}
      width={Math.round((height * 304) / 154)}
      className={className}
      style={{ height, width: "auto", filter: FILTER[color], ...style }}
    />
  );
}

/** Oversized, faint logo used as a background watermark. Place inside a `relative overflow-hidden` parent. */
export function LogoWatermark({ color = "red", opacity = 0.07, height = 220, className = "" }: { color?: LogoColor; opacity?: number; height?: number; className?: string }) {
  return (
    <Logo
      color={color}
      height={height}
      className={`pointer-events-none absolute select-none ${className}`}
      style={{ opacity, transform: "rotate(-8deg)" }}
    />
  );
}
