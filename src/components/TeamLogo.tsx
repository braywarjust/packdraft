"use client";

import { useState } from "react";

/**
 * NBA team logo from ESPN's CDN by team abbreviation, falling back to the abbreviation. ESPN's "500-dark"
 * set is blank for most teams, so we use the standard logos with a faint light outline so dark ones
 * (Nets, Spurs…) still read on the dark theme.
 */
export function TeamLogo({ team, size = 20, className = "" }: { team: string; size?: number; className?: string }) {
  const [step, setStep] = useState(0);
  const slug = team.toLowerCase();
  if (!team || step > 0) return <span className={`inline-block text-[10px] font-bold text-zinc-500 ${className}`}>{team}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`} alt={team} title={team} width={size} height={size}
      loading="lazy" onError={() => setStep((s) => s + 1)} className={`inline-block shrink-0 object-contain ${className}`} style={{ width: size, height: size, filter: "drop-shadow(0 0 1px rgba(255,255,255,.45))" }} />
  );
}
