// Season-accurate player photos for slabs.
// A slab's card year (e.g. 2019 Panini Prizm = the 2019-20 season) + the player's team that season (from ESPN)
// points at NBA.com's season headshot: cdn.nba.com/headshots/nba/{nbaTeamId}/{seasonStartYear}/260x190/{personId}.png.
// NBA.com only keeps season photos from 2015-16 on, so older cards fall back to the player's latest NBA.com photo.
import { all, one, run } from "../db";
import { nbaHeadshot, nbaPersonId } from "./photos";

const NBA_TEAM_ID: Record<string, number> = {
  ATL: 1610612737, BOS: 1610612738, BKN: 1610612751, CHA: 1610612766, CHI: 1610612741, CLE: 1610612739, DAL: 1610612742, DEN: 1610612743,
  DET: 1610612765, GS: 1610612744, HOU: 1610612745, IND: 1610612754, LAC: 1610612746, LAL: 1610612747, MEM: 1610612763, MIA: 1610612748,
  MIL: 1610612749, MIN: 1610612750, NO: 1610612740, NY: 1610612752, OKC: 1610612760, ORL: 1610612753, PHI: 1610612755, PHX: 1610612756,
  POR: 1610612757, SAC: 1610612758, SA: 1610612759, TOR: 1610612761, UTAH: 1610612762, WSH: 1610612764,
};
const FIRST_SEASON_PHOTOS = 2015;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const meta = (k: string) => one<{ value: string }>("SELECT value FROM meta WHERE key = ?", k)?.value;
const setMeta = (k: string, v: string) => run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v);

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0 PackDraft" } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
async function exists(url: string) {
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch {
    return false;
  }
}

/** ESPN athlete id for an exact, unique NBA name match (cached). */
async function espnAthleteId(player: string): Promise<string | null> {
  const key = `espnid:${norm(player)}`;
  const cached = meta(key);
  if (cached !== undefined) return cached || null;
  type R = { results?: { contents?: { displayName?: string; uid?: string }[] }[] };
  const d = await getJson<R>(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(player)}&limit=10&type=player`);
  if (!d) return null; // network trouble: retry later
  const hits = (d.results ?? []).flatMap((r) => r.contents ?? [])
    .filter((c) => c.uid?.includes("s:40~l:46~a:") && norm(c.displayName ?? "") === norm(player));
  const id = hits.length === 1 ? hits[0].uid!.split("a:")[1] : "";
  setMeta(key, id);
  return id || null;
}

/** Map of ESPN season end-year -> team abbreviation for an athlete (cached). */
async function teamHistory(espnId: string): Promise<Record<number, string> | null> {
  const key = `teams:${espnId}`;
  const cached = meta(key);
  if (cached) return JSON.parse(cached);
  type S = { categories?: { statistics?: { season?: { year?: number }; teamId?: string }[] }[] };
  const d = await getJson<S>(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/stats?region=us&lang=en&contentorigin=espn`);
  if (!d) return null;
  const abbrByEspn = new Map(all<{ espn_id: string; abbr: string }>("SELECT espn_id, abbr FROM nba_teams").map((t) => [t.espn_id, t.abbr]));
  const out: Record<number, string> = {};
  for (const s of d.categories?.[0]?.statistics ?? []) {
    const abbr = s.teamId ? abbrByEspn.get(s.teamId) : undefined;
    if (s.season?.year && abbr) out[s.season.year] = abbr;
  }
  setMeta(key, JSON.stringify(out));
  return out;
}

async function resolve(player: string, cardYear: number): Promise<{ url: string; label: string } | null> {
  const personId = nbaPersonId(player);
  if (!personId) return null;
  const latest = { url: nbaHeadshot(personId), label: "Latest photo" };
  if (!cardYear || cardYear < FIRST_SEASON_PHOTOS) return latest;
  const espnId = await espnAthleteId(player);
  if (!espnId) return latest;
  const teams = await teamHistory(espnId);
  if (!teams) return latest;
  // Card year Y is the Y-(Y+1) season (ESPN labels it Y+1). Rookie cards can predate a player's first season, so look one year ahead too.
  for (const start of [cardYear, cardYear + 1]) {
    const abbr = teams[start + 1];
    if (!abbr || start < FIRST_SEASON_PHOTOS) continue;
    const url = `https://cdn.nba.com/headshots/nba/${NBA_TEAM_ID[abbr]}/${start}/260x190/${personId}.png`;
    if (await exists(url)) return { url, label: `${start}-${String(start + 1).slice(2)} ${abbr}` };
  }
  return latest;
}

let running = false;
/** Resolve photos for slabs that haven't been checked yet (a batch per call). */
export async function resolveSlabPhotos(batch = 120) {
  if (running) return;
  running = true;
  try {
    const rows = all<{ id: number; player: string; year: number }>(
      "SELECT id, player, year FROM slabs WHERE photo_checked = 0 AND missing = 0 ORDER BY card_id IS NULL, year DESC, id LIMIT ?", batch);
    for (const r of rows) {
      const p = await resolve(r.player, r.year);
      run("UPDATE slabs SET photo_url = ?, photo_label = ?, photo_checked = 1 WHERE id = ?", p?.url ?? null, p?.label ?? null, r.id);
    }
  } finally {
    running = false;
  }
}

/** Resolve specific slabs right away (used when a pack is opened). */
export async function resolvePhotosFor(slabIds: number[]) {
  for (const id of slabIds) {
    const r = one<{ player: string; year: number; photo_checked: number }>("SELECT player, year, photo_checked FROM slabs WHERE id = ?", id);
    if (!r || r.photo_checked) continue;
    const p = await resolve(r.player, r.year);
    run("UPDATE slabs SET photo_url = ?, photo_label = ?, photo_checked = 1 WHERE id = ?", p?.url ?? null, p?.label ?? null, id);
  }
}
