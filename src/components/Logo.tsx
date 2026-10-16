/* eslint-disable @next/next/no-img-element */
/** The PackDraft wordmark. `white` turns the red badge white (for use on red backgrounds). */
export function Logo({ height = 40, white = false, className = "" }: { height?: number; white?: boolean; className?: string }) {
  return (
    <img
      src="/packdraft-logo.svg"
      alt="PackDraft"
      height={height}
      width={Math.round((height * 304) / 154)}
      className={className}
      style={{ height, width: "auto", filter: white ? "brightness(0) invert(1)" : undefined }}
    />
  );
}
