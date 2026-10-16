// NBA.com headshots for slab players (current or retired), keyed by NBA person id.
// nba-person-ids.json comes from the public nba_api static player list: normalized full name -> person id,
// with names shared by more than one player removed so a match is always unambiguous.
import ids from "./nba-person-ids.json";

const ID: Record<string, number> = ids as Record<string, number>;
const ALIASES: Record<string, string> = { akeemolajuwon: "hakeemolajuwon", alexandresarr: "alexsarr", bronnyjamesjr: "bronnyjames" };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** NBA person id only when the slab's player is exactly one known player (multi-player cards never match). */
export function nbaPersonId(player: string): number | null {
  const n = norm(player);
  return ID[ALIASES[n] ?? n] ?? null;
}

export const nbaHeadshot = (personId: number) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${personId}.png`;

/** Photo URL for a slab player, or null when there isn't a certain match. */
export function slabPlayerPhoto(player: string) {
  const id = nbaPersonId(player);
  return id ? nbaHeadshot(id) : null;
}
