import { NextResponse } from "next/server";
import { all } from "@/lib/db";
import { PACKS, RARITY_ORDER, type Rarity } from "@/lib/packs";
import { slabPlayerPhoto } from "@/lib/nba/photos";

// Which slice of the league (by projection rank) each pack shows off on its cover reel: the better the pack, the
// better the players. Each pack cycles through 10 of them.
const RANKS: Record<string, [number, number]> = {
  rookie: [110, 220], starter: [70, 140], pro: [40, 90], allpro: [22, 55], hof: [10, 30], goat: [0, 12], megacase: [0, 10],
};

/** Cover reels for the pack art: 10 slabs per pack, at the tiers that pack gives out (best tier first). */
export async function GET() {
  const players = all<{ id: number; name: string; team: string; pos: string; jersey: string | null; headshot: string | null; color: string | null; alt: string | null; team_name: string }>(
    `SELECT p.id, p.name, p.team, p.pos, p.jersey, p.headshot, t.color, t.alt, t.name team_name
     FROM players p JOIN nba_teams t ON t.abbr = p.team WHERE p.active = 1 ORDER BY p.proj DESC`);
  const out: Record<string, unknown[]> = {};
  for (const p of PACKS) {
    const [a, b] = RANKS[p.id] ?? [0, 10];
    const slice = players.slice(a, b);
    // 10 players spread evenly through the slice, so the reel isn't just the top of it.
    const pick = Array.from({ length: 10 }, (_, i) => slice[Math.floor((i * slice.length) / 10)]).filter(Boolean);
    // Tiers the pack gives out at least 5% of the time, best first, cycled across the reel.
    const tiers = [...RARITY_ORDER].reverse().filter((r) => p.odds[r] >= 5) as Rarity[];
    out[p.id] = pick.map((x, i) => ({
      name: x.name, team: x.team, team_name: x.team_name, pos: x.pos, jersey: x.jersey, color: x.color, alt: x.alt,
      photo: slabPlayerPhoto(x.name) ?? x.headshot, rarity: tiers[i % tiers.length] ?? "common",
    }));
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "private, max-age=600" } });
}
