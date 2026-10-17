import { all, one, run, tx, League, Team, Player, Matchup, Game } from "./db";
import { leagueSeed, rng, simSchedule, gameProgress, simGame, partial, simClock } from "./sim";
import { STARTERS, ROSTER_MAX, eligible, fpts, statLine, Line, slotLabel } from "./scoring";
import { addDays, etDate, weekday, dayLabel } from "./nba/espn";
import { PACK_BY_ID } from "./packs";
import { creditGame, weekRate } from "./economy";
import { cardMultiplier, ensureBoosts, teamBoosts } from "./boost";

export { STARTERS, ROSTER_MAX, eligible };
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
export function awardPack(userId: number, packType: string, source: string) {
  run("INSERT INTO user_packs (user_id, pack_type, source, created_at) VALUES (?, ?, ?, ?)", userId, packType, source, Date.now());
}

export const projFor = (p: { proj: number; proj_dk: number }, scoring: string) => (scoring === "dk" ? p.proj_dk : p.proj);
const isOut = (p: { injury: string | null }) => !!p.injury && /^out/i.test(p.injury);

// ---------- Weeks ----------

/** Real leagues: week 1 runs from start_date to the first Sunday at least 4 days later, then Monday–Sunday. */
export function weekRange(l: League, week: number): [string, string] {
  let s = l.start_date ?? etDate();
  let e = addDays(s, 4);
  while (weekday(e) !== 0) e = addDays(e, 1);
  for (let w = 2; w <= week; w++) {
    s = addDays(e, 1);
    e = addDays(s, 6);
  }
  return [s, e];
}

/** Sim leagues: how far through the simulated week we are (0..1). */
export function weekProgress(l: League) {
  if (l.mode !== "sim" || !l.week_started_at) return 0;
  return Math.min(1, (Date.now() - l.week_started_at) / (l.sim_minutes * 60_000));
}

// ---------- Per-player games ----------

export type PGame = { key: string; state: "pre" | "in" | "post"; label: string; clock: string; line: Line | null; order: number; date?: string };

function realGames(p: { id: number; team: string }, from: string, to: string): PGame[] {
  const games = all<Game & { stats: string | null }>(
    `SELECT g.*, pg.stats FROM games g LEFT JOIN player_games pg ON pg.game_id = g.id AND pg.player_id = ?
     WHERE g.date_et BETWEEN ? AND ? AND (g.home = ? OR g.away = ?) AND g.season_type IN (2, 3) ORDER BY g.start_ts`,
    p.id, from, to, p.team, p.team);
  return games.map((g) => {
    const home = g.home === p.team;
    const started = g.state !== "pre" || g.start_ts <= Date.now();
    return {
      key: g.date_et, date: g.date_et, order: g.start_ts,
      state: g.state === "pre" && started ? "in" : (g.state as PGame["state"]),
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
      state: g <= 0 ? "pre" : g >= 1 ? "post" : "in",
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
    const pick = pool.find((p) => !assign.has(p.id) && eligible(slot, p.pos) && !isOut(p));
    if (pick) { assign.set(pick.id, slot); taken.add(slot); }
  }
  for (const p of players) if (!assign.has(p.id)) assign.set(p.id, "BN");
  for (const [pid, slot] of assign) run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", slot, teamId, pid);
}

export function moveToSlot(l: League, teamId: number, playerId: number, slot: string) {
  const players = roster(teamId);
  const p = players.find((x) => x.id === playerId);
  if (!p) throw new Error("Player not on roster");
  if (!eligible(slot, p.pos)) throw new Error(`A ${p.pos} can't play ${slotLabel(slot)}`);
  if (isLocked(l, p)) throw new Error(`${p.name} is locked (his game has started)`);
  if (slot !== "BN") {
    const occupant = players.find((x) => x.slot === slot);
    if (occupant) {
      if (isLocked(l, occupant)) throw new Error(`${occupant.name} is locked (his game has started)`);
      const back = eligible(p.slot, occupant.pos) ? p.slot : "BN";
      run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", back, teamId, occupant.id);
    }
  }
  run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", slot, teamId, playerId);
}

// ---------- Slab boosts ----------

/** The game a boost set right now would apply to: today's game (real) or his next unplayed game (sim). */
export function boostableGame(l: League, p: Player) {
  const games = playerGames(l, p, l.current_week).filter((g) => g.state === "pre");
  if (l.mode === "sim") return games[0] ?? null;
  const today = etDate();
  return games.find((g) => g.key === today) ?? null;
}

/** Back one rostered player with one of the manager's slabs for his next game. One boost per team per day. */
export function setBoost(l: League, teamId: number, userId: number, playerId: number, cardId: number) {
  ensureBoosts();
  if (l.draft_status !== "done" || l.champion_team_id) throw new Error("Boosts open once the season is under way");
  const p = roster(teamId).find((x) => x.id === playerId);
  if (!p) throw new Error("He's not on your roster");
  const g = boostableGame(l, p);
  if (!g) throw new Error(l.mode === "sim" ? `${p.name} has no games left this week` : `${p.name} doesn't have a game left today`);
  const existing = one<{ player_id: number }>("SELECT player_id FROM league_boosts WHERE team_id = ? AND day_key = ?", teamId, g.key);
  if (existing && existing.player_id !== playerId) {
    const other = one<Player>("SELECT * FROM players WHERE id = ?", existing.player_id);
    const og = other && playerGames(l, other, l.current_week).find((x) => x.key === g.key);
    if (og && og.state !== "pre") throw new Error(`Today's boost is locked on ${other!.name}: his game has started`);
  }
  const clash = one<{ id: number }>("SELECT 1 id FROM league_boosts WHERE user_id = ? AND day_key = ? AND card_id = ? AND team_id != ?", userId, g.key, cardId, teamId);
  if (clash) throw new Error("That slab is already boosting in another league today");
  const { mult, own } = cardMultiplier(cardId, userId, playerId);
  run(`INSERT INTO league_boosts (league_id, team_id, user_id, day_key, player_id, card_id, mult, own, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (team_id, day_key) DO UPDATE SET player_id = excluded.player_id, card_id = excluded.card_id, mult = excluded.mult, own = excluded.own, created_at = excluded.created_at`,
    l.id, teamId, userId, g.key, playerId, cardId, mult, own ? 1 : 0, Date.now());
  return { player: p.name, mult, own };
}

export function clearBoost(l: League, teamId: number, playerId: number) {
  ensureBoosts();
  const p = one<Player>("SELECT * FROM players WHERE id = ?", playerId);
  if (!p) return;
  const pre = new Set(playerGames(l, p, l.current_week).filter((g) => g.state === "pre").map((g) => g.key));
  const rows = all<{ day_key: string }>("SELECT day_key FROM league_boosts WHERE team_id = ? AND player_id = ?", teamId, playerId);
  for (const r of rows) if (pre.has(r.day_key)) run("DELETE FROM league_boosts WHERE team_id = ? AND day_key = ?", teamId, r.day_key);
}

// ---------- Scoring ----------

export type LivePlayer = {
  id: number; name: string; pos: string; team: string; slot: string; headshot: string | null; injury: string | null;
  pts: number; proj: number; played: number; left: number; total: number; locked: boolean;
  now: { label: string; clock: string; state: string; line: string; pts: number } | null;
  /** Slab boost on his current/next game this week (live), if any. */
  boost: { mult: number; own: boolean; slabId: number; dayKey: string; state: string } | null;
};

/**
 * Score a team's week. Each player-game uses the slot he was in when that game started
 * (frozen into daily_slots), so mid-week lineup changes and drops are handled correctly.
 *
 * Points are Pack Points: fantasy points × the week's market rate (see economy.ts). When a started
 * player's game goes final, the manager is paid those Pack Points (once).
 */
export function teamWeek(l: League, teamId: number, week: number) {
  const players = roster(teamId);
  const active = week === l.current_week && l.draft_status === "done" && !l.champion_team_id;
  const rate = l.draft_status === "done" ? weekRate(l.id, week) : 1;
  const owner = one<{ user_id: number | null }>("SELECT user_id FROM teams WHERE id = ?", teamId)?.user_id ?? null;
  const boosts = teamBoosts(teamId);
  const boostMult = (playerId: number, key: string) => boosts.get(`${playerId}|${key}`)?.mult ?? 1;
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
        const raw = fpts(g.line, l.scoring) * boostMult(p.id, g.key);
        pts += raw * rate;
        if (g.state === "post") pay(p.id, g.key, raw);
      }
    }
    const proj = projFor(p, l.scoring) * rate;
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
      id: p.id, name: p.name, pos: p.pos, team: p.team, slot: p.slot, headshot: p.headshot, injury: p.injury,
      pts: Math.round(pts * 100) / 100, proj, played, left, total: games.length, locked: isLocked(l, p),
      now: cur ? { label: cur.label, clock: cur.clock, state: cur.state, line: cur.line ? statLine(cur.line) : "", pts: cur.line ? Math.round(fpts(cur.line, l.scoring) * boostMult(p.id, cur.key) * rate * 100) / 100 : 0 } : null,
      boost: b && bGame ? { mult: b.mult, own: !!b.own, slabId: b.slab_id, dayKey: b.day_key, state: bGame.state } : null,
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
      const raw = fpts(g.line, l.scoring) * boostMult(pid, key);
      ghost += raw * rate;
      if (g.state === "post") pay(pid, key, raw);
    }
  }
  const order = (s: string) => (s === "BN" ? 99 : STARTERS.indexOf(s as (typeof STARTERS)[number]));
  rows.sort((a, b) => order(a.slot) - order(b.slot) || b.proj - a.proj);
  const score = Math.round((rows.reduce((s, p) => s + p.pts, 0) + ghost) * 100) / 100;
  return { players: rows, score, remain, variance, projected, rate };
}

/** Freeze lineups for started games, finish weeks, and keep CPU lineups fresh. Safe to call often. */
export function tickLeague(leagueId: number) {
  const l = getLeague(leagueId);
  if (!l || l.draft_status !== "done" || l.champion_team_id) return;
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
  // The season this league plays in: the first regular-season game from ~8 months back onward.
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
  run("UPDATE leagues SET draft_status = 'done', pick_deadline = NULL, start_date = COALESCE(start_date, ?) WHERE id = ?", start, leagueId);
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
    const teamMap = new Map(leagueTeams(l.id).map((t) => [t.id, t]));
    const scores: { teamId: number; pts: number }[] = [];
    const lines: string[] = [];
    for (const m of ms) {
      const hs = teamWeek(fresh, m.home_team_id, week).score;
      const as = teamWeek(fresh, m.away_team_id, week).score;
      run("UPDATE matchups SET home_score = ?, away_score = ?, final = 1 WHERE id = ?", hs, as, m.id);
      scores.push({ teamId: m.home_team_id, pts: hs }, { teamId: m.away_team_id, pts: as });
      const res = (tid: number, me: number, opp: number) => {
        const col = me > opp ? "wins" : me < opp ? "losses" : "ties";
        run(`UPDATE teams SET ${col} = ${col} + 1, points_for = points_for + ?, points_against = points_against + ? WHERE id = ?`, me, opp, tid);
        const t = teamMap.get(tid)!;
        if (t.user_id) awardPack(t.user_id, me >= opp ? fresh.reward_win : fresh.reward_loss, `${fresh.name} · Week ${week} ${me > opp ? "win" : me < opp ? "loss" : "tie"}`);
      };
      res(m.home_team_id, hs, as);
      res(m.away_team_id, as, hs);
      const [w, lo] = hs >= as ? [m.home_team_id, m.away_team_id] : [m.away_team_id, m.home_team_id];
      lines.push(`**${teamMap.get(w)!.name}** ${Math.max(hs, as).toFixed(1)} def. ${teamMap.get(lo)!.name} ${Math.min(hs, as).toFixed(1)}`);
    }
    if (!scores.length) return;
    scores.sort((a, b) => b.pts - a.pts);
    const top = teamMap.get(scores[0].teamId)!;
    if (top.user_id) awardPack(top.user_id, fresh.reward_top, `${fresh.name} · Week ${week} top score`);
    const bottom = teamMap.get(scores[scores.length - 1].teamId)!;
    postSystem(l.id, `Week ${week} final!\n${lines.join("\n")}\n\nTop score: ${top.name} (${scores[0].pts.toFixed(1)}) earns a ${PACK_BY_ID[fresh.reward_top]?.name}.\nWinners got a ${PACK_BY_ID[fresh.reward_win]?.name ?? "pack"}.\nBasement: ${bottom.name} (${scores[scores.length - 1].pts.toFixed(1)}). Roast accordingly.`);
    if (week >= fresh.season_weeks) {
      const champ = all<Team>("SELECT * FROM teams WHERE league_id = ? ORDER BY wins DESC, points_for DESC LIMIT 1", l.id)[0];
      run("UPDATE leagues SET week_started_at = NULL, champion_team_id = ? WHERE id = ?", champ.id, l.id);
      if (champ.user_id) awardPack(champ.user_id, "goat", `${fresh.name} · Champion`);
      postSystem(l.id, `${champ.name} wins the ${fresh.name} championship and a GOAT Pack!`);
    } else {
      run("UPDATE leagues SET week_started_at = NULL, current_week = current_week + 1 WHERE id = ?", l.id);
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

export function standings(leagueId: number) {
  return all<Team>("SELECT * FROM teams WHERE league_id = ? ORDER BY wins DESC, ties DESC, points_for DESC", leagueId);
}

export function canView(l: League, userId: number) {
  return !!l.is_public || !!userTeam(l.id, userId) || l.commissioner_id === userId;
}
