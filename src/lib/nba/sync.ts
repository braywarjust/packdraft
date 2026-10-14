import { all, one, run, tx, Game } from "../db";
import { fpts, fromEspn, Line } from "../scoring";
import { addDays, etDate, fetchBoxScore, fetchRoster, fetchScoreboard, fetchSeasonAverages, fetchTeams, Averages } from "./espn";

const metaGet = (k: string) => one<{ value: string }>("SELECT value FROM meta WHERE key = ?", k)?.value;
const metaSet = (k: string, v: string) => run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", k, v);

function normPos(abbr?: string) {
  const a = (abbr ?? "F").toUpperCase();
  if (a.startsWith("C")) return "C";
  if (a.includes("G")) return "G";
  return "F";
}

/** Projected fantasy points per game, blending last season with this season as games pile up. */
function project(last: Averages | undefined, cur: Averages | undefined, scoring: string) {
  const v = (a: Averages) => fpts({ ...a } as Line, scoring);
  if (!last && !cur) return 0;
  if (!last) return v(cur!);
  if (!cur || cur.gp === 0) return v(last);
  const w = Math.min(1, cur.gp / 20);
  return v(cur) * w + v(last) * (1 - w);
}

export async function syncPlayers() {
  const teams = await fetchTeams();
  const rosters: { teamAbbr: string; athletes: Awaited<ReturnType<typeof fetchRoster>> }[] = [];
  for (let i = 0; i < teams.length; i += 6) {
    const chunk = teams.slice(i, i + 6);
    const res = await Promise.all(chunk.map(async (t) => ({ teamAbbr: t.abbreviation, athletes: await fetchRoster(t.id).catch(() => []) })));
    rosters.push(...res);
  }
  const sb = await fetchScoreboard(etDate());
  const season = sb.season || new Date().getFullYear();
  const [last, cur] = await Promise.all([fetchSeasonAverages(season - 1), fetchSeasonAverages(season).catch(() => new Map<string, Averages>())]);

  const rows = rosters.flatMap(({ teamAbbr, athletes }) =>
    athletes.map((a) => {
      const l = last.get(a.id), c = cur.get(a.id);
      const avg = c && c.gp >= 3 ? c : l ?? c;
      return {
        id: Number(a.id), name: a.displayName, pos: normPos(a.position?.abbreviation), team: teamAbbr, jersey: a.jersey ?? null,
        headshot: a.headshot?.href ?? `https://a.espncdn.com/i/headshots/nba/players/full/${a.id}.png`,
        injury: a.injuries?.[0]?.status ?? null, avg: avg ? JSON.stringify(avg) : null,
        proj: +project(l, c, "espn").toFixed(1), proj_dk: +project(l, c, "dk").toFixed(1),
      };
    }),
  );
  // Unknown rookies get a small placeholder projection so they still show up in drafts.
  for (const r of rows) if (!r.proj) { r.proj = 6; r.proj_dk = 5; }
  rows.sort((a, b) => b.proj - a.proj);
  const posCount: Record<string, number> = {};

  tx(() => {
    for (const t of teams)
      run("INSERT OR REPLACE INTO nba_teams (abbr, espn_id, name, short, color, alt, logo) VALUES (?, ?, ?, ?, ?, ?, ?)",
        t.abbreviation, t.id, t.displayName, t.shortDisplayName, t.color ?? null, t.alternateColor ?? null, t.logos?.[0]?.href ?? null);
    run("UPDATE players SET active = 0");
    rows.forEach((r, i) => {
      posCount[r.pos] = (posCount[r.pos] ?? 0) + 1;
      run(`INSERT INTO players (id, name, pos, team, jersey, headshot, injury, avg, proj, proj_dk, adp, pos_rank, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, pos = excluded.pos, team = excluded.team, jersey = excluded.jersey, headshot = excluded.headshot,
           injury = excluded.injury, avg = excluded.avg, proj = excluded.proj, proj_dk = excluded.proj_dk, adp = excluded.adp, pos_rank = excluded.pos_rank, active = 1`,
        r.id, r.name, r.pos, r.team, r.jersey, r.headshot, r.injury, r.avg, r.proj, r.proj_dk, i + 1, posCount[r.pos]);
    });
    metaSet("players_synced_at", String(Date.now()));
    metaSet("season", String(season));
  });
  return rows.length;
}

function upsertGame(g: Awaited<ReturnType<typeof fetchScoreboard>>["games"][number]) {
  run(`INSERT INTO games (id, date_et, start_ts, home, away, home_score, away_score, state, detail, period, clock, season_type, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET date_et = excluded.date_et, start_ts = excluded.start_ts, home_score = excluded.home_score, away_score = excluded.away_score,
       state = excluded.state, detail = excluded.detail, period = excluded.period, clock = excluded.clock, updated_at = excluded.updated_at`,
    g.id, g.dateEt, g.startTs, g.home, g.away, g.homeScore, g.awayScore, g.state, g.detail, g.period, g.clock, g.seasonType, Date.now());
}

/** Make sure the schedule for these dates is cached (refreshed every few hours). */
export async function ensureSchedule(from: string, to: string) {
  const today = etDate();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const key = `sched:${d}`;
    const last = Number(metaGet(key) ?? 0);
    const maxAge = d === today ? 60_000 : d < today ? 24 * 3600_000 * 365 : 6 * 3600_000;
    if (Date.now() - last < maxAge) continue;
    try {
      const { games } = await fetchScoreboard(d);
      tx(() => {
        for (const g of games) upsertGame(g);
        metaSet(key, String(Date.now()));
      });
    } catch (e) {
      console.warn("[packdraft] schedule fetch failed", d, (e as Error).message);
    }
  }
}

async function refreshBox(gameId: string, final: boolean) {
  const lines = await fetchBoxScore(gameId);
  const known = new Set(all<{ id: number }>("SELECT id FROM players").map((p) => p.id));
  tx(() => {
    for (const b of lines) {
      const pid = Number(b.athleteId);
      if (!known.has(pid)) {
        run("INSERT OR IGNORE INTO players (id, name, pos, team, headshot, proj, proj_dk, adp, pos_rank, active) VALUES (?, ?, 'F', ?, ?, 4, 4, 999, 99, 1)",
          pid, b.name, b.team, `https://a.espncdn.com/i/headshots/nba/players/full/${pid}.png`);
      }
      if (b.dnp) continue;
      run("INSERT INTO player_games (game_id, player_id, stats) VALUES (?, ?, ?) ON CONFLICT(game_id, player_id) DO UPDATE SET stats = excluded.stats",
        gameId, pid, JSON.stringify(fromEspn(b.stats)));
    }
    run("UPDATE games SET box_at = ? WHERE id = ?", final ? Date.now() : null, gameId);
  });
}

let liveRunning = false;
let lastLive = 0;
/** Refresh today's (and yesterday's) scores and box scores for games that are live or just finished. */
export async function refreshLive(force = false) {
  if (liveRunning || (!force && Date.now() - lastLive < 20_000)) return;
  liveRunning = true;
  lastLive = Date.now();
  try {
    const today = etDate();
    for (const d of [addDays(today, -1), today]) {
      if (d === today || force) run("DELETE FROM meta WHERE key = ?", `sched:${d}`);
      await ensureSchedule(d, d);
    }
    // Live games every refresh; finished games until we've captured their final box score (box_at set).
    const needBox = all<Game>("SELECT * FROM games WHERE date_et >= ? AND (state = 'in' OR (state = 'post' AND box_at IS NULL))", addDays(today, -1));
    for (const g of needBox) await refreshBox(g.id, g.state === "post").catch((e) => console.warn("[packdraft] box score failed", g.id, (e as Error).message));
  } finally {
    liveRunning = false;
  }
}

/** Box scores for any finished game we never captured (e.g. the app was closed overnight). */
export async function backfillFinals(from: string, to: string) {
  const missing = all<Game>("SELECT * FROM games WHERE date_et BETWEEN ? AND ? AND state = 'post' AND box_at IS NULL", from, to);
  for (const g of missing) await refreshBox(g.id, true).catch(() => {});
}

export async function maybeSyncPlayers() {
  const last = Number(metaGet("players_synced_at") ?? 0);
  if (Date.now() - last < 12 * 3600_000) return;
  try {
    await syncPlayers();
  } catch (e) {
    console.warn("[packdraft] player sync failed", (e as Error).message);
  }
}

export const gamesOn = (date: string) => all<Game>("SELECT * FROM games WHERE date_et = ? ORDER BY start_ts", date);
export const gamesBetween = (from: string, to: string) => all<Game>("SELECT * FROM games WHERE date_et BETWEEN ? AND ? ORDER BY start_ts", from, to);
export { metaGet, metaSet };
