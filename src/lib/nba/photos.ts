// NBA.com headshots for slab players (current or retired), keyed by NBA person id.
// nba-person-ids.json comes from the public nba_api static player list: normalized full name -> person id,
// with names shared by more than one player removed so a match is always unambiguous.
//
// Every season: the id list is refreshed from nba_api (so new rookies get NBA.com photos too; see refreshPhotoIds),
// and photo URLs carry the season year, so browsers drop last year's cached photo. NBA.com's "latest" headshots are
// re-shot each season, so a new season means new photos on every slab.
import ids from "./nba-person-ids.json";
import { all, one, run } from "../db";

const BUNDLED: Record<string, number> = ids as Record<string, number>;
const ALIASES: Record<string, string> = { akeemolajuwon: "hakeemolajuwon", alexandresarr: "alexsarr", bronnyjamesjr: "bronnyjames" };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

let fresh: Map<string, number> | null = null;
let version = "";
function load() {
  if (fresh) return;
  try {
    run("CREATE TABLE IF NOT EXISTS nba_person_ids (name TEXT PRIMARY KEY, person_id INTEGER NOT NULL)");
    fresh = new Map(all<{ name: string; person_id: number }>("SELECT name, person_id FROM nba_person_ids").map((r) => [r.name, r.person_id]));
    version = one<{ value: string }>("SELECT value FROM meta WHERE key = 'season'")?.value ?? "";
  } catch {
    fresh = new Map();
  }
}

/** NBA person id only when the slab's player is exactly one known player (multi-player cards never match). */
export function nbaPersonId(player: string): number | null {
  load();
  const n = norm(player);
  const k = ALIASES[n] ?? n;
  return fresh!.get(k) ?? BUNDLED[k] ?? null;
}

export const nbaHeadshot = (personId: number) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${personId}.png${version ? `?s=${version}` : ""}`;

/** Photo URL for a slab player, or null when there isn't a certain match. */
export function slabPlayerPhoto(player: string) {
  const id = nbaPersonId(player);
  return id ? nbaHeadshot(id) : null;
}

/** Re-download the NBA player id list (yearly, or right away when a new season starts). */
export async function refreshPhotoIds(force = false) {
  const last = Number(one<{ value: string }>("SELECT value FROM meta WHERE key = 'photo_ids_at'")?.value ?? 0);
  if (!force && Date.now() - last < 30 * 86400_000) return;
  const r = await fetch("https://raw.githubusercontent.com/swar/nba_api/master/src/nba_api/stats/library/data.py", { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`nba_api ${r.status}`);
  const text = await r.text();
  const seen = new Map<string, number | null>();
  for (const m of text.matchAll(/^\s*\[(\d+), "[^"]*", "[^"]*", "([^"]+)", (?:True|False)\],?$/gm)) {
    const k = norm(m[2]);
    seen.set(k, seen.has(k) ? null : Number(m[1]));
  }
  if (seen.size < 4000) throw new Error("nba_api player list looks incomplete");
  run("CREATE TABLE IF NOT EXISTS nba_person_ids (name TEXT PRIMARY KEY, person_id INTEGER NOT NULL)");
  run("DELETE FROM nba_person_ids");
  for (const [k, id] of seen) if (id) run("INSERT INTO nba_person_ids (name, person_id) VALUES (?, ?)", k, id);
  run("INSERT INTO meta (key, value) VALUES ('photo_ids_at', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", String(Date.now()));
  fresh = null;
}

/** Forget cached ids and the season stamp (after a refresh or a new season). */
export function resetPhotoCache() {
  fresh = null;
}
