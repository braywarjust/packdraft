import { all, one, run, tx, League, Team, Player, Matchup } from "./db";
import { finalStats, gameProgress, leagueSeed, liveStats, score, weekProj, statLine, gameClock, oppRank, matchupGrade, rng } from "./sim";
import { PACK_BY_ID } from "./packs";

export const STARTERS = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX", "DST"] as const;
export const ROSTER_MAX = 14;
export const ROUNDS = 14;

export function eligible(slot: string, pos: string) {
  if (slot === "BN") return true;
  if (slot === "FLEX") return pos === "RB" || pos === "WR" || pos === "TE";
  return slot.replace(/\d$/, "") === pos;
}

export const getLeague = (id: number) => one<League>("SELECT * FROM leagues WHERE id = ?", id);
export const leagueTeams = (leagueId: number) => all<Team>("SELECT * FROM teams WHERE league_id = ? ORDER BY id", leagueId);
export const userTeam = (leagueId: number, userId: number) =>
  one<Team>("SELECT * FROM teams WHERE league_id = ? AND user_id = ?", leagueId, userId);

export type RosterPlayer = Player & { slot: string };
export function roster(teamId: number) {
  return all<RosterPlayer>(
    "SELECT p.*, r.slot FROM roster r JOIN players p ON p.id = r.player_id WHERE r.team_id = ? ORDER BY p.adp",
    teamId,
  );
}

export function postSystem(leagueId: number, body: string) {
  run("INSERT INTO messages (league_id, user_id, kind, body, created_at) VALUES (?, NULL, 'system', ?, ?)", leagueId, body, Date.now());
}

export function awardPack(userId: number, packType: string, source: string) {
  run("INSERT INTO user_packs (user_id, pack_type, source, created_at) VALUES (?, ?, ?, ?)", userId, packType, source, Date.now());
}

// ---------- Week timing & locks ----------

export function weekProgress(l: League) {
  if (!l.week_started_at) return 0;
  return Math.min(1, (Date.now() - l.week_started_at) / (l.sim_minutes * 60_000));
}
export function isLocked(l: League, p: { team: string }) {
  if (!l.week_started_at) return false;
  return gameProgress(p, leagueSeed(l.id, l.current_week), weekProgress(l)) > 0;
}

// ---------- Lineups ----------

export function autoLineup(l: League, teamId: number) {
  const seed = leagueSeed(l.id, l.current_week);
  const players = roster(teamId);
  const locked = new Set(players.filter((p) => isLocked(l, p)).map((p) => p.id));
  const assign = new Map<number, string>();
  const taken = new Set<string>();
  for (const p of players) if (locked.has(p.id)) { assign.set(p.id, p.slot); taken.add(p.slot); }
  const pool = players.filter((p) => !locked.has(p.id)).sort((a, b) => weekProj(b, seed) - weekProj(a, seed));
  for (const slot of STARTERS) {
    if (taken.has(slot)) continue;
    const pick = pool.find((p) => !assign.has(p.id) && eligible(slot, p.pos));
    if (pick) { assign.set(pick.id, slot); taken.add(slot); }
  }
  for (const p of players) if (!assign.has(p.id)) assign.set(p.id, "BN");
  for (const [pid, slot] of assign) run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", slot, teamId, pid);
}

export function moveToSlot(l: League, teamId: number, playerId: number, slot: string) {
  const players = roster(teamId);
  const p = players.find((x) => x.id === playerId);
  if (!p) throw new Error("Player not on roster");
  if (!eligible(slot, p.pos)) throw new Error(`${p.pos} can't play ${slot}`);
  if (isLocked(l, p)) throw new Error(`${p.name}'s game has started`);
  if (slot !== "BN") {
    const occupant = players.find((x) => x.slot === slot);
    if (occupant) {
      if (isLocked(l, occupant)) throw new Error(`${occupant.name}'s game has started`);
      const back = eligible(p.slot, occupant.pos) ? p.slot : "BN";
      run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", back, teamId, occupant.id);
    }
  }
  run("UPDATE roster SET slot = ? WHERE team_id = ? AND player_id = ?", slot, teamId, playerId);
}

// ---------- Scoring ----------

export type LivePlayer = {
  id: number; name: string; pos: string; team: string; slot: string; pts: number; proj: number;
  g: number; clock: string; line: string; grade: string;
};
export function teamWeek(l: League, teamId: number, week: number, progress: number) {
  const seed = leagueSeed(l.id, week);
  const players = roster(teamId);
  const out: LivePlayer[] = players.map((p) => {
    const { stats, g } = liveStats(p, seed, progress);
    return {
      id: p.id, name: p.name, pos: p.pos, team: p.team, slot: p.slot,
      pts: score(stats, p.pos, l.scoring), proj: weekProj(p, seed), g,
      clock: gameClock(g, p, seed, progress), line: statLine(stats, p.pos), grade: matchupGrade(oppRank(p, seed)),
    };
  });
  const order = (s: string) => (s === "BN" ? 99 : STARTERS.indexOf(s as (typeof STARTERS)[number]));
  out.sort((a, b) => order(a.slot) - order(b.slot) || b.proj - a.proj);
  const starters = out.filter((p) => p.slot !== "BN");
  const total = starters.reduce((s, p) => s + p.pts, 0);
  const remain = starters.reduce((s, p) => s + p.proj * (1 - p.g), 0);
  const variance = starters.reduce((s, p) => s + Math.pow(p.proj * 0.5, 2) * (1 - p.g), 0);
  const projected = starters.reduce((s, p) => s + p.proj, 0);
  return { players: out, score: Math.round(total * 100) / 100, remain, variance, projected };
}

function finalTeamScore(l: League, teamId: number, week: number) {
  const seed = leagueSeed(l.id, week);
  return roster(teamId)
    .filter((p) => p.slot !== "BN")
    .reduce((s, p) => s + score(finalStats(p, seed), p.pos, l.scoring), 0);
}

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
export const picksMade = (leagueId: number) =>
  (one<{ n: number }>("SELECT COUNT(*) n FROM draft_picks WHERE league_id = ?", leagueId)?.n ?? 0);

export function availablePlayers(leagueId: number) {
  return all<Player>(
    "SELECT * FROM players WHERE id NOT IN (SELECT player_id FROM roster WHERE league_id = ?) AND id NOT IN (SELECT player_id FROM keepers WHERE league_id = ?) ORDER BY adp",
    leagueId, leagueId,
  );
}

function bestFor(leagueId: number, teamId: number, round: number, jitter: () => number) {
  const mine = roster(teamId);
  const count = (pos: string) => mine.filter((p) => p.pos === pos).length;
  const pool = availablePlayers(leagueId);
  const queued = all<{ player_id: number }>("SELECT player_id FROM draft_queue WHERE team_id = ? ORDER BY rank", teamId);
  const avail = new Set(pool.map((p) => p.id));
  const q = queued.find((x) => avail.has(x.player_id));
  if (q) return q.player_id;
  // Picks this team still makes itself (future keeper rounds are already spoken for).
  const futureKeepers = one<{ n: number }>("SELECT COUNT(*) n FROM keepers WHERE team_id = ? AND round > ?", teamId, round)?.n ?? 0;
  const left = ROUNDS - round + 1 - futureKeepers;
  const needs = (["QB", "RB", "WR", "TE", "DST"] as const).filter((pos) => count(pos) < (pos === "RB" || pos === "WR" ? 2 : 1));
  const ok = (p: Player) => {
    if (needs.length >= left) return needs.includes(p.pos as (typeof needs)[number]);
    if (p.pos === "DST") return count("DST") === 0 && round >= ROUNDS - 2;
    if (p.pos === "QB") return count("QB") === 0 || (count("QB") === 1 && round >= 10);
    if (p.pos === "TE") return count("TE") === 0 || round >= 11;
    return true;
  };
  const candidates = pool.filter(ok).slice(0, 4);
  if (!candidates.length) return pool[0]?.id;
  // CPU drafters usually take the top guy but occasionally reach for a nearby one.
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
    const pid = bestFor(l.id, teamId, round, rng(`draft:${l.id}:${overall}`));
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
  postSystem(l.id, "🏈 The draft is LIVE! Get in the draft room.");
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
    arr.splice(1, 0, arr.pop()!); // rotate all but the first
  }
  return out;
}

export function finishDraft(leagueId: number) {
  const l = getLeague(leagueId)!;
  run("UPDATE leagues SET draft_status = 'done', pick_deadline = NULL WHERE id = ?", leagueId);
  const teams = leagueTeams(leagueId);
  for (const t of teams) autoLineup(l, t.id);
  for (const [w, h, a] of schedule(teams.map((t) => t.id), l.season_weeks))
    run("INSERT INTO matchups (league_id, week, home_team_id, away_team_id) VALUES (?, ?, ?, ?)", leagueId, w, h, a);
  postSystem(leagueId, "✅ Draft complete! Set your Week 1 lineups. Weekly winners earn mystery packs.");
}

// ---------- Weeks, rewards, waivers ----------

export function startWeek(l: League) {
  if (l.draft_status !== "done") throw new Error("Finish the draft first");
  if (l.week_started_at) throw new Error("Week already in progress");
  if (l.champion_team_id) throw new Error("Season is over");
  processWaivers(l.id);
  for (const t of leagueTeams(l.id)) if (t.is_cpu) autoLineup(l, t.id);
  run("UPDATE leagues SET week_started_at = ? WHERE id = ?", Date.now(), l.id);
  postSystem(l.id, `⏱️ Week ${l.current_week} kicked off! Games are live.`);
}

export function maybeFinalize(leagueId: number) {
  const l = getLeague(leagueId);
  if (l && l.week_started_at && weekProgress(l) >= 1) finalizeWeek(l);
}

export function finalizeWeek(l: League) {
  tx(() => {
    const fresh = getLeague(l.id)!;
    if (!fresh.week_started_at) return;
    const week = fresh.current_week;
    const ms = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ?", l.id, week);
    const teamMap = new Map(leagueTeams(l.id).map((t) => [t.id, t]));
    const scores: { teamId: number; pts: number }[] = [];
    const lines: string[] = [];
    for (const m of ms) {
      const hs = Math.round(finalTeamScore(fresh, m.home_team_id, week) * 100) / 100;
      const as = Math.round(finalTeamScore(fresh, m.away_team_id, week) * 100) / 100;
      run("UPDATE matchups SET home_score = ?, away_score = ?, final = 1 WHERE id = ?", hs, as, m.id);
      scores.push({ teamId: m.home_team_id, pts: hs }, { teamId: m.away_team_id, pts: as });
      const res = (tid: number, me: number, opp: number) => {
        const col = me > opp ? "wins" : me < opp ? "losses" : "ties";
        run(`UPDATE teams SET ${col} = ${col} + 1, points_for = points_for + ?, points_against = points_against + ? WHERE id = ?`, me, opp, tid);
        const t = teamMap.get(tid)!;
        if (t.user_id) {
          const pack = me >= opp ? fresh.reward_win : fresh.reward_loss;
          awardPack(t.user_id, pack, `${fresh.name} · Week ${week} ${me > opp ? "win" : me < opp ? "loss" : "tie"}`);
        }
      };
      res(m.home_team_id, hs, as);
      res(m.away_team_id, as, hs);
      const [w, lo] = hs >= as ? [m.home_team_id, m.away_team_id] : [m.away_team_id, m.home_team_id];
      lines.push(`**${teamMap.get(w)!.name}** ${Math.max(hs, as).toFixed(2)} def. ${teamMap.get(lo)!.name} ${Math.min(hs, as).toFixed(2)}`);
    }
    scores.sort((a, b) => b.pts - a.pts);
    const top = teamMap.get(scores[0].teamId)!;
    if (top.user_id) awardPack(top.user_id, fresh.reward_top, `${fresh.name} · Week ${week} top score`);
    const bottom = teamMap.get(scores[scores.length - 1].teamId)!;
    const winPack = PACK_BY_ID[fresh.reward_win]?.name ?? "pack";
    postSystem(l.id, `🏁 Week ${week} final!\n${lines.join("\n")}\n\n👑 Top score: ${top.name} (${scores[0].pts.toFixed(2)}) earns a ${PACK_BY_ID[fresh.reward_top]?.name}.\n🎁 Winners got a ${winPack}.\n🗑️ Basement: ${bottom.name} (${scores[scores.length - 1].pts.toFixed(2)}). Roast accordingly.`);
    if (week >= fresh.season_weeks) {
      const champ = all<Team>("SELECT * FROM teams WHERE league_id = ? ORDER BY wins DESC, points_for DESC LIMIT 1", l.id)[0];
      run("UPDATE leagues SET week_started_at = NULL, champion_team_id = ? WHERE id = ?", champ.id, l.id);
      if (champ.user_id) awardPack(champ.user_id, "goat", `${fresh.name} · Champion`);
      postSystem(l.id, `🏆 ${champ.name} wins the ${fresh.name} championship and a GOAT Pack!`);
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
  if (!claims.length) return;
  const l = getLeague(leagueId)!;
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
      postSystem(leagueId, `📝 Waivers: ${team.name} claimed ${p.name} for $${c.bid} FAAB.`);
    });
  }
  void l;
}

// ---------- Trades ----------

export function executeTrade(tradeId: number) {
  tx(() => {
    const t = one<{ id: number; league_id: number; from_team_id: number; to_team_id: number; give: string; get: string; status: string }>(
      "SELECT * FROM trades WHERE id = ?", tradeId)!;
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
    postSystem(t.league_id, `🤝 TRADE: ${name(t.from_team_id)} sends ${pn(give)} to ${name(t.to_team_id)} for ${pn(get)}.`);
  });
}

export function standings(leagueId: number) {
  return all<Team>("SELECT * FROM teams WHERE league_id = ? ORDER BY wins DESC, ties DESC, points_for DESC", leagueId);
}

export function canView(l: League, userId: number) {
  return !!l.is_public || !!userTeam(l.id, userId) || l.commissioner_id === userId;
}
