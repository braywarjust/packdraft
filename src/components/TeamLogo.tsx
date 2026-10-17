"use client";

import { useState } from "react";

/**
 * NBA team logo from ESPN's CDN by team abbreviation. Uses ESPN's dark-background set (lighter variants for teams
 * whose standard logo is dark, e.g. 76ers, Raptors, Jazz) since the app is dark; falls back to the standard
 * logo, then to the abbreviation. No glow or outline, so the real colours show as-is.
 */
export function TeamLogo({ team, size = 20, className = "" }: { team: string; size?: number; className?: string }) {
  const [step, setStep] = useState(0);
  const slug = team.toLowerCase();
  if (!team || step > 1) return <span className={`inline-block text-[10px] font-bold text-zinc-500 ${className}`}>{team}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://a.espncdn.com/i/teamlogos/nba/${step === 0 ? "500-dark" : "500"}/${slug}.png`} alt={team} title={team} width={size} height={size}
      loading="lazy" onError={() => setStep((s) => s + 1)} className={`inline-block shrink-0 object-contain ${className}`} style={{ width: size, height: size }} />
  );
}
