import { all, one, run, tx, League, Team, Player, Matchup, Game } from "./db";
import { leagueSeed, rng, simSchedule, gameProgress, simGame, partial, simClock } from "./sim";
import { STARTERS, ROSTER_MAX, eligible, fpts, statLine, Line, slotLabel, posLabel } from "./scoring";
import { addDays, etDate, weekday, dayLabel } from "./nba/espn";
import { season as nbaSeason, seasonLabel } from "./nba/season";
import { PACK_BY_ID } from "./packs";
import { creditGame, weekRate } from "./economy";
import { cardBuff, consumeEquip, ensureBoosts, slabbedFpts, teamBoosts } from "./boost";

export { STARTERS, ROSTER_MAX, eligible };
/** A player's fantasy positions ("PG,SG"), falling back to his G/F/C. */
export const fpos = (p: { pos: string; elig?: string | null }) => p.elig || p.pos;
export const ROUNDS = ROSTER_MAX;

export const getLeague = (id: number) => one<League>("SELECT * FROM leagues WHERE id = ?", id);
export const leagueTeams = (leagueId: number) => all<Team>("SELECT * FROM teams WHERE league_id = ? ORDER BY id", leagueId);
export const userTeam = (leagueId: number, userId: number) =>
  one<Team>("SELECT * FROM teams WHERE league_id = ? AND user_id = ?", leagueId, userId);

export type RosterPlayer = Player & { slot: string };
export function roster(teamId: number) {
  return all<RosterPlayer>("SELECT p.*, r.slot FROM roster r JOIN players p ON p.id = r.player_id WHERE r.team_id = ? ORDER BY p.adp", teamId);
}

export function postSystem(leagueId: number, body: string) {
  run("INSERT INTO messages (league_id, user_id, kind, body, created_at) VALUES (?, NULL, 'system', ?, ?)", leagueId, body, Date.now());
}
/** Give a manager a League Pack: it opens in this league, from this league's pool. */
export function awardPack(userId: number, packType: string, source: string, leagueId: number | null) {
  run("INSERT INTO user_packs (user_id, pack_type, source, league_id, created_at) VALUES (?, ?, ?, ?, ?)", userId, packType, source, leagueId, Date.now());
}

export const projFor = (p: { proj: number; proj_dk: number }, scoring: string) => (scoring === "dk" ? p.proj_dk : p.proj);
const isOut = (p: { injury: string | null }) => !!p.injury && /^out/i.test(p.injury);

// ---------- Weeks ----------

/**
 * Real leagues: week 1 runs from start_date to the first Sunday at least 4 days later, then Monday–Sunday.
 * Weeks listed in long_weeks run two Monday–Sunday weeks (like ESPN's All-Star break matchup).
 */
export function weekRange(l: League, week: number): [string, string] {
  const long = new Set<number>(l.long_weeks ? JSON.parse(l.long_weeks) : []);
  let s = l.start_date ?? etDate();
  let e = addDays(s, 4);
  while (weekday(e) !== 0) e = addDays(e, 1);
  if (long.has(1)) e = addDays(e, 7);
  for (let w = 2; w <= week; w++) {
    s = addDays(e, 1);
    e = addDays(s, long.has(w) ? 13 : 6);
  }
  return [s, e];
}

/** Sim leagues: how far through the simulated week we are (0..1). */
export function weekProgress(l: League) {
  if (l.mode !== "sim" || !l.week_started_at) return 0;
  return Math.min(1, (Date.now() - l.week_started_at) / (l.sim_minutes * 60_000));
}

// ---------- Per-player games ----------

/** `final`: the game really is over (ESPN says so, or the sim finished it), so it can pay out and use up slabs. */
export type PGame = {
  key: string; state: "pre" | "in" | "post"; final: boolean; label: string; clock: string; line: Line | null; order: number; date?: string;
  /** Real games: the opponent ("@NO" away, "GS" at home) and, once it's over, the result from his team's side ("W 112-104"). */
  opp?: string; result?: string;
};

/** A real game still not final this long after tip-off is treated as over. */
const STALE_GAME_MS = 6 * 3600_000;

function realGames(p: { id: number; team: string }, from: string, to: string): PGame[] {
  const games = all<Game & { stats: string | null }>(
    `SELECT g.*, pg.stats FROM games g LEFT JOIN player_games pg ON pg.game_id = g.id AND pg.player_id = ?
     WHERE g.date_et BETWEEN ? AND ? AND (g.home = ? OR g.away = ?) AND g.season_type IN (2, 3) ORDER BY g.start_ts`,
    p.id, from, to, p.team, p.team);
  return games.map((g) => {
    const home = g.home === p.team;
    const started = g.state !== "pre" || g.start_ts <= Date.now();
    // ESPN never moved it on (postponed, or the feed missed the final): long after tip-off it isn't live any more.
    const stale = g.state !== "post" && Date.now() - g.start_ts > STALE_GAME_MS;
    return {
      key: g.date_et, date: g.date_et, order: g.start_ts,
      state: stale ? "post" : g.state === "pre" && started ? "in" : (g.state as PGame["state"]),
      final: g.state === "post",
      opp: home ? g.away : `@${g.home}`,
      result: g.state === "post" && g.home_score + g.away_score > 0
        ? (() => { const us = home ? g.home_score : g.away_score, them = home ? g.away_score : g.home_score; return `${us > them ? "W" : us < them ? "L" : "T"} ${us}-${them}`; })()
        : undefined,
      label: `${home ? "vs" : "@"} ${home ? g.away : g.home} · ${dayLabel(g.date_et)}`,
      clock: g.state === "pre" ? new Date(g.start_ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : g.detail ?? "",
      line: g.stats ? (JSON.parse(g.stats) as Line) : null,
    };
  });
}

function simGames(p: Player, l: League, week: number): PGame[] {
  const seed = leagueSeed(l.id, week);
  const progress = week < l.current_week ? 1 : week === l.current_week ? weekProgress(l) : 0;
  return simSchedule(p.team, seed).map((gm) => {
    const g = gameProgress(gm.start, progress);
    return {
      key: `sim:W${week}:G${gm.i}`, order: gm.start,
      state: g <= 0 ? "pre" : g >= 1 ? "post" : "in", final: g >= 1,
      label: `Game ${gm.i + 1}`, clock: simClock(g),
      line: g > 0 ? partial(simGame(p, `${seed}:${gm.i}`), g, `${p.id}:${seed}:${gm.i}`) : null,
    };
  });
}

export function playerGames(l: League, p: Player, week: number): PGame[] {
  if (l.mode === "sim") return simGames(p, l, week);
  const [from, to] = weekRange(l, week);
  return realGames(p, from, to);
}

/** A player is locked when a game of his is under way or done for today (real) or currently being played (sim). */
export function isLocked(l: League, p: Player) {
  if (l.mode === "sim") return playerGames(l, p, l.current_week).some((g) => g.state === "in");
  const today = etDate();
  return realGames(p, today, today).some((g) => g.state !== "pre");
}

// ---------- Lineups ----------

export function autoLineup(l: League, teamId: number) {
  const players = roster(teamId);
  const today = etDate();
  const locked = new Set(players.filter((p) => isLocked(l, p)).map((p) => p.id));
  // Healthy players with a game today first, then the best of the rest (the lineup carries forward).
  const value = (p: RosterPlayer) => {
    let v = projFor(p, l.scoring);
    if (isOut(p)) return v - 2000;
    if (l.mode !== "sim" && realGames(p, today, today).length) v += 1000;
    return v;
  };
  const assign = new Map<number, string>();
  const taken = new Set<string>();
  for (const p of players) if (locked.has(p.id)) { assign.set(p.id, p.slot); if (p.slot !== "BN") taken.add(p.slot); }
  const pool = players.filter((p) => !locked.has(p.id)).sort((a, b) => value(b) - value(a));
  // Fill the most restrictive slots first so UTIL takes whoever's left.
  for (const slot of [...STARTERS].sort((a, b) => (slotLabel(a) === "UTIL" ? 1 : 0) - (slotLabel(b) === "UTIL" ? 1 : 0))) {
    if (taken.has(slot)) continue;
    const pick = pool.find((p) => !assign.has(p.id) && eligible(slot, fpos(p)) && !isOut(p));
    if (pick) { assign.set(pick.id, slot); taken.add(slot); }
  }
  for (const p of players) if (!assign.has(p.id)) assign.set(p.id, "BN");
  for (const [pid, slot] of assign) run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", slot, teamId, pid);
}

export function moveToSlot(l: League, teamId: number, playerId: number, slot: string) {
  const players = roster(teamId);
  const p = players.find((x) => x.id === playerId);
  if (!p) throw new Error("Player not on roster");
  if (!eligible(slot, fpos(p))) throw new Error(`${p.name} (${posLabel(fpos(p))}) can't play ${slotLabel(slot)}`);
  if (isLocked(l, p)) throw new Error(`${p.name} is locked (his game has started)`);
  if (slot !== "BN") {
    const occupant = players.find((x) => x.slot === slot);
    if (occupant) {
      if (isLocked(l, occupant)) throw new Error(`${occupant.name} is locked (his game has started)`);
      const back = eligible(p.slot, fpos(occupant)) ? p.slot : "BN";
      run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", back, teamId, occupant.id);
    }
  }
  run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", slot, teamId, playerId);
}

// ---------- Slab boosts ----------

/** The game a slab equipped right now would apply to: his next game this week that hasn't tipped off. */
/** Nothing can be equipped while he's in a game that's under way. */
export function boostableGame(l: League, p: Player) {
  const games = playerGames(l, p, l.current_week);
  if (games.some((g) => g.state === "in")) return null;
  return games.find((g) => g.state === "pre") ?? null;
}
export const playingNow = (l: League, p: Player) => playerGames(l, p, l.current_week).some((g) => g.state === "in");

/** Equip one of the manager's slabs of this player on his next game. One slab per player per game; one game per slab. */
export function setBoost(l: League, teamId: number, userId: number, playerId: number, cardId: number) {
  ensureBoosts();
  if (l.draft_status !== "done" || l.champion_team_id) throw new Error("Slabs can be equipped once the season is under way");
  const p = roster(teamId).find((x) => x.id === playerId);
  if (!p) throw new Error("He's not on your roster");
  if (playingNow(l, p)) throw new Error(`${p.name} is playing right now. Slabs can't be equipped during a game`);
  const g = boostableGame(l, p);
  if (!g) throw new Error(`${p.name} has no games left this week`);
  const { mult, boost } = cardBuff(cardId, userId, playerId);
  const elsewhere = one<{ team_id: number; day_key: string; player_id: number }>(
    "SELECT team_id, day_key, player_id FROM slab_equips WHERE card_id = ? AND consumed_at IS NULL", cardId);
  if (elsewhere && !(elsewhere.team_id === teamId && elsewhere.day_key === g.key && elsewhere.player_id === playerId))
    throw new Error("That slab is already equipped for another game. Unequip it there first");
  run(`INSERT INTO slab_equips (league_id, team_id, user_id, day_key, player_id, card_id, mult, boost_pts, boost_reb, boost_ast, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (team_id, day_key, player_id) DO UPDATE SET card_id = excluded.card_id, mult = excluded.mult, boost_pts = excluded.boost_pts,
       boost_reb = excluded.boost_reb, boost_ast = excluded.boost_ast, created_at = excluded.created_at`,
    l.id, teamId, userId, g.key, playerId, cardId, mult, boost.pts, boost.reb, boost.ast, Date.now());
  return { player: p.name, mult, boost, own: true };
}

/** Unequip a player's slab from any of his games that haven't started; the slab goes back to the collection. */
export function clearBoost(l: League, teamId: number, playerId: number) {
  ensureBoosts();
  const p = one<Player>("SELECT * FROM players WHERE id = ?", playerId);
  if (!p) return;
  const pre = new Set(playerGames(l, p, l.current_week).filter((g) => g.state === "pre").map((g) => g.key));
  for (const r of all<{ day_key: string }>("SELECT day_key FROM slab_equips WHERE team_id = ? AND player_id = ? AND consumed_at IS NULL", teamId, playerId))
    if (pre.has(r.day_key)) run("DELETE FROM slab_equips WHERE team_id = ? AND player_id = ? AND day_key = ?", teamId, playerId, r.day_key);
}

/** Use up equipped slabs whose game is over (it counted, or he sat; either way the slab is spent). */
export function consumeEquips(l: League) {
  ensureBoosts();
  const open = all<{ card_id: number; player_id: number; day_key: string }>("SELECT card_id, player_id, day_key FROM slab_equips WHERE league_id = ? AND consumed_at IS NULL", l.id);
  for (const e of open) {
    let over = false;
    if (l.mode === "sim") {
      const wk = Number(/^sim:W(\d+):/.exec(e.day_key)?.[1] ?? 0);
      if (wk && wk < l.current_week) over = true;
      else {
        const p = one<Player>("SELECT * FROM players WHERE id = ?", e.player_id);
        over = !!p && playerGames(l, p, l.current_week).some((g) => g.key === e.day_key && g.state === "post");
      }
    } else {
      const p = one<{ team: string }>("SELECT team FROM players WHERE id = ?", e.player_id);
      over = !!p && !!one("SELECT 1 FROM games WHERE date_et = ? AND (home = ? OR away = ?) AND state = 'post'", e.day_key, p.team, p.team);
      // A day that's long gone with no finished game (postponed, traded away) also ends it.
      if (!over && e.day_key < addDays(etDate(), -2)) over = true;
    }
    if (over) consumeEquip(e.card_id);
  }
}

// ---------- Scoring ----------

export type LivePlayer = {
  id: number; name: string; pos: string; team: string; slot: string; headshot: string | null; injury: string | null;
  pts: number; proj: number; played: number; left: number; total: number; locked: boolean;
  now: { label: string; clock: string; state: string; line: string; pts: number } | null;
  /** Slab equipped on his current/next game this week (live), if any: its multiplier (1 = none) and stat boost. */
  boost: { mult: number; pts: number; reb: number; ast: number; own: boolean; cardId: number; dayKey: string; state: string } | null;
};

/**
 * Score a team's week. Each player-game uses the slot he was in when that game started
 * (frozen into daily_slots), so mid-week lineup changes and drops are handled correctly.
 *
 * Matchup scores are fantasy points, with any equipped slab applied: its stat boost lands on his box score when the game
 * goes final, then its multiplier applies (boost.ts slabbedFpts). When a started player's game goes final, the manager is paid
 * fantasy points × PP_PER_POINT Pack Points (once; see economy.ts).
 */
export function teamWeek(l: League, teamId: number, week: number) {
  const players = roster(teamId);
  const active = week === l.current_week && l.draft_status === "done" && !l.champion_team_id;
  const rate = weekRate(l.id, week);
  const owner = one<{ user_id: number | null }>("SELECT user_id FROM teams WHERE id = ?", teamId)?.user_id ?? null;
  const boosts = teamBoosts(teamId);
  const gamePts = (playerId: number, g: PGame) => slabbedFpts(g.line!, l.scoring, boosts.get(`${playerId}|${g.key}`), g.final);
  const pay = (playerId: number, key: string, raw: number) => {
    if (active && owner) creditGame({ leagueId: l.id, week, teamId, userId: owner, playerId, gameKey: key, fpts: raw, rate });
  };
  const frozen = new Map(
    all<{ date_et: string; player_id: number; slot: string }>("SELECT * FROM daily_slots WHERE team_id = ?", teamId).map((r) => [`${r.player_id}|${r.date_et}`, r.slot]),
  );
  const rows: LivePlayer[] = [];
  let remain = 0, variance = 0, projected = 0;
  for (const p of players) {
    const games = playerGames(l, p, week);
    let pts = 0, played = 0, left = 0;
    for (const g of games) {
      const k = `${p.id}|${g.key}`;
      if (g.state !== "pre" && active && !frozen.has(k)) {
        run("INSERT OR IGNORE INTO daily_slots (team_id, date_et, player_id, slot) VALUES (?, ?, ?, ?)", teamId, g.key, p.id, p.slot);
        frozen.set(k, p.slot);
      }
      if (g.state === "pre") left++;
      else played++;
      if (g.line && frozen.get(k) && frozen.get(k) !== "BN") {
        const raw = gamePts(p.id, g);
        pts += raw;
        if (g.final) pay(p.id, g.key, raw);
      }
    }
    const proj = projFor(p, l.scoring);
    if (p.slot !== "BN") {
      const effLeft = isOut(p) ? 0 : left;
      remain += effLeft * proj;
      variance += effLeft * Math.pow(proj * 0.35, 2);
      projected += games.length * proj;
    }
    const cur = games.find((g) => g.state === "in") ?? [...games].reverse().find((g) => g.state === "post") ?? games.find((g) => g.state === "pre");
    // Show the boost on the game being played now, else an upcoming boosted game, else today's finished one.
    const bGame = [cur, ...games.filter((g) => g.state === "pre")].find((g) => g && boosts.has(`${p.id}|${g.key}`));
    const b = bGame ? boosts.get(`${p.id}|${bGame.key}`)! : null;
    rows.push({
      id: p.id, name: p.name, pos: fpos(p), team: p.team, slot: p.slot, headshot: p.headshot, injury: p.injury,
      pts: Math.round(pts * 100) / 100, proj, played, left, total: games.length, locked: isLocked(l, p),
      now: cur ? { label: cur.label, clock: cur.clock, state: cur.state, line: cur.line ? statLine(cur.line) : "", pts: cur.line ? gamePts(p.id, cur) : 0 } : null,
      boost: b && bGame ? { mult: b.mult, pts: b.boost_pts, reb: b.boost_reb, ast: b.boost_ast, own: !!b.own, cardId: b.card_id, dayKey: b.day_key, state: bGame.state } : null,
    });
  }
  // Points from players no longer on the roster (dropped/traded mid-week) still count.
  let ghost = 0;
  const onRoster = new Set(players.map((p) => p.id));
  const keyFilter = l.mode === "sim" ? (k: string) => k.startsWith(`sim:W${week}:`) : (() => { const [a, b] = weekRange(l, week); return (k: string) => k >= a && k <= b; })();
  for (const [k, slot] of frozen) {
    const [pidS, key] = [k.slice(0, k.indexOf("|")), k.slice(k.indexOf("|") + 1)];
    const pid = Number(pidS);
    if (onRoster.has(pid) || slot === "BN" || !keyFilter(key)) continue;
    const p = one<Player>("SELECT * FROM players WHERE id = ?", pid);
    const g = p && playerGames(l, p, week).find((x) => x.key === key);
    if (g?.line) {
      const raw = gamePts(pid, g);
      ghost += raw;
      if (g.final) pay(pid, key, raw);
    }
  }
  const order = (s: string) => (s === "BN" ? 99 : STARTERS.indexOf(s as (typeof STARTERS)[number]));
  rows.sort((a, b) => order(a.slot) - order(b.slot) || b.proj - a.proj);
  const score = Math.round((rows.reduce((s, p) => s + p.pts, 0) + ghost) * 100) / 100;
  return { players: rows, score, remain, variance, projected, rate };
}

// ---------- Day by day (roster and matchup pages) ----------

export type DayInfo = { key: string; label: string; short: string; top: string; today: boolean; past: boolean };
export type DayRow = {
  id: number; name: string; pos: string; team: string; headshot: string | null; injury: string | null; proj: number; locked: boolean;
  /** The slot he's in for this day: frozen when his game started, else his current slot (lineups carry forward). */
  slot: string;
  game: { opp: string; status: string; state: "pre" | "in" | "post"; line: Line | null } | null;
  /** Fantasy points for this day's game, with his equipped slab applied (counted only if he started). */
  fpts: number | null;
  boost: LivePlayer["boost"];
};

/** The days (real leagues) or game numbers (sim) that make up a week, oldest first. */
export function weekDays(l: League, week: number): DayInfo[] {
  if (l.mode === "sim") {
    const progress = week < l.current_week ? 1 : week === l.current_week ? weekProgress(l) : 0;
    return [0, 1, 2, 3].map((i) => ({ key: `sim:W${week}:G${i}`, label: `Game ${i + 1}`, short: `G${i + 1}`, top: "SIM", today: false, past: progress >= 1 }));
  }
  const [from, to] = weekRange(l, week);
  const today = etDate();
  const out: DayInfo[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const dt = new Date(`${d}T12:00:00Z`);
    out.push({
      key: d, today: d === today, past: d < today,
      label: d === today ? `Today (${dayLabel(d)})` : dayLabel(d),
      short: d === today ? "TODAY" : dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase(),
      top: dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase(),
    });
  }
  return out;
}
/** The day a week opens on: today if it's in the week, else its last day (past weeks) or first (future). */
export function defaultDay(days: DayInfo[]) {
  return (days.find((d) => d.today) ?? (days.every((d) => d.past) ? days[days.length - 1] : days.find((d) => !d.past) ?? days[0])).key;
}

/**
 * A team's week, one day at a time: each player's slot, game and fantasy points per day, plus each day's starter
 * total. Read-only (no lineup freezing or payouts; teamWeek does those).
 */
export function teamDays(l: League, teamId: number, week: number) {
  const days = weekDays(l, week);
  const players = roster(teamId);
  const boosts = teamBoosts(teamId);
  const frozen = new Map(
    all<{ date_et: string; player_id: number; slot: string }>("SELECT * FROM daily_slots WHERE team_id = ?", teamId).map((r) => [`${r.player_id}|${r.date_et}`, r.slot]),
  );
  const rows: Record<string, DayRow[]> = {};
  const totals: Record<string, number> = {};
  for (const d of days) { rows[d.key] = []; totals[d.key] = 0; }
  for (const p of players) {
    const games = new Map(playerGames(l, p, week).map((g) => [g.key, g]));
    const locked = isLocked(l, p);
    for (const d of days) {
      const g = games.get(d.key);
      const b = boosts.get(`${p.id}|${d.key}`);
      const slot = frozen.get(`${p.id}|${d.key}`) ?? p.slot;
      const fp = g?.line ? slabbedFpts(g.line, l.scoring, b, g.final) : null;
      if (fp != null && slot !== "BN") totals[d.key] += fp;
      rows[d.key].push({
        id: p.id, name: p.name, pos: fpos(p), team: p.team, headshot: p.headshot, injury: p.injury, proj: projFor(p, l.scoring), locked, slot,
        game: g ? { opp: g.opp ?? g.label, state: g.state, line: g.line, status: g.state === "pre" ? g.clock : g.state === "in" ? g.clock || "Live" : g.result ?? "Final" } : null,
        fpts: fp,
        boost: b && g ? { mult: b.mult, pts: b.boost_pts, reb: b.boost_reb, ast: b.boost_ast, own: !!b.own, cardId: b.card_id, dayKey: b.day_key, state: g.state } : null,
      });
    }
  }
  // Players since dropped or traded still count on the days they started.
  const onRoster = new Set(players.map((p) => p.id));
  for (const [k, slot] of frozen) {
    const i = k.indexOf("|");
    const pid = Number(k.slice(0, i)), key = k.slice(i + 1);
    if (onRoster.has(pid) || slot === "BN" || !(key in totals)) continue;
    const p = one<Player>("SELECT * FROM players WHERE id = ?", pid);
    const g = p && playerGames(l, p, week).find((x) => x.key === key);
    if (g?.line) totals[key] += slabbedFpts(g.line, l.scoring, boosts.get(k), g.final);
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k] * 100) / 100;
  const order = (s: string) => (s === "BN" ? 99 : STARTERS.indexOf(s as (typeof STARTERS)[number]));
  for (const k of Object.keys(rows)) rows[k].sort((a, b) => order(a.slot) - order(b.slot) || b.proj - a.proj);
  return { days, rows, totals };
}

/** Freeze lineups for started games, finish weeks, and keep CPU lineups fresh. Safe to call often. */
export function tickLeague(leagueId: number) {
  const l = getLeague(leagueId);
  if (!l || l.draft_status !== "done" || l.champion_team_id) return;
  consumeEquips(l);
  if (l.mode === "sim") {
    if (l.week_started_at && weekProgress(l) >= 1) finalizeWeek(l);
    return;
  }
  const today = etDate();
  const cpuKey = `cpu:${l.id}:${today}`;
  if (!one("SELECT 1 FROM meta WHERE key = ?", cpuKey)) {
    for (const t of leagueTeams(l.id)) if (t.is_cpu) autoLineup(l, t.id);
    run("INSERT OR IGNORE INTO meta (key, value) VALUES (?, '1')", cpuKey);
  }
  for (const t of leagueTeams(l.id)) teamWeek(l, t.id, l.current_week);
  const [, end] = weekRange(l, l.current_week);
  const pending = one<{ n: number }>("SELECT COUNT(*) n FROM games WHERE date_et BETWEEN ? AND ? AND state != 'post' AND season_type IN (2, 3)", weekRange(l, l.current_week)[0], end)?.n ?? 0;
  if (today > end && (pending === 0 || today > addDays(end, 1))) finalizeWeek(l);
}
export const maybeFinalize = tickLeague;

// ---------- Draft ----------

export function draftOrder(l: League): number[] {
  return l.draft_order ? JSON.parse(l.draft_order) : [];
}
export function pickTeam(order: number[], overall: number) {
  const n = order.length;
  const round = Math.floor((overall - 1) / n) + 1;
  const idx = (overall - 1) % n;
  return { round, teamId: round % 2 === 1 ? order[idx] : order[n - 1 - idx], pickInRound: idx + 1 };
}
export const picksMade = (leagueId: number) => one<{ n: number }>("SELECT COUNT(*) n FROM draft_picks WHERE league_id = ?", leagueId)?.n ?? 0;

export function availablePlayers(leagueId: number) {
  return all<Player>(
    "SELECT * FROM players WHERE active = 1 AND id NOT IN (SELECT player_id FROM roster WHERE league_id = ?) AND id NOT IN (SELECT player_id FROM keepers WHERE league_id = ?) ORDER BY adp",
    leagueId, leagueId);
}

const MIN_POS: Record<string, number> = { G: 2, F: 2, C: 1 };
function bestFor(l: League, teamId: number, round: number, jitter: () => number) {
  const mine = roster(teamId);
  const count = (pos: string) => mine.filter((p) => p.pos === pos).length;
  const pool = availablePlayers(l.id);
  const avail = new Set(pool.map((p) => p.id));
  const q = all<{ player_id: number }>("SELECT player_id FROM draft_queue WHERE team_id = ? ORDER BY rank", teamId).find((x) => avail.has(x.player_id));
  if (q) return q.player_id;
  const futureKeepers = one<{ n: number }>("SELECT COUNT(*) n FROM keepers WHERE team_id = ? AND round > ?", teamId, round)?.n ?? 0;
  const left = ROUNDS - round + 1 - futureKeepers;
  const needs = Object.keys(MIN_POS).filter((pos) => count(pos) < MIN_POS[pos]);
  const needSlots = needs.reduce((s, pos) => s + MIN_POS[pos] - count(pos), 0);
  const ok = (p: Player) => {
    if (needSlots >= left) return needs.includes(p.pos);
    if (p.pos === "C" && count("C") >= 3) return false;
    return !isOut(p) || round > 8;
  };
  const sorted = [...pool].sort((a, b) => projFor(b, l.scoring) - projFor(a, l.scoring));
  const candidates = sorted.filter(ok).slice(0, 4);
  if (!candidates.length) return pool[0]?.id;
  const roll = jitter();
  return candidates[roll < 0.65 ? 0 : roll < 0.85 ? 1 : roll < 0.95 ? 2 : Math.min(3, candidates.length - 1)].id;
}

export function makePick(l: League, teamId: number, playerId: number, isKeeper = false) {
  const overall = picksMade(l.id) + 1;
  const order = draftOrder(l);
  const { round, teamId: onClock } = pickTeam(order, overall);
  if (onClock !== teamId) throw new Error("Not your pick");
  if (one("SELECT 1 FROM roster WHERE league_id = ? AND player_id = ?", l.id, playerId)) throw new Error("Already drafted");
  const now = Date.now();
  run("INSERT INTO draft_picks (league_id, overall, round, team_id, player_id, is_keeper, made_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    l.id, overall, round, teamId, playerId, isKeeper ? 1 : 0, now);
  run("INSERT INTO roster (team_id, player_id, slot, league_id) VALUES (?, ?, 'BN', ?)", teamId, playerId, l.id);
  run("DELETE FROM draft_queue WHERE player_id = ? AND team_id IN (SELECT id FROM teams WHERE league_id = ?)", playerId, l.id);
  run("UPDATE leagues SET last_pick_at = ?, pick_deadline = ? WHERE id = ?", now, now + l.pick_seconds * 1000, l.id);
  if (overall >= order.length * ROUNDS) finishDraft(l.id);
}

/** Called on every draft poll: makes keeper, CPU, autodraft, and expired-clock picks. */
export function advanceDraft(leagueId: number) {
  for (let guard = 0; guard < 20; guard++) {
    const l = getLeague(leagueId)!;
    if (l.draft_status !== "live") return;
    const order = draftOrder(l);
    const overall = picksMade(l.id) + 1;
    const { round, teamId } = pickTeam(order, overall);
    const team = one<Team>("SELECT * FROM teams WHERE id = ?", teamId)!;
    const keeper = one<{ player_id: number }>("SELECT player_id FROM keepers WHERE league_id = ? AND team_id = ? AND round = ?", l.id, teamId, round);
    const now = Date.now();
    if (keeper) {
      tx(() => {
        run("DELETE FROM keepers WHERE league_id = ? AND player_id = ?", l.id, keeper.player_id);
        makePick(l, teamId, keeper.player_id, true);
      });
      continue;
    }
    const bot = team.is_cpu || team.autodraft;
    const due = bot ? now - (l.last_pick_at ?? 0) > 1200 : now > (l.pick_deadline ?? Infinity);
    if (!due) return;
    const pid = bestFor(l, teamId, round, rng(`draft:${l.id}:${overall}`));
    if (!pid) return;
    tx(() => makePick(l, teamId, pid));
    if (bot) return; // one CPU pick per poll so the board animates
  }
}

export function startDraft(l: League) {
  const teams = leagueTeams(l.id);
  if (teams.length < 2 || teams.length % 2) throw new Error("Need an even number of teams (add CPU teams to fill)");
  const r = rng(`order:${l.id}:${Date.now()}`);
  const order = teams.map((t) => t.id).sort(() => r() - 0.5);
  run("UPDATE leagues SET draft_status = 'live', draft_order = ?, pick_deadline = ?, last_pick_at = ? WHERE id = ?",
    JSON.stringify(order), Date.now() + l.pick_seconds * 1000, Date.now(), l.id);
  postSystem(l.id, "The draft is LIVE! Get in the draft room.");
}

function schedule(teamIds: number[], weeks: number) {
  const n = teamIds.length;
  const arr = [...teamIds];
  const out: [number, number, number][] = [];
  for (let w = 1; w <= weeks; w++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      out.push(w % 2 ? [w, a, b] : [w, b, a]);
    }
    arr.splice(1, 0, arr.pop()!);
  }
  return out;
}

/** Opening night of the NBA regular season (from the synced schedule; falls back to the known 2026-27 opener). */
export const NBA_OPENER_FALLBACK = "2026-10-20";
export function seasonOpener() {
  const today = etDate();
  // From ESPN's season calendar (see nba/season.ts); else the first regular-season game we know of from ~8 months back.
  const s = nbaSeason();
  if (s.dates.length) return s.regStart;
  return one<{ d: string | null }>("SELECT MIN(date_et) d FROM games WHERE season_type = 2 AND date_et >= ?", addDays(today, -240))?.d ?? NBA_OPENER_FALLBACK;
}

/** Real leagues: true until opening night (no games count, nothing to earn yet). */
export const beforeOpener = (l: League) => l.mode !== "sim" && !!l.start_date && etDate() < l.start_date;

export function finishDraft(leagueId: number) {
  // Real leagues start on opening night of the regular season (or tomorrow if the season is already on),
  // so preseason and tonight's games never count.
  const tomorrow = addDays(etDate(), 1);
  const opener = seasonOpener();
  const start = opener > tomorrow ? opener : tomorrow;
  run("UPDATE leagues SET draft_status = 'done', pick_deadline = NULL, start_date = COALESCE(start_date, ?), season = COALESCE(season, ?) WHERE id = ?", start, nbaSeason().year, leagueId);
  planSeason(getLeague(leagueId)!);
  const l = getLeague(leagueId)!;
  const teams = leagueTeams(leagueId);
  for (const t of teams) autoLineup(l, t.id);
  for (const [w, h, a] of schedule(teams.map((t) => t.id), l.season_weeks))
    run("INSERT INTO matchups (league_id, week, home_team_id, away_team_id) VALUES (?, ?, ?, ?)", leagueId, w, h, a);
  if (l.mode === "sim") postSystem(leagueId, "Draft complete! Set your lineups; the commish kicks off each simulated week.");
  else {
    const [s, e] = weekRange(l, 1);
    postSystem(leagueId, `Draft complete! Week 1 runs ${dayLabel(s)} – ${dayLabel(e)} with real NBA games. Set your lineup daily; players lock at tip-off.`);
  }
}

// ---------- Weeks, rewards, waivers ----------

/** Sim leagues only: the commish starts each simulated week. */
export function startWeek(l: League) {
  if (l.mode !== "sim") throw new Error("Real-NBA leagues run on the actual schedule");
  if (l.draft_status !== "done") throw new Error("Finish the draft first");
  if (l.week_started_at) throw new Error("Week already in progress");
  if (l.champion_team_id) throw new Error("Season is over");
  processWaivers(l.id);
  for (const t of leagueTeams(l.id)) if (t.is_cpu) autoLineup(l, t.id);
  run("UPDATE leagues SET week_started_at = ? WHERE id = ?", Date.now(), l.id);
  postSystem(l.id, `Simulated week ${l.current_week} tipped off! Games are live.`);
}

export function finalizeWeek(l: League) {
  tx(() => {
    const fresh = getLeague(l.id)!;
    if (fresh.mode === "sim" && !fresh.week_started_at) return;
    const week = fresh.current_week;
    if (one("SELECT 1 FROM matchups WHERE league_id = ? AND week = ? AND final = 1", l.id, week)) return;
    const ms = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ?", l.id, week);
    const playoffs = isPlayoffWeek(fresh, week);
    const teamMap = new Map(leagueTeams(l.id).map((t) => [t.id, t]));
    const scores: { teamId: number; pts: number }[] = [];
    const lines: string[] = [];
    for (const m of ms) {
      const hs = teamWeek(fresh, m.home_team_id, week).score;
      const as = teamWeek(fresh, m.away_team_id, week).score;
      run("UPDATE matchups SET home_score = ?, away_score = ?, final = 1 WHERE id = ?", hs, as, m.id);
      scores.push({ teamId: m.home_team_id, pts: hs }, { teamId: m.away_team_id, pts: as });
      const res = (tid: number, me: number, opp: number) => {
        // Playoff games don't count toward the regular-season record (same as ESPN).
        const col = me > opp ? "wins" : me < opp ? "losses" : "ties";
        if (!playoffs) run(`UPDATE teams SET ${col} = ${col} + 1, points_for = points_for + ?, points_against = points_against + ? WHERE id = ?`, me, opp, tid);
        const t = teamMap.get(tid)!;
        if (t.user_id) awardPack(t.user_id, me >= opp ? fresh.reward_win : fresh.reward_loss, `${fresh.name} · ${weekName(fresh, week)} ${me > opp ? "win" : me < opp ? "loss" : "tie"}`, fresh.id);
      };
      res(m.home_team_id, hs, as);
      res(m.away_team_id, as, hs);
      // Playoff matchups are scheduled with the higher seed at home, and a tie goes to the higher seed.
      const [w, lo] = hs >= as ? [m.home_team_id, m.away_team_id] : [m.away_team_id, m.home_team_id];
      lines.push(hs === as && playoffs
        ? `**${teamMap.get(w)!.name}** and ${teamMap.get(lo)!.name} tie at ${hs.toFixed(1)}; ${teamMap.get(w)!.name} advances as the higher seed`
        : `**${teamMap.get(w)!.name}** ${Math.max(hs, as).toFixed(1)} def. ${teamMap.get(lo)!.name} ${Math.min(hs, as).toFixed(1)}`);
    }
    if (!scores.length && !playoffs) return;
    const name = weekName(fresh, week);
    if (scores.length) {
      scores.sort((a, b) => b.pts - a.pts);
      const top = teamMap.get(scores[0].teamId)!;
      if (top.user_id) awardPack(top.user_id, fresh.reward_top, `${fresh.name} · ${name} top score`, fresh.id);
      const bottom = teamMap.get(scores[scores.length - 1].teamId)!;
      postSystem(l.id, `${name} final!\n${lines.join("\n")}\n\nTop score: ${top.name} (${scores[0].pts.toFixed(1)}) earns a ${PACK_BY_ID[fresh.reward_top]?.name}.\nWinners got a ${PACK_BY_ID[fresh.reward_win]?.name ?? "pack"}.${playoffs ? "" : `\nBasement: ${bottom.name} (${scores[scores.length - 1].pts.toFixed(1)}). Roast accordingly.`}`);
    }
    const info = playoffInfo(fresh);
    const crown = (champId: number) => {
      const champ = teamMap.get(champId)!;
      run("UPDATE leagues SET week_started_at = NULL, champion_team_id = ? WHERE id = ?", champ.id, l.id);
      if (champ.user_id) awardPack(champ.user_id, "goat", `${fresh.name} · Champion`, fresh.id);
      postSystem(l.id, `${champ.name} wins the ${fresh.name} championship and a GOAT Pack!`);
    };
    const advance = () => run("UPDATE leagues SET week_started_at = NULL, current_week = current_week + 1 WHERE id = ?", l.id);
    if (week < fresh.season_weeks) advance();
    else if (week === fresh.season_weeks) {
      // Regular season over: lock the seeds and set Playoff Round 1.
      const seeded = standings(l.id).slice(0, info.teams);
      if (info.rounds === 0) crown(seeded[0].id);
      else {
        run("UPDATE leagues SET playoff_seeds = ? WHERE id = ?", JSON.stringify(seeded.map((t) => t.id)), l.id);
        advance();
        schedulePlayoffRound(getLeague(l.id)!, 1);
        postSystem(l.id, `The regular season is over! Playoff seeds:\n${seeded.map((t, i) => `${i + 1}. ${t.name} (${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""})`).join("\n")}\n\nPlayoff Round 1 starts now.`);
      }
    } else {
      const round = week - fresh.season_weeks;
      const b = bracket(getLeague(l.id)!);
      if (round >= info.rounds) crown(b.champion ?? b.rounds.at(-1)![0].a!);
      else {
        advance();
        schedulePlayoffRound(getLeague(l.id)!, round + 1);
        const next = b.rounds[round];
        postSystem(l.id, `${weekName(fresh, week + 1)}${round + 1 === info.rounds ? " (the championship)" : ""} is set:\n${next.map((x) => `${teamMap.get(x.a!)?.name ?? "TBD"} vs ${teamMap.get(x.b!)?.name ?? "TBD"}`).join("\n")}`);
      }
    }
  });
  processWaivers(l.id);
  const next = getLeague(l.id)!;
  for (const t of leagueTeams(l.id)) if (t.is_cpu) autoLineup(next, t.id);
}

export function processWaivers(leagueId: number) {
  const claims = all<{ id: number; team_id: number; add_player_id: number; drop_player_id: number | null; bid: number }>(
    `SELECT c.* FROM waiver_claims c JOIN teams t ON t.id = c.team_id WHERE c.league_id = ? AND c.status = 'pending'
     ORDER BY c.bid DESC, t.wins ASC, t.points_for ASC, c.created_at ASC`, leagueId);
  for (const c of claims) {
    tx(() => {
      const team = one<Team>("SELECT * FROM teams WHERE id = ?", c.team_id)!;
      const taken = one("SELECT 1 FROM roster WHERE league_id = ? AND player_id = ?", leagueId, c.add_player_id);
      const dropOk = !c.drop_player_id || one("SELECT 1 FROM roster WHERE team_id = ? AND player_id = ?", c.team_id, c.drop_player_id);
      const size = roster(c.team_id).length - (c.drop_player_id ? 1 : 0);
      if (taken || !dropOk || team.faab < c.bid || size >= ROSTER_MAX) {
        run("UPDATE waiver_claims SET status = 'failed' WHERE id = ?", c.id);
        return;
      }
      if (c.drop_player_id) run("DELETE FROM roster WHERE team_id = ? AND player_id = ?", c.team_id, c.drop_player_id);
      run("INSERT INTO roster (team_id, player_id, slot, league_id) VALUES (?, ?, 'BN', ?)", c.team_id, c.add_player_id, leagueId);
      run("UPDATE teams SET faab = faab - ? WHERE id = ?", c.bid, c.team_id);
      run("UPDATE waiver_claims SET status = 'won' WHERE id = ?", c.id);
      const p = one<Player>("SELECT * FROM players WHERE id = ?", c.add_player_id)!;
      postSystem(leagueId, `Waivers: ${team.name} claimed ${p.name} for $${c.bid} FAAB.`);
    });
  }
}

/** Real leagues process FAAB claims once a day (early morning ET); sim leagues at each kickoff. */
export function dailyWaivers(leagueId: number) {
  const key = `waivers:${leagueId}:${etDate()}`;
  if (one("SELECT 1 FROM meta WHERE key = ?", key)) return;
  run("INSERT OR IGNORE INTO meta (key, value) VALUES (?, '1')", key);
  processWaivers(leagueId);
}

// ---------- Trades ----------

export function executeTrade(tradeId: number) {
  tx(() => {
    const t = one<{ id: number; league_id: number; from_team_id: number; to_team_id: number; give: string; get: string; status: string }>("SELECT * FROM trades WHERE id = ?", tradeId)!;
    if (t.status !== "pending") throw new Error("Trade is no longer pending");
    const give: number[] = JSON.parse(t.give);
    const get: number[] = JSON.parse(t.get);
    for (const pid of give) if (!one("SELECT 1 FROM roster WHERE team_id = ? AND player_id = ?", t.from_team_id, pid)) throw new Error("A player in this trade has moved");
    for (const pid of get) if (!one("SELECT 1 FROM roster WHERE team_id = ? AND player_id = ?", t.to_team_id, pid)) throw new Error("A player in this trade has moved");
    if (roster(t.from_team_id).length - give.length + get.length > ROSTER_MAX || roster(t.to_team_id).length - get.length + give.length > ROSTER_MAX)
      throw new Error("Trade would put a roster over the limit");
    for (const pid of give) run("UPDATE roster SET team_id = ?, slot = 'BN' WHERE league_id = ? AND player_id = ?", t.to_team_id, t.league_id, pid);
    for (const pid of get) run("UPDATE roster SET team_id = ?, slot = 'BN' WHERE league_id = ? AND player_id = ?", t.from_team_id, t.league_id, pid);
    run("UPDATE trades SET status = 'accepted' WHERE id = ?", tradeId);
    const name = (id: number) => one<Team>("SELECT * FROM teams WHERE id = ?", id)!.name;
    const pn = (ids: number[]) => ids.map((id) => one<Player>("SELECT name FROM players WHERE id = ?", id)!.name).join(", ") || "nothing";
    postSystem(t.league_id, `TRADE: ${name(t.from_team_id)} sends ${pn(give)} to ${name(t.to_team_id)} for ${pn(get)}.`);
  });
}

// ---------- Seasons: planning, offseason, rollover ----------

/**
 * Real leagues plan their weeks from the NBA calendar when the draft finishes, the way ESPN does: week 1 runs from
 * opening night to the first Sunday, then Monday–Sunday; the week of the All-Star break is merged with the week after
 * it into one two-week matchup; playoff rounds are two weeks each; and the fantasy playoffs end at least a week before
 * the NBA regular season does. The regular season is as many weeks as fit (capped by the league's own setting).
 */
export function planSeason(l: League) {
  const s = nbaSeason();
  if (l.mode === "sim" || !l.start_date || !s.dates.length) return;
  const gameDays = new Set(s.dates);
  // Calendar weeks: [start, end] for week 1, then Monday–Sunday through the end of the NBA regular season.
  const cal: [string, string][] = [];
  let e = addDays(l.start_date, 4);
  while (weekday(e) !== 0) e = addDays(e, 1);
  cal.push([l.start_date, e]);
  while (addDays(e, 7) <= s.regEnd) { cal.push([addDays(e, 1), addDays(e, 7)]); e = addDays(e, 7); }
  const days = ([a, b]: [string, string]) => { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (gameDays.has(d)) n++; return n; };
  // The All-Star week: the lightest week from mid-January to mid-March (only if it's clearly a break).
  let star = -1;
  cal.forEach((w, i) => {
    const md = w[0].slice(5);
    if (i > 0 && md >= "01-15" && md <= "03-15" && days(w) <= 4 && (star < 0 || days(w) < days(cal[star]))) star = i;
  });
  // Matchup periods (calendar-week counts), with the All-Star week folded into the next one.
  const periods: number[] = [];
  cal.forEach((_, i) => { if (i === star + 1 && star >= 0) periods[periods.length - 1] = 2; else periods.push(1); });
  const { rounds } = playoffInfo(l);
  const playoffWeeks = rounds * 2;
  // Most regular-season matchups that still leave room for the playoffs plus a spare week before the NBA's last week.
  let fit = 0, used = 0;
  for (let k = 0; k < periods.length; k++) {
    used += periods[k];
    if (cal.length - used >= playoffWeeks + 1) fit = k + 1;
  }
  const weeks = Math.max(1, Math.min(l.season_weeks, fit || l.season_weeks));
  const long: number[] = [];
  periods.forEach((n, i) => { if (n === 2 && i + 1 <= weeks) long.push(i + 1); });
  for (let r = 1; r <= rounds; r++) long.push(weeks + r);
  run("UPDATE leagues SET season_weeks = ?, long_weeks = ? WHERE id = ?", weeks, JSON.stringify(long), l.id);
}

export type SeasonRecord = {
  id: number; season: number | null; champion_team_id: number | null; champion: string | null; created_at: number;
  standings: { team_id: number; name: string; owner: string | null; wins: number; losses: number; ties: number; points_for: number }[];
};
/** Past seasons of a league, newest first. */
export function leagueHistory(leagueId: number): SeasonRecord[] {
  return all<{ id: number; season: number | null; champion_team_id: number | null; champion: string | null; standings: string; created_at: number }>(
    "SELECT id, season, champion_team_id, champion, standings, created_at FROM league_seasons WHERE league_id = ? ORDER BY id DESC", leagueId)
    .map((r) => ({ ...r, standings: JSON.parse(r.standings) }));
}

/** Season over (champion crowned) and waiting on the next one. */
export const inOffseason = (l: League) => !!l.champion_team_id;

/**
 * Close out a league's season and set it up for the next one. Everything about the old season is kept in
 * league_seasons (final standings, every result, the champion, end-of-season rosters). Then the league goes back to
 * pre-draft: rosters, matchups, the draft, keepers and pending waivers/trades are cleared, records and FAAB reset,
 * and slabs equipped for games that never happened go back to their owners. Members, team names and logos,
 * settings and chat all carry over. The commish schedules the new draft.
 */
export function startNewSeason(l: League, year: number | null) {
  tx(() => {
    const fresh = getLeague(l.id)!;
    if (fresh.draft_status === "live") throw new Error("Finish the draft first");
    const teams = leagueTeams(l.id);
    const owners = new Map(all<{ id: number; name: string }>("SELECT id, name FROM users").map((u) => [u.id, u.name]));
    const table = fresh.draft_status === "done" ? standings(l.id) : teams;
    const champ = fresh.champion_team_id ? teams.find((t) => t.id === fresh.champion_team_id) ?? null : null;
    const rosters = Object.fromEntries(teams.map((t) => [t.id, roster(t.id).map((p) => p.id)]));
    const results = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? ORDER BY week, id", l.id)
      .map((m) => ({ week: m.week, home: m.home_team_id, away: m.away_team_id, hs: m.home_score, as: m.away_score, final: m.final, kind: m.kind ?? null }));
    const histId = Number(run(
      `INSERT INTO league_seasons (league_id, season, champion_team_id, champion, standings, results, rosters, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      l.id, fresh.season ?? null, champ?.id ?? null, champ?.name ?? null,
      JSON.stringify(table.map((t) => ({ team_id: t.id, name: t.name, owner: t.user_id ? owners.get(t.user_id) ?? null : null, wins: t.wins, losses: t.losses, ties: t.ties, points_for: Math.round(t.points_for * 100) / 100 }))),
      JSON.stringify(results), JSON.stringify(rosters), Date.now()).lastInsertRowid);
    const ids = teams.map((t) => t.id);
    const inTeams = `(${ids.map(() => "?").join(",") || "NULL"})`;
    const tag = `old${histId}:`;
    ensureBoosts();
    // Slabs equipped for games that will never be played go back to the collection; used ones stay in the record
    // under the old season's name so they never count again (sim leagues reuse game keys every season).
    run("DELETE FROM slab_equips WHERE league_id = ? AND consumed_at IS NULL", l.id);
    run("UPDATE slab_equips SET day_key = ? || day_key WHERE league_id = ? AND day_key NOT LIKE 'old%'", tag, l.id);
    run("UPDATE league_boosts SET day_key = ? || day_key WHERE league_id = ? AND day_key NOT LIKE 'old%'", tag, l.id);
    run("UPDATE pp_earnings SET archived = ?, game_key = ? || game_key WHERE league_id = ? AND archived = 0", histId, tag, l.id);
    run(`DELETE FROM daily_slots WHERE team_id IN ${inTeams}`, ...ids);
    run(`DELETE FROM draft_queue WHERE team_id IN ${inTeams}`, ...ids);
    for (const t of ["roster", "matchups", "draft_picks", "keepers"]) run(`DELETE FROM ${t} WHERE league_id = ?`, l.id);
    run("UPDATE waiver_claims SET status = 'cancelled' WHERE league_id = ? AND status = 'pending'", l.id);
    run("UPDATE trades SET status = 'cancelled' WHERE league_id = ? AND status = 'pending'", l.id);
    run("UPDATE teams SET wins = 0, losses = 0, ties = 0, points_for = 0, points_against = 0, faab = ? WHERE league_id = ?", fresh.faab_budget, l.id);
    run(`UPDATE leagues SET season = ?, draft_status = 'pre', draft_order = NULL, pick_deadline = NULL, last_pick_at = NULL, current_week = 1,
         week_started_at = NULL, champion_team_id = NULL, start_date = NULL, long_weeks = NULL, playoff_seeds = NULL WHERE id = ?`, year, l.id);
    const label = year ? seasonLabel(year) : "the new season";
    postSystem(l.id, `${champ ? `${champ.name} are the ${fresh.season ? seasonLabel(fresh.season) : "last"} champs. ` : ""}Welcome to ${label}! Rosters are cleared and records reset. The commish sets up the draft; your teams, logos and chat carry over.`);
  });
}

/** Can the commish start the next season now? Sim leagues: once a champion is crowned. Real leagues: once ESPN has next season's dates (they also roll over on their own when its preseason starts). */
export function canStartNewSeason(l: League): { ok: true; year: number | null } | { ok: false; why: string } {
  if (l.draft_status === "live") return { ok: false, why: "Finish the draft first" };
  if (l.mode === "sim") return l.champion_team_id ? { ok: true, year: l.season ?? nbaSeason().year } : { ok: false, why: "Crown a champion first" };
  const s = nbaSeason();
  if (l.season != null && s.year > l.season) return { ok: true, year: s.year };
  return { ok: false, why: `The ${seasonLabel((l.season ?? s.year) + 1)} NBA schedule isn't out yet. The league resets by itself when it is` };
}

/**
 * Real leagues roll over by themselves: once ESPN's calendar says a new NBA season has begun (preseason), any league
 * still on an older season starts the new one. A league that's mid-draft waits until the draft is done.
 */
export function rolloverLeagues() {
  const s = nbaSeason();
  if (etDate() < s.start) return;
  for (const l of all<League>("SELECT * FROM leagues WHERE mode != 'sim' AND draft_status != 'live' AND season IS NOT NULL AND season < ?", s.year))
    startNewSeason(l, s.year);
  // A league that never got a season stamped just joins the current one.
  run("UPDATE leagues SET season = ? WHERE season IS NULL AND draft_status = 'pre'", s.year);
}

// ---------- Standings & playoffs (ESPN style) ----------

/**
 * Regular-season standings, ESPN style: win percentage (ties count half), then head-to-head record between the
 * tied teams, then total points for.
 */
export function standings(leagueId: number) {
  const teams = all<Team>("SELECT * FROM teams WHERE league_id = ?", leagueId);
  const pct = (w: number, lo: number, t: number) => (w + lo + t ? (w + t / 2) / (w + lo + t) : 0);
  const games = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND final = 1 AND kind IS NULL", leagueId);
  const groups = new Map<number, Team[]>();
  for (const t of teams) {
    const k = Math.round(pct(t.wins, t.losses, t.ties) * 1e6);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  return [...groups.keys()].sort((a, b) => b - a).flatMap((k) => {
    const g = groups.get(k)!;
    if (g.length < 2) return g;
    const ids = new Set(g.map((t) => t.id));
    const h2h = new Map(g.map((t) => [t.id, { w: 0, l: 0, t: 0 }]));
    for (const m of games) {
      if (!ids.has(m.home_team_id) || !ids.has(m.away_team_id)) continue;
      const hs = m.home_score ?? 0, as = m.away_score ?? 0;
      const h = h2h.get(m.home_team_id)!, a = h2h.get(m.away_team_id)!;
      if (hs > as) { h.w++; a.l++; } else if (as > hs) { a.w++; h.l++; } else { h.t++; a.t++; }
    }
    const hp = (t: Team) => { const r = h2h.get(t.id)!; return pct(r.w, r.l, r.t); };
    return [...g].sort((a, b) => hp(b) - hp(a) || b.points_for - a.points_for);
  });
}

/** Playoff shape: how many teams get in, how many rounds (one matchup period each), and the last week of the season. */
export function playoffInfo(l: League) {
  const n = Math.min(l.playoff_teams ?? 4, leagueTeams(l.id).length);
  const rounds = n >= 2 ? Math.ceil(Math.log2(n)) : 0;
  return { teams: n, rounds, lastWeek: l.season_weeks + rounds };
}
export const isPlayoffWeek = (l: League, week: number) => week > l.season_weeks;
/** "Week 7", "Playoff Round 1", ... */
export const weekName = (l: League, week: number) => (week > l.season_weeks ? `Playoff Round ${week - l.season_weeks}` : `Week ${week}`);
export const weekShort = (l: League, week: number) => (week > l.season_weeks ? `PO R${week - l.season_weeks}` : `Wk ${week}`);

/** Seed positions in bracket order, e.g. 4 → [1, 4, 2, 3] so round 1 is 1v4 and 2v3, and their winners meet. */
function bracketOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) order = order.flatMap((s) => [s, order.length * 2 + 1 - s]);
  return order;
}

export type BracketSlot = { a: number | null; b: number | null; seedA: number | null; seedB: number | null; matchup: Matchup | null; winner: number | null; loser: number | null };
/**
 * The playoff bracket like ESPN's: top seeds play the bottom seeds (byes to the top when the field isn't a power of 2),
 * no reseeding, a tied playoff matchup goes to the higher seed, and the semifinal losers play a 3rd place game.
 * Before the regular season ends it's a projection from the current standings.
 */
export function bracket(l: League) {
  const info = playoffInfo(l);
  const locked = !!l.playoff_seeds;
  const seeds: number[] = locked ? JSON.parse(l.playoff_seeds!) : standings(l.id).slice(0, info.teams).map((t) => t.id);
  const seedOf = (id: number | null) => (id == null ? null : seeds.indexOf(id) + 1);
  const ms = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND kind IS NOT NULL", l.id);
  const find = (week: number, kind: string, slot: number) => ms.find((m) => m.week === week && m.kind === kind && (m.slot ?? 0) === slot) ?? null;
  const decide = (s: Omit<BracketSlot, "winner" | "loser">): BracketSlot => {
    if (s.a == null || s.b == null) return { ...s, winner: s.a ?? s.b, loser: null };
    const m = s.matchup;
    if (!m?.final) return { ...s, winner: null, loser: null };
    const home = m.home_score ?? 0, away = m.away_score ?? 0;
    const higher = (seedOf(m.home_team_id) ?? 99) < (seedOf(m.away_team_id) ?? 99) ? m.home_team_id : m.away_team_id;
    const winner = home > away ? m.home_team_id : away > home ? m.away_team_id : higher;
    return { ...s, winner, loser: winner === m.home_team_id ? m.away_team_id : m.home_team_id };
  };
  const size = 2 ** info.rounds;
  const order = bracketOrder(Math.max(2, size));
  const rounds: BracketSlot[][] = [];
  for (let r = 1; r <= info.rounds; r++) {
    const week = l.season_weeks + r;
    const prev = rounds[r - 2];
    const count = size / 2 ** r;
    const slots: BracketSlot[] = [];
    for (let j = 0; j < count; j++) {
      const a = r === 1 ? (seeds[order[2 * j] - 1] ?? null) : prev[2 * j].winner;
      const b = r === 1 ? (seeds[order[2 * j + 1] - 1] ?? null) : prev[2 * j + 1].winner;
      slots.push(decide({ a, b, seedA: seedOf(a), seedB: seedOf(b), matchup: locked ? find(week, "playoff", j) : null }));
    }
    rounds.push(slots);
  }
  let third: BracketSlot | null = null;
  if (info.rounds >= 2) {
    const semis = rounds[info.rounds - 2];
    const a = semis[0]?.loser ?? null, b = semis[1]?.loser ?? null;
    third = decide({ a, b, seedA: seedOf(a), seedB: seedOf(b), matchup: locked ? find(info.lastWeek, "consolation", 0) : null });
  }
  return { ...info, seeds, projected: !locked, rounds, third, champion: rounds.at(-1)?.[0]?.winner ?? null };
}

/** Create any playoff matchups for this round whose two teams are known (higher seed at home). */
function schedulePlayoffRound(l: League, round: number) {
  const b = bracket(l);
  const week = l.season_weeks + round;
  const add = (s: BracketSlot, kind: string, slot: number) => {
    if (s.a == null || s.b == null || s.matchup) return;
    const [home, away] = (s.seedA ?? 99) <= (s.seedB ?? 99) ? [s.a, s.b] : [s.b, s.a];
    run("INSERT INTO matchups (league_id, week, home_team_id, away_team_id, kind, slot) VALUES (?, ?, ?, ?, ?, ?)", l.id, week, home, away, kind, slot);
  };
  b.rounds[round - 1]?.forEach((s, j) => add(s, "playoff", j));
  if (round === b.rounds.length && b.third) add(b.third, "consolation", 0);
}

export function canView(l: League, userId: number) {
  return !!l.is_public || !!userTeam(l.id, userId) || l.commissioner_id === userId;
}
