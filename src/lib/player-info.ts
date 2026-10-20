// Everything the player inspector popup shows: bio, projections, last season's averages, recent real games,
// upcoming schedule, who has him in your league, and how many of his slabs are in the vault.
import { all, one, type Player } from "./db";
import { fpts, type Line } from "./scoring";
import { projFor } from "./league";
import { teamBrand } from "./branding";

type Avg = Partial<Line> & { gp?: number };

export function playerInfo(playerId: number, leagueId: number | null, userId: number) {
  const p = one<Player>("SELECT * FROM players WHERE id = ?", playerId);
  if (!p) return null;
  const league = leagueId ? one<{ id: number; name: string; scoring: string }>("SELECT id, name, scoring FROM leagues WHERE id = ?", leagueId) : null;
  const scoring = league?.scoring ?? "espn";
  const nba = one<{ name: string; color: string | null; alt: string | null }>("SELECT name, color, alt FROM nba_teams WHERE abbr = ?", p.team);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const avg: Avg | null = p.avg ? JSON.parse(p.avg) : null;
  const avgLine = avg ? { min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, ...avg } as Line : null;

  // Most recent real games (preseason included), newest first.
  const log = all<{ id: string; date_et: string; home: string; away: string; home_score: number; away_score: number; state: string; season_type: number; stats: string }>(
    `SELECT g.id, g.date_et, g.home, g.away, g.home_score, g.away_score, g.state, g.season_type, pg.stats
     FROM player_games pg JOIN games g ON g.id = pg.game_id WHERE pg.player_id = ? ORDER BY g.start_ts DESC LIMIT 10`, playerId,
  ).map((g) => {
    const s = JSON.parse(g.stats) as Line;
    const home = g.home === p.team;
    const us = home ? g.home_score : g.away_score, them = home ? g.away_score : g.home_score;
    return {
      id: g.id, date: g.date_et, opp: home ? g.away : g.home, home, preseason: g.season_type === 1,
      // A game only reads "Live" on its own day; older games stuck in progress in the feed show their last score.
      result: g.state === "in" && g.date_et === today ? "Live" : us + them > 0 ? `${us > them ? "W" : us < them ? "L" : "T"} ${us}-${them}` : "",
      line: s, fp: fpts(s, scoring),
    };
  });
  const played = log.filter((g) => g.line.min > 0);
  const recentAvg = played.length ? Math.round((played.reduce((s, g) => s + g.fp, 0) / played.length) * 10) / 10 : null;

  const upcoming = all<{ id: string; date_et: string; start_ts: number; home: string; away: string; season_type: number }>(
    "SELECT id, date_et, start_ts, home, away, season_type FROM games WHERE (home = ? OR away = ?) AND state = 'pre' ORDER BY start_ts LIMIT 6", p.team, p.team,
  ).map((g) => ({ id: g.id, date: g.date_et, start: g.start_ts, opp: g.home === p.team ? g.away : g.home, home: g.home === p.team, preseason: g.season_type === 1 }));

  const proj = projFor(p, scoring);
  const rank = (one<{ n: number }>(`SELECT COUNT(*) n FROM players WHERE active = 1 AND ${scoring === "dk" ? "proj_dk" : "proj"} > ?`, proj)?.n ?? 0) + 1;

  let owner: { teamId: number; brand: ReturnType<typeof teamBrand>; slot: string; mine: boolean } | null = null;
  if (league) {
    const r = one<{ id: number; name: string; color: string | null; alt_color: string | null; abbr: string | null; logo_url: string | null; user_id: number | null; slot: string }>(
      `SELECT t.id, t.name, t.color, t.alt_color, t.abbr, t.logo_url, t.user_id, r.slot FROM roster r JOIN teams t ON t.id = r.team_id WHERE r.league_id = ? AND r.player_id = ?`, league.id, playerId);
    if (r) owner = { teamId: r.id, brand: teamBrand(r), slot: r.slot, mine: r.user_id === userId };
  }

  const slabs = one<{ total: number; vault: number; mine: number; top: number | null }>(
    `SELECT COUNT(*) total, SUM(s.card_id IS NULL) vault, SUM(c.user_id = ? AND c.sold = 0) mine, MAX(COALESCE(s.mkt_value, s.est_value)) top
     FROM slabs s LEFT JOIN cards c ON c.id = s.card_id WHERE s.player_id = ? AND s.missing = 0`, userId, playerId);

  const myCount = one<{ n: number }>("SELECT COUNT(*) n FROM cards WHERE user_id = ? AND sold = 0 AND kind = 'slab' AND player_id = ?", userId, p.id)?.n ?? 0;
  const market = { mine: myCount };

  return {
    market,
    player: { id: p.id, name: p.name, pos: p.pos, team: p.team, teamName: nba?.name ?? p.team, color: `#${nba?.color ?? "1f2937"}`, jersey: p.jersey, headshot: p.headshot, injury: p.injury, adp: p.adp, posRank: p.pos_rank },
    league: league ? { id: league.id, name: league.name } : null,
    scoring,
    proj, rank,
    season: avgLine ? { line: avgLine, gp: avg?.gp ?? 0, fp: fpts(avgLine, scoring) } : null,
    recentAvg,
    log,
    upcoming,
    owner,
    slabs: { total: slabs?.total ?? 0, vault: slabs?.vault ?? 0, mine: slabs?.mine ?? 0, top: slabs?.top ?? null },
  };
}
export type PlayerInfo = NonNullable<ReturnType<typeof playerInfo>>;
