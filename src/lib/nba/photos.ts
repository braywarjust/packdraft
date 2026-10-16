// NBA.com headshots for any player on a slab (current or retired), keyed by NBA person id.
// nba-person-ids.json is built from the public nba_api static player list (normalized full name -> person id).
import ids from "./nba-person-ids.json";

const ID: Record<string, number> = ids as Record<string, number>;
const ALIASES: Record<string, string> = { akeemolajuwon: "hakeemolajuwon", alexandresarr: "alexsarr", bronnyjamesjr: "bronnyjames" };
const KEYS = Object.keys(ID).filter((k) => k.length >= 9).sort((a, b) => b.length - a.length);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const cache = new Map<string, number | null>();

/** Best-guess NBA person id for a slab's player text (handles multi-player cards by picking the first name found). */
export function nbaPersonId(player: string): number | null {
  const n = norm(player);
  if (cache.has(n)) return cache.get(n)!;
  let id: number | null = ID[ALIASES[n] ?? n] ?? null;
  if (id == null && n.length >= 9) {
    let best: { pos: number; key: string } | null = null;
    for (const k of KEYS) {
      const pos = n.indexOf(k);
      if (pos >= 0 && (!best || pos < best.pos)) best = { pos, key: k };
    }
    if (best) id = ID[best.key];
  }
  cache.set(n, id);
  return id;
}

export const nbaHeadshot = (personId: number) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${personId}.png`;

/** Photo URL for a slab player: NBA.com headshot, falling back to the ESPN headshot of a matched current player. */
export function slabPlayerPhoto(player: string, espnHeadshot?: string | null) {
  const id = nbaPersonId(player);
  return id ? nbaHeadshot(id) : espnHeadshot ?? null;
}
