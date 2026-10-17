// PackDraft Sportsbook: bet Pack Points on real NBA games, pregame and live.
//
// There's no free odds feed, so the book prices its own lines from ESPN data we already sync:
//  - Team strength = points of each team's top-9 players by minutes (season averages), normalised so an
//    average team scores ~114. Home court is worth 2.5. Final margin ~ Normal(sd 12).
//  - Moneyline / spread / total come from that model. Spreads and totals are set at the fair number and
//    priced -110 each side; moneylines are priced from the win probability with ~4.5% margin.
//  - Player props (PTS, REB, AST, 3PM, PTS+REB+AST) are lined at his season average (x.5), -110 each side.
//  - Live: everything re-prices from the current score/stats and the time left (lines move as he scores),
//    and markets close with under a minute left.
// Bets settle when the game is final (box score captured). Lands exactly on a line = push (stake back;
// a pushed parlay leg drops out). Parlays multiply their legs' odds.
import { all, one, run, tx, Game, Player } from "./db";
import { Line } from "./scoring";
import { etDate, addDays } from "./nba/espn";

export const MIN_STAKE = 10;
export const MAX_STAKE = 2500;
export const MAX_PAYOUT = 50_000;
export const MAX_LEGS = 8;
const LEAGUE_AVG = 114;
const HOME_EDGE = 2.5;
const MARGIN_SD = 12;
const TOTAL_SD = 15;
const VIG = 1.045;
const STD = 1.91; // -110

export type Market = "ml" | "spread" | "total" | "prop";
export type Stat = "pts" | "reb" | "ast" | "tpm" | "pra";
export const STAT_LABEL: Record<Stat, string> = { pts: "Points", reb: "Rebounds", ast: "Assists", tpm: "3-Pointers", pra: "Pts + Reb + Ast" };

let ready = false;
function ensure() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, stake INTEGER NOT NULL, odds REAL NOT NULL, status TEXT NOT NULL DEFAULT 'open',
    payout INTEGER NOT NULL DEFAULT 0, live INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, settled_at INTEGER)`);
  run(`CREATE TABLE IF NOT EXISTS bet_legs (
    id INTEGER PRIMARY KEY, bet_id INTEGER NOT NULL, game_id TEXT NOT NULL, market TEXT NOT NULL, side TEXT NOT NULL,
    player_id INTEGER, stat TEXT, line REAL, odds REAL NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', result REAL)`);
  run("CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id, status)");
  run("CREATE INDEX IF NOT EXISTS idx_legs_bet ON bet_legs(bet_id)");
  ready = true;
}

// ---------- maths ----------

const erf = (x: number) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const cdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const half = (x: number) => Math.floor(x) + 0.5; // always a hook, so no pushes on props/totals pregame
const priced = (p: number) => Math.min(50, Math.max(1.02, Math.round((1 / (Math.min(0.985, Math.max(0.015, p)) * VIG)) * 100) / 100));

export function american(dec: number) {
  if (dec >= 2) return `+${Math.round((dec - 1) * 100)}`;
  return `${Math.round(-100 / (dec - 1))}`;
}

/** Fraction of regulation played (0..1), from ESPN period + clock ("5:37" or "23.2"). */
export function elapsed(g: Pick<Game, "state" | "period" | "clock">) {
  if (g.state === "post") return 1;
  if (g.state !== "in" || !g.period) return 0;
  const c = String(g.clock ?? "12:00");
  const left = c.includes(":") ? Number(c.split(":")[0]) * 60 + Number(c.split(":")[1]) : Number(c) || 0;
  if (g.period > 4) return 0.99;
  return Math.min(0.995, ((g.period - 1) * 720 + (720 - left)) / 2880);
}

// ---------- team & player expectations ----------

type Avg = { min?: number; pts?: number; reb?: number; ast?: number; tpm?: number };
const avgOf = (p: Player) => { try { return JSON.parse(p.avg ?? "{}") as Avg; } catch { return {}; } };

let strengthCache: { at: number; map: Map<string, number> } | null = null;
function teamStrength() {
  if (strengthCache && Date.now() - strengthCache.at < 10 * 60_000) return strengthCache.map;
  const byTeam = new Map<string, Avg[]>();
  for (const p of all<Player>("SELECT * FROM players WHERE active = 1")) {
    const a = avgOf(p);
    if (!a.pts) continue;
    byTeam.set(p.team, [...(byTeam.get(p.team) ?? []), a]);
  }
  // Points from each team's top 9 by minutes, normalised so the average team scores LEAGUE_AVG.
  const raw = new Map<string, number>();
  for (const [team, ps] of byTeam) {
    raw.set(team, [...ps].sort((a, b) => (b.min ?? 0) - (a.min ?? 0)).slice(0, 9).reduce((s, a) => s + (a.pts ?? 0), 0));
  }
  const mean = [...raw.values()].reduce((a, b) => a + b, 0) / Math.max(1, raw.size);
  // Top-9 sums swing far more than real scoring margins (rosters, injuries, preseason), so regress hard
  // toward average: real NBA teams sit within ~±8 points of each other.
  const map = new Map([...raw].map(([t, v]) => {
    const norm = (LEAGUE_AVG * v) / (mean || 1);
    return [t, LEAGUE_AVG + Math.max(-8, Math.min(8, (norm - LEAGUE_AVG) * 0.25))];
  }));
  strengthCache = { at: Date.now(), map };
  return map;
}

const statOf = (l: Line | null, s: Stat) => !l ? 0 : s === "pra" ? l.pts + l.reb + l.ast : s === "tpm" ? l.tpm : l[s];
const avgStat = (a: Avg, s: Stat) => s === "pra" ? (a.pts ?? 0) + (a.reb ?? 0) + (a.ast ?? 0) : (a[s] ?? 0);

// ---------- the board ----------

export type Offer = { key: string; market: Market; side: string; line: number | null; odds: number; label: string; playerId?: number; stat?: Stat };
export type NbaTeam = { abbr: string; name: string; short: string; color: string; alt: string };
let teamCache: Map<string, NbaTeam> | null = null;
export function nbaTeam(abbr: string): NbaTeam {
  if (!teamCache) {
    teamCache = new Map(all<{ abbr: string; name: string; short: string; color: string | null; alt: string | null }>("SELECT abbr, name, short, color, alt FROM nba_teams")
      .map((t) => [t.abbr, { abbr: t.abbr, name: t.name, short: t.short, color: `#${t.color || "334155"}`, alt: `#${t.alt || "94a3b8"}` }]));
  }
  return teamCache.get(abbr) ?? { abbr, name: abbr, short: abbr, color: "#334155", alt: "#94a3b8" };
}

export type GameBoard = {
  id: string; date: string; home: string; away: string; start: number; state: string; detail: string; homeScore: number; awayScore: number;
  open: boolean; live: boolean; winProbHome: number;
  /** Real NBA branding for both sides (colours as #hex). */
  teams: Record<"home" | "away", NbaTeam>;
  ml: Offer[]; spread: Offer[]; total: Offer[];
  props: { player: { id: number; name: string; team: string; pos: string; headshot: string | null }; now: Partial<Record<Stat, number>>; offers: Offer[] }[];
};

const isOpen = (g: Game) => g.state === "pre" ? g.start_ts > Date.now() : g.state === "in" && !(g.period >= 4 && elapsed(g) > 0.98);

export function gameBoard(g: Game, withProps = true): GameBoard {
  const str = teamStrength();
  const hExp = str.get(g.home) ?? LEAGUE_AVG, aExp = str.get(g.away) ?? LEAGUE_AVG;
  const f = elapsed(g);
  const rest = 1 - f;
  const margin = (g.home_score - g.away_score) + (hExp - aExp + HOME_EDGE) * rest; // expected final home margin
  const sd = Math.max(0.6, MARGIN_SD * Math.sqrt(rest));
  const pHome = cdf(margin / sd);
  const total = g.home_score + g.away_score + (hExp + aExp) * rest;
  const spreadHome = -half(margin); // home line on a hook, e.g. -4.5
  const totalLine = half(total);
  const k = (m: string, side: string, line: number | null, extra = "") => `${g.id}|${m}|${side}|${line ?? ""}|${extra}`;
  const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const board: GameBoard = {
    id: g.id, date: g.date_et, home: g.home, away: g.away, start: g.start_ts, state: g.state, detail: g.detail ?? "",
    homeScore: g.home_score, awayScore: g.away_score, open: isOpen(g), live: g.state === "in", winProbHome: Math.round(pHome * 1000) / 1000,
    teams: { home: nbaTeam(g.home), away: nbaTeam(g.away) },
    ml: [
      { key: k("ml", "away", null), market: "ml", side: "away", line: null, odds: priced(1 - pHome), label: `${g.away} to win` },
      { key: k("ml", "home", null), market: "ml", side: "home", line: null, odds: priced(pHome), label: `${g.home} to win` },
    ],
    spread: [
      { key: k("spread", "away", -spreadHome), market: "spread", side: "away", line: -spreadHome, odds: STD, label: `${g.away} ${fmt(-spreadHome)}` },
      { key: k("spread", "home", spreadHome), market: "spread", side: "home", line: spreadHome, odds: STD, label: `${g.home} ${fmt(spreadHome)}` },
    ],
    total: [
      { key: k("total", "over", totalLine), market: "total", side: "over", line: totalLine, odds: STD, label: `Over ${totalLine} (${g.away} @ ${g.home})` },
      { key: k("total", "under", totalLine), market: "total", side: "under", line: totalLine, odds: STD, label: `Under ${totalLine} (${g.away} @ ${g.home})` },
    ],
    props: [],
  };
  if (!withProps) return board;
  const players = all<Player>("SELECT * FROM players WHERE active = 1 AND (team = ? OR team = ?)", g.home, g.away)
    .map((p) => ({ p, a: avgOf(p) })).filter((x) => (x.a.min ?? 0) >= 18 && !/^out/i.test(x.p.injury ?? ""))
    .sort((x, y) => (y.a.pts ?? 0) - (x.a.pts ?? 0)).slice(0, 12);
  for (const { p, a } of players) {
    const row = one<{ stats: string }>("SELECT stats FROM player_games WHERE game_id = ? AND player_id = ?", g.id, p.id);
    const line = row ? (JSON.parse(row.stats) as Line) : null;
    // Once a game is on, only players who've actually checked in get props (no free unders on DNPs).
    if (g.state === "in" && !line?.min) continue;
    const now: Partial<Record<Stat, number>> = {};
    const offers: Offer[] = [];
    for (const s of ["pts", "reb", "ast", "tpm", "pra"] as Stat[]) {
      const exp = avgStat(a, s);
      if (exp < (s === "tpm" ? 0.8 : 2)) continue;
      const cur = statOf(line, s);
      now[s] = cur;
      const ln = half(cur + exp * rest);
      for (const side of ["over", "under"]) {
        offers.push({ key: k("prop", side, ln, `${p.id}:${s}`), market: "prop", side, line: ln, odds: STD, playerId: p.id, stat: s,
          label: `${p.name} ${side === "over" ? "Over" : "Under"} ${ln} ${STAT_LABEL[s]}` });
      }
    }
    board.props.push({ player: { id: p.id, name: p.name, team: p.team, pos: p.pos, headshot: p.headshot }, now, offers });
  }
  return board;
}

/** Today's and tomorrow's games, live ones first. */
export function boardGames() {
  const today = etDate();
  return all<Game>("SELECT * FROM games WHERE date_et BETWEEN ? AND ? AND state != 'post' ORDER BY state = 'in' DESC, start_ts", today, addDays(today, 1));
}

function findOffer(key: string) {
  const [gameId] = key.split("|");
  const g = one<Game>("SELECT * FROM games WHERE id = ?", gameId);
  if (!g) throw new Error("Game not found");
  const b = gameBoard(g, key.includes("|prop|"));
  const all_ = [...b.ml, ...b.spread, ...b.total, ...b.props.flatMap((x) => x.offers)];
  return { g, b, offer: all_.find((o) => o.key === key) ?? null, offers: all_ };
}

// ---------- placing ----------

/**
 * Place a single or a parlay. `picks` are offer keys with the odds the user saw; if any line or price moved,
 * nothing is placed and the fresh offers come back so the slip can update.
 */
export function placeBet(userId: number, picks: { key: string; odds: number }[], stake: number) {
  ensure();
  if (!picks.length) throw new Error("Add a pick to your slip");
  if (picks.length > MAX_LEGS) throw new Error(`Parlays max out at ${MAX_LEGS} legs`);
  stake = Math.floor(stake);
  if (!(stake >= MIN_STAKE)) throw new Error(`Minimum bet is ${MIN_STAKE} Pack Points`);
  if (stake > MAX_STAKE) throw new Error(`Maximum bet is ${MAX_STAKE.toLocaleString()} Pack Points`);
  const legs = picks.map((p) => {
    const { g, b, offer } = findOffer(p.key);
    if (!b.open) throw new Error(`${g.away} @ ${g.home} is closed for betting`);
    if (!offer) throw new Error("A line moved. Your slip has been refreshed.");
    if (Math.abs(offer.odds - p.odds) > 0.001) throw new Error(`Odds changed on ${offer.label}. Your slip has been refreshed.`);
    return { g, offer };
  });
  // No contradictory legs on the same market (e.g. both sides, or two lines of one prop).
  const seen = new Set<string>();
  for (const { g, offer } of legs) {
    const m = `${g.id}|${offer.market}|${offer.playerId ?? ""}|${offer.stat ?? ""}`;
    if (seen.has(m)) throw new Error("A parlay can only have one pick per market");
    seen.add(m);
  }
  const odds = Math.round(legs.reduce((x, l) => x * l.offer.odds, 1) * 100) / 100;
  if (stake * odds > MAX_PAYOUT) throw new Error(`Max payout is ${MAX_PAYOUT.toLocaleString()} Pack Points. Lower your stake.`);
  return tx(() => {
    const u = one<{ coins: number }>("SELECT coins FROM users WHERE id = ?", userId)!;
    if (u.coins < stake) throw new Error("Not enough Pack Points");
    run("UPDATE users SET coins = coins - ? WHERE id = ?", stake, userId);
    const r = run("INSERT INTO bets (user_id, stake, odds, live, created_at) VALUES (?, ?, ?, ?, ?)",
      userId, stake, odds, legs.some((l) => l.g.state === "in") ? 1 : 0, Date.now());
    const betId = Number(r.lastInsertRowid);
    for (const { g, offer } of legs) {
      run("INSERT INTO bet_legs (bet_id, game_id, market, side, player_id, stat, line, odds, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        betId, g.id, offer.market, offer.side, offer.playerId ?? null, offer.stat ?? null, offer.line, offer.odds, offer.label);
    }
    return { id: betId, odds, toWin: Math.floor(stake * odds) };
  });
}

// ---------- grading & settling ----------

type Leg = { id: number; bet_id: number; game_id: string; market: Market; side: string; player_id: number | null; stat: Stat | null; line: number | null; odds: number; label: string; status: string; result: number | null };
export type Bet = { id: number; user_id: number; stake: number; odds: number; status: string; payout: number; live: number; created_at: number; settled_at: number | null };

/** Current value a leg is graded on (live progress while the game is on). */
function legValue(leg: Leg, g: Game) {
  if (leg.market === "prop") {
    const row = one<{ stats: string }>("SELECT stats FROM player_games WHERE game_id = ? AND player_id = ?", g.id, leg.player_id);
    return statOf(row ? (JSON.parse(row.stats) as Line) : null, leg.stat!);
  }
  if (leg.market === "total") return g.home_score + g.away_score;
  return g.home_score - g.away_score; // home margin for ml / spread
}

function grade(leg: Leg, v: number): "won" | "lost" | "push" {
  const cmp = (a: number, b: number) => (a > b ? "won" : a < b ? "lost" : "push") as "won" | "lost" | "push";
  switch (leg.market) {
    case "prop":
    case "total": return leg.side === "over" ? cmp(v, leg.line!) : cmp(leg.line!, v);
    case "ml": return leg.side === "home" ? cmp(v, 0) : cmp(0, v);
    case "spread": return leg.side === "home" ? cmp(v + leg.line!, 0) : cmp(0, v - leg.line!);
  }
}

/** Grade legs on finished games and pay out finished bets. Safe to call often. */
export function settleBets() {
  ensure();
  const open = all<Leg & { g_state: string; g_box: number | null }>(
    `SELECT l.*, g.state g_state, g.box_at g_box FROM bet_legs l JOIN games g ON g.id = l.game_id WHERE l.status = 'open'`);
  for (const leg of open) {
    if (leg.g_state !== "post" || !leg.g_box) continue;
    const g = one<Game>("SELECT * FROM games WHERE id = ?", leg.game_id)!;
    const v = legValue(leg, g);
    run("UPDATE bet_legs SET status = ?, result = ? WHERE id = ?", grade(leg, v), v, leg.id);
  }
  for (const b of all<Bet>("SELECT * FROM bets WHERE status = 'open'")) {
    const legs = all<Leg>("SELECT * FROM bet_legs WHERE bet_id = ?", b.id);
    let status: string | null = null, payout = 0;
    if (legs.some((l) => l.status === "lost")) status = "lost";
    else if (legs.every((l) => l.status !== "open")) {
      const live = legs.filter((l) => l.status === "won");
      if (!live.length) { status = "push"; payout = b.stake; }
      else { status = "won"; payout = Math.min(MAX_PAYOUT, Math.floor(b.stake * live.reduce((x, l) => x * l.odds, 1))); }
    }
    if (!status) continue;
    tx(() => {
      const r = run("UPDATE bets SET status = ?, payout = ?, settled_at = ? WHERE id = ? AND status = 'open'", status, payout, Date.now(), b.id);
      if (Number(r.changes) > 0 && payout > 0) run("UPDATE users SET coins = coins + ? WHERE id = ?", payout, b.user_id);
    });
  }
}

/** How a leg looks mid-game: overs only "win" once cleared, unders only "lose" once blown; sides show who's ahead. */
function liveTrend(l: Leg, now: number) {
  const g = grade(l, now);
  if (l.market === "prop" || l.market === "total") return l.side === "over" ? (g === "won" ? "won" : null) : (g === "lost" ? "lost" : null);
  return g === "push" ? null : g;
}

/** A user's bets with live progress for each leg. */
export function myBets(userId: number) {
  ensure();
  const bets = all<Bet>("SELECT * FROM bets WHERE user_id = ? ORDER BY status = 'open' DESC, id DESC LIMIT 60", userId);
  return bets.map((b) => ({
    ...b,
    legs: all<Leg>("SELECT * FROM bet_legs WHERE bet_id = ?", b.id).map((l) => {
      const g = one<Game>("SELECT * FROM games WHERE id = ?", l.game_id);
      const now = g && g.state !== "pre" ? legValue(l, g) : null;
      return {
        id: l.id, label: l.label, odds: l.odds, status: l.status, market: l.market, side: l.side, line: l.line,
        now: l.status === "open" ? now : l.result,
        winning: l.status === "open" && now != null && g?.state === "in" ? liveTrend(l, now) : null,
        game: g ? { matchup: `${g.away} @ ${g.home}`, away: g.away, home: g.home, state: g.state, detail: g.detail ?? "", score: `${g.away} ${g.away_score} – ${g.home} ${g.home_score}` } : null,
      };
    }),
  }));
}
