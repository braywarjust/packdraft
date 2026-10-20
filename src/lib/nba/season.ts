// The NBA season calendar, kept in sync with ESPN so the app rolls from one season to the next on its own.
//
// ESPN names a season by the year it ends: 2026-27 is 2027. For the current season we keep its preseason start,
// regular-season opener and last day, the end of the NBA playoffs, and every regular-season game date (used to find
// the All-Star break when a league plans its weeks). Once the Finals are over we look for next season's dates, and
// as soon as ESPN publishes them, "the season" becomes next season: player sync, positions, slab photos and league
// rollovers all key off this.
import { one, run } from "../db";
import { addDays, etDate } from "./espn";

export type Season = {
  year: number; label: string;
  /** Preseason start (ESPN's season start): leagues roll over to the new season from this day. */
  start: string;
  regStart: string; regEnd: string;
  /** End of the NBA playoffs. */
  postEnd: string;
  /** Regular-season game dates. */
  dates: string[];
};

export const seasonLabel = (year: number) => `${year - 1}-${String(year).slice(2)}`;
const toEt = (iso?: string) => (iso ? etDate(Date.parse(iso)) : "");
const metaGet = (k: string) => one<{ value: string }>("SELECT value FROM meta WHERE key = ?", k)?.value;
const metaSet = (k: string, v: string) => run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v);

/** Best guess when ESPN hasn't been reached yet: seasons start in late October and the Finals end in June. */
function fallback(today = etDate()): Season {
  const y = Number(today.slice(0, 4));
  const year = Number(today.slice(5, 7)) >= 7 ? y + 1 : y;
  return { year, label: seasonLabel(year), start: `${year - 1}-10-01`, regStart: `${year - 1}-10-21`, regEnd: `${year}-04-12`, postEnd: `${year}-06-25`, dates: [] };
}

/** The current NBA season (or the next one, once its dates are out and this one's Finals are done). */
export function season(): Season {
  const raw = metaGet("season_info");
  if (raw) try { return JSON.parse(raw) as Season; } catch { /* fall through */ }
  return fallback();
}

export type Phase = "preseason" | "regular" | "postseason" | "offseason";
export function seasonPhase(s = season(), today = etDate()): Phase {
  if (today < s.regStart) return today >= s.start ? "preseason" : "offseason";
  if (today <= s.regEnd) return "regular";
  if (today <= s.postEnd) return "postseason";
  return "offseason";
}

const UA = { "User-Agent": "Mozilla/5.0 PackDraft" };
async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000), headers: UA });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
type CoreType = { startDate?: string; endDate?: string };
const core = (year: number, type: number) => json<CoreType>(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${year}/types/${type}`);

/** Load one season's calendar from ESPN, or null if ESPN doesn't have its schedule yet. */
async function loadSeason(year: number): Promise<Season | null> {
  const [reg, post] = await Promise.all([core(year, 2), core(year, 3)]);
  if (!reg?.startDate || !reg.endDate) return null;
  const regStart = toEt(reg.startDate), regEnd = toEt(reg.endDate);
  type Board = { leagues?: { season?: { year: number; startDate?: string }; calendar?: string[] }[] };
  const sb = await json<Board>(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${regStart.replaceAll("-", "")}&limit=1`);
  const lg = sb?.leagues?.[0];
  if (lg?.season?.year && lg.season.year !== year) return null;
  const dates = (lg?.calendar ?? []).map(toEt).filter((d) => d >= regStart && d <= regEnd);
  return {
    year, label: seasonLabel(year), start: toEt(lg?.season?.startDate) || addDays(regStart, -20), regStart, regEnd,
    postEnd: toEt(post?.endDate) || addDays(regEnd, 75), dates,
  };
}

/** Refresh the season calendar from ESPN (daily). Returns true when the season year changed. */
export async function syncSeason(force = false) {
  const last = Number(metaGet("season_synced_at") ?? 0);
  if (!force && Date.now() - last < 12 * 3600_000) return false;
  const today = etDate();
  const prev = metaGet("season_info") ? season() : null;
  type Board = { leagues?: { season?: { year: number } }[] };
  const sb = await json<Board>(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=1`);
  let year = sb?.leagues?.[0]?.season?.year ?? prev?.year ?? fallback(today).year;
  let s = await loadSeason(year);
  // Finals are over: move on to next season as soon as ESPN has its schedule.
  if (s && today > s.postEnd) s = (await loadSeason(year + 1)) ?? s;
  if (!s) {
    if (!prev) return false;
    s = prev;
  }
  year = s.year;
  metaSet("season_info", JSON.stringify(s));
  metaSet("season", String(year));
  metaSet("season_synced_at", String(Date.now()));
  return !!prev && prev.year !== year;
}
