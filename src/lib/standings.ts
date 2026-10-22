// Full standings, ESPN style (Update 3.1): games back, points against, streak, moves, playoff odds, clinch tags,
// and each team's season stat totals from the players it started.
import { all, League, Matchup, Team } from "./db";
import { leagueTeams, playoffInfo, standings } from "./league";
import { movesByTeam } from "./activity";
import { rng } from "./sim";
import { EMPTY, Line } from "./scoring";

/** x clinched playoffs, z clinched a bye, * clinched the 1 seed, e eliminated (ESPN's glossary). */
export type Clinch = "x" | "z" | "*" | "e" | null;
export type StandingRow = {
  team: Team; rank: number; w: number; l: number; t: number; pct: number; gb: number;
  pf: number; pa: number; streak: string; moves: number; playoffPct: number; clinch: Clinch;
};

const winPts = (t: { wins: number; ties: number }) => t.wins + t.ties / 2;

export function fullStandings(l: League): StandingRow[] {
  const table = standings(l.id);
  if (!table.length) return [];
  const info = playoffInfo(l);
  const games = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND kind IS NULL AND week <= ? ORDER BY week", l.id, l.season_weeks);
  const done = games.filter((m) => m.final);
  const left = games.filter((m) => !m.final);
  const remaining = new Map(table.map((t) => [t.id, left.filter((m) => m.home_team_id === t.id || m.away_team_id === t.id).length]));
  const moves = movesByTeam(l);
  const lead = table[0];

  // Streak: the run of identical results at the end of each team's regular season so far.
  const streak = (id: number) => {
    const res = done.filter((m) => m.home_team_id === id || m.away_team_id === id).map((m) => {
      const me = m.home_team_id === id ? m.home_score ?? 0 : m.away_score ?? 0;
      const opp = m.home_team_id === id ? m.away_score ?? 0 : m.home_score ?? 0;
      return me > opp ? "W" : me < opp ? "L" : "T";
    });
    if (!res.length) return "None";
    let n = 0;
    for (let i = res.length - 1; i >= 0 && res[i] === res.at(-1); i--) n++;
    return `${res.at(-1)}${n}`;
  };

  // Clinching is mathematical: a team has clinched a spot when too few teams can still catch it even if it loses
  // every remaining matchup and they win every one of theirs (ties in the standings count as catchable).
  const byes = info.teams > 1 ? (1 << Math.ceil(Math.log2(info.teams))) - info.teams : 0;
  const clinch = (t: Team): Clinch => {
    if (!info.teams) return null;
    const worst = winPts(t), best = worst + remaining.get(t.id)!;
    const canCatch = table.filter((o) => o.id !== t.id && winPts(o) + remaining.get(o.id)! >= worst).length;
    const surelyAhead = table.filter((o) => o.id !== t.id && winPts(o) > best).length;
    if (surelyAhead >= info.teams) return "e";
    if (canCatch === 0) return "*";
    if (byes && canCatch < byes) return "z";
    if (canCatch < info.teams) return "x";
    return null;
  };

  const odds = playoffOdds(l, table, left, info.teams);
  return table.map((t, i) => {
    const c = clinch(t);
    return {
      team: t, rank: i + 1, w: t.wins, l: t.losses, t: t.ties,
      pct: t.wins + t.losses + t.ties ? winPts(t) / (t.wins + t.losses + t.ties) : 0,
      gb: (lead.wins - t.wins + (t.losses - lead.losses)) / 2,
      pf: t.points_for, pa: t.points_against, streak: streak(t.id), moves: moves.get(t.id) ?? 0,
      playoffPct: c === "e" ? 0 : c ? 100 : odds.get(t.id) ?? 0, clinch: c,
    };
  });
}

/**
 * Chance of making the playoffs: plays out the rest of the regular season a few thousand times, each team scoring
 * around its average so far (spread like a real week), then seeds by record and points for. Seeded by the results
 * so far, so the numbers only move when a matchup finishes.
 */
function playoffOdds(l: League, table: Team[], left: Matchup[], spots: number) {
  const out = new Map<number, number>();
  if (!spots) return out;
  const played = (t: Team) => t.wins + t.losses + t.ties;
  const leagueAvg = table.reduce((s, t) => s + t.points_for, 0) / Math.max(1, table.reduce((s, t) => s + played(t), 0)) || 1;
  const mean = new Map(table.map((t) => [t.id, played(t) ? t.points_for / played(t) : leagueAvg]));
  const rand = rng(`odds:${l.id}:${table.map((t) => `${t.wins}-${t.losses}-${t.ties}`).join("|")}:${left.length}`);
  const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const RUNS = 2000;
  for (let r = 0; r < RUNS; r++) {
    const sim = new Map(table.map((t) => [t.id, { w: winPts(t), pf: t.points_for }]));
    for (const m of left) {
      const hs = mean.get(m.home_team_id)! * (1 + 0.15 * normal()), as = mean.get(m.away_team_id)! * (1 + 0.15 * normal());
      const h = sim.get(m.home_team_id)!, a = sim.get(m.away_team_id)!;
      h.pf += hs; a.pf += as;
      if (hs > as) h.w++; else if (as > hs) a.w++; else { h.w += 0.5; a.w += 0.5; }
    }
    [...sim.entries()].sort((x, y) => y[1].w - x[1].w || y[1].pf - x[1].pf).slice(0, spots)
      .forEach(([id]) => out.set(id, (out.get(id) ?? 0) + 1));
  }
  for (const t of table) out.set(t.id, Math.round(((out.get(t.id) ?? 0) / RUNS) * 1000) / 10);
  return out;
}

/** Season stat totals per team: every box score a player put up while in that team's starting lineup (real leagues). */
export function teamSeasonStats(l: League): Map<number, Line> {
  const out = new Map<number, Line>(leagueTeams(l.id).map((t) => [t.id, { ...EMPTY }]));
  if (l.mode === "sim" || !l.start_date) return out;
  const rows = all<{ team_id: number; stats: string }>(
    `SELECT ds.team_id, pg.stats FROM daily_slots ds
     JOIN teams t ON t.id = ds.team_id AND t.league_id = ?
     JOIN games g ON g.date_et = ds.date_et AND g.season_type IN (2, 3)
     JOIN player_games pg ON pg.game_id = g.id AND pg.player_id = ds.player_id
     WHERE ds.slot != 'BN' AND ds.date_et >= ?`, l.id, l.start_date);
  for (const r of rows) {
    const s = JSON.parse(r.stats) as Partial<Line>;
    const tot = out.get(r.team_id);
    if (!tot) continue;
    for (const k of Object.keys(EMPTY) as (keyof Line)[]) tot[k] += Number(s[k]) || 0;
  }
  return out;
}
