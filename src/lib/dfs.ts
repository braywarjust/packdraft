import { all, one, run, tx, Player, Game } from "./db";
import { hash, rng, simGame, partial, gameProgress, simClock } from "./sim";
import { fpts, Line, eligible, statLine } from "./scoring";
import { PACKS, PACK_BY_ID } from "./packs";
import { awardPack } from "./league";
import { etDate } from "./nba/espn";

export const SALARY_CAP = 50_000;
export const DFS_SLOTS = ["G1", "G2", "F1", "F2", "C", "UTIL1", "UTIL2", "UTIL3"];
const DFS_SCORING = "dk";

export type Contest = {
  id: number; name: string; creator_id: number; entry_fee: number; prize_pack: string; max_entries: number;
  status: string; started_at: number | null; sim_minutes: number; mode: string; slate_date: string | null; created_at: number;
  /** Solo runs: one player vs the slate. `par` is the best projected lineup under the cap; `reward_pack` what they won. */
  solo: number; par: number | null; reward_pack: string | null; points: number | null;
};

// ---------- Solo runs ----------
//
// Daily Fantasy is single-player: once a day you build a lineup against a slate (tonight's real games, or an
// instant simulated slate) and the combined points (= Pack Points) pay out the best ceiling you reach.
// Ceilings are set relative to the slate's par so small and big slates are equally fair. Calibrated on 6,000
// simulated lineups (actual/par): 0.96 ≈ 40th pct, 1.03 ≈ 60th, 1.08 ≈ 78th, 1.16 ≈ 90th, 1.21 ≈ 96th,
// 1.29 ≈ 99th, 1.37 ≈ 99.8th. Expected payout ≈ 150 Pack Points a run, so it tops up the league, not replaces it.
export const CEILINGS: { ratio: number; pack: string }[] = [
  { ratio: 0.96, pack: "rookie" },
  { ratio: 1.03, pack: "starter" },
  { ratio: 1.08, pack: "pro" },
  { ratio: 1.16, pack: "allpro" },
  { ratio: 1.21, pack: "hof" },
  { ratio: 1.29, pack: "goat" },
  { ratio: 1.37, pack: "megacase" },
];
export const ceilings = (par: number) => CEILINGS.map((c) => ({ ...c, points: Math.round((par * c.ratio) / 5) * 5 }));
export const rewardFor = (par: number, points: number) => [...ceilings(par)].reverse().find((c) => points >= c.points) ?? null;

let soloReady = false;
/** Adds the solo-run columns to databases created before Daily Fantasy went single-player. */
export function ensureSolo() {
  if (soloReady) return;
  const cols = all<{ name: string }>("PRAGMA table_info(dfs_contests)").map((c) => c.name);
  if (!cols.includes("solo")) run("ALTER TABLE dfs_contests ADD COLUMN solo INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("par")) run("ALTER TABLE dfs_contests ADD COLUMN par REAL");
  if (!cols.includes("reward_pack")) run("ALTER TABLE dfs_contests ADD COLUMN reward_pack TEXT");
  if (!cols.includes("points")) run("ALTER TABLE dfs_contests ADD COLUMN points REAL");
  soloReady = true;
}

/** The user's solo run started today (ET), if any. */
export function todaysRun(userId: number) {
  ensureSolo();
  const runs = all<Contest>("SELECT * FROM dfs_contests WHERE solo = 1 AND creator_id = ? ORDER BY id DESC LIMIT 5", userId);
  const today = etDate();
  return runs.find((c) => etDate(c.created_at) === today) ?? null;
}

/** Best projected lineup under the cap, by many seeded greedy builds (deterministic per slate). */
export function slatePar(c: Pick<Contest, "id" | "mode" | "slate_date">): number {
  const players = contestPlayers(c as Contest);
  const r = rng(`par:${c.mode}:${c.slate_date ?? c.id}`);
  // Keep enough cap for the cheapest player who can fill each remaining slot.
  const cheapest = DFS_SLOTS.map((slot) => Math.min(...players.filter((p) => eligible(slot, p.pos)).map(salary)));
  const reserveAfter = DFS_SLOTS.map((_, i) => cheapest.slice(i + 1).reduce((a, b) => a + b, 0));
  let best = 0;
  for (let attempt = 0; attempt < 2500; attempt++) {
    const picked: Player[] = [];
    let spent = 0;
    for (let i = 0; i < DFS_SLOTS.length; i++) {
      const opts = players.filter((p) => eligible(DFS_SLOTS[i], p.pos) && !picked.includes(p) && spent + salary(p) + reserveAfter[i] <= SALARY_CAP);
      if (!opts.length) break;
      const p = opts[Math.floor(Math.pow(r(), 5) * Math.min(opts.length, 60))];
      picked.push(p);
      spent += salary(p);
    }
    if (picked.length === DFS_SLOTS.length) best = Math.max(best, picked.reduce((s, p) => s + p.proj_dk, 0));
  }
  return Math.round(best * 10) / 10;
}
export type Entry = { id: number; contest_id: number; user_id: number | null; bot_name: string | null; lineup: string; points: number | null; rank: number | null; user_name?: string };

export function salary(p: { proj_dk: number }) {
  // ~$3.5k for end-of-bench guys up to ~$11k for MVP types.
  const t = Math.min(1, Math.max(0, (p.proj_dk - 8) / 50));
  return Math.round((3500 + Math.pow(t, 1.15) * 7600) / 100) * 100;
}

export const slateGames = (c: Contest) =>
  c.slate_date ? all<Game>("SELECT * FROM games WHERE date_et = ? ORDER BY start_ts", c.slate_date) : [];

/** Players available for a contest: everyone on a team playing that day (real) or the whole pool (sim). */
export function contestPlayers(c: Contest) {
  if (c.mode === "sim") return all<Player>("SELECT * FROM players WHERE active = 1 ORDER BY proj_dk DESC LIMIT 300");
  const teams = new Set(slateGames(c).flatMap((g) => [g.home, g.away]));
  return all<Player>("SELECT * FROM players WHERE active = 1 ORDER BY proj_dk DESC").filter((p) => teams.has(p.team));
}

export function contestProgress(c: Contest) {
  if (c.mode !== "sim" || !c.started_at) return 0;
  return Math.min(1, (Date.now() - c.started_at) / (c.sim_minutes * 60_000));
}

export function validateLineup(c: Contest, lineup: number[]) {
  if (lineup.length !== DFS_SLOTS.length || new Set(lineup).size !== lineup.length) throw new Error("Fill every slot with different players");
  const pool = new Map(contestPlayers(c).map((p) => [p.id, p]));
  let total = 0;
  lineup.forEach((id, i) => {
    const p = pool.get(id);
    if (!p || !eligible(DFS_SLOTS[i], p.pos)) throw new Error(`Invalid player for ${DFS_SLOTS[i]}`);
    total += salary(p);
  });
  if (total > SALARY_CAP) throw new Error("Over the salary cap");
}

const BOT_NAMES = ["SharpShooter99", "GrinderGary", "StackMaster", "ChalkEater", "TiltedTom", "LateSwapLarry", "PuntGod", "OptimizerBot"];
export function botLineup(c: Contest, seed: string): number[] {
  const r = rng(seed);
  const players = contestPlayers(c);
  for (let attempt = 0; attempt < 300; attempt++) {
    const picked: number[] = [];
    let spent = 0;
    for (let i = 0; i < DFS_SLOTS.length; i++) {
      const slotsLeft = DFS_SLOTS.length - i - 1;
      const opts = players.filter((p) => eligible(DFS_SLOTS[i], p.pos) && !picked.includes(p.id) && spent + salary(p) + slotsLeft * 3500 <= SALARY_CAP);
      if (!opts.length) break;
      const p = opts[Math.floor(Math.pow(r(), 1.6) * Math.min(opts.length, 40))];
      picked.push(p.id);
      spent += salary(p);
    }
    if (picked.length === DFS_SLOTS.length) return picked;
  }
  throw new Error("Could not build a bot lineup for this slate");
}

export function addBots(c: Contest, count: number) {
  const existing = all<Entry>("SELECT * FROM dfs_entries WHERE contest_id = ?", c.id).length;
  const n = Math.min(count, c.max_entries - existing);
  for (let i = 0; i < n; i++) {
    const k = existing + i;
    run("INSERT INTO dfs_entries (contest_id, user_id, bot_name, lineup, created_at) VALUES (?, NULL, ?, ?, ?)",
      c.id, BOT_NAMES[k % BOT_NAMES.length] + (k >= BOT_NAMES.length ? `_${k}` : ""), JSON.stringify(botLineup(c, `bot:${c.id}:${k}`)), Date.now());
  }
}

/** One player's line in a contest right now. */
function playerNow(c: Contest, p: Player): { line: Line | null; g: number; clock: string } {
  if (c.mode === "sim") {
    const start = [0, 0.25, 0.5][hash(`k:${p.team}:${c.id}`) % 3];
    const g = gameProgress(start, contestProgress(c) * 0.72);
    return { line: g > 0 ? partial(simGame(p, `D${c.id}`), g, `${p.id}:D${c.id}`) : null, g, clock: simClock(g) };
  }
  const game = one<Game>("SELECT * FROM games WHERE date_et = ? AND (home = ? OR away = ?)", c.slate_date, p.team, p.team);
  if (!game) return { line: null, g: 0, clock: "No game" };
  const row = one<{ stats: string }>("SELECT stats FROM player_games WHERE game_id = ? AND player_id = ?", game.id, p.id);
  const g = game.state === "post" ? 1 : game.state === "in" ? Math.min(0.99, (game.period - 1 + 0.5) / 4) : 0;
  const clock = game.state === "pre" ? new Date(game.start_ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : game.detail ?? "";
  return { line: row ? (JSON.parse(row.stats) as Line) : game.state === "post" ? null : null, g, clock };
}

export function entryLive(c: Contest, e: Entry) {
  const ids: number[] = JSON.parse(e.lineup);
  let pts = 0, remain = 0;
  const players = ids.map((id, i) => {
    const p = one<Player>("SELECT * FROM players WHERE id = ?", id)!;
    const now = playerNow(c, p);
    const s = now.line ? fpts(now.line, DFS_SCORING) : 0;
    pts += s;
    remain += p.proj_dk * (1 - now.g);
    return { slot: DFS_SLOTS[i], id: p.id, name: p.name, pos: p.pos, team: p.team, headshot: p.headshot, pts: s, g: now.g, clock: now.clock, line: now.line ? statLine(now.line) : "", salary: salary(p) };
  });
  return { pts: Math.round(pts * 100) / 100, remain, players };
}

export function settleContest(contestId: number) {
  tx(() => {
    const c = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", contestId)!;
    if (c.status !== "live") return;
    const entries = all<Entry>("SELECT * FROM dfs_entries WHERE contest_id = ?", c.id).map((e) => ({ ...e, points: entryLive(c, e).pts }));
    entries.sort((a, b) => b.points - a.points);
    if (c.solo) {
      const e = entries[0];
      const won = e && c.par ? rewardFor(c.par, e.points) : null;
      if (e) run("UPDATE dfs_entries SET points = ?, rank = 1 WHERE id = ?", e.points, e.id);
      if (e?.user_id && won) awardPack(e.user_id, won.pack, `Daily Fantasy · ${Math.round(e.points)} pts`);
      run("UPDATE dfs_contests SET status = 'final', points = ?, reward_pack = ? WHERE id = ?", e?.points ?? 0, won?.pack ?? null, c.id);
      return;
    }
    const idx = PACKS.findIndex((p) => p.id === c.prize_pack);
    const prizes = [c.prize_pack, PACKS[Math.max(0, idx - 1)].id, "rookie"];
    entries.forEach((e, i) => {
      run("UPDATE dfs_entries SET points = ?, rank = ? WHERE id = ?", e.points, i + 1, e.id);
      if (e.user_id && i < prizes.length) awardPack(e.user_id, prizes[i], `DFS: ${c.name} · ${["1st", "2nd", "3rd"][i]} place`);
    });
    run("UPDATE dfs_contests SET status = 'final' WHERE id = ?", c.id);
  });
}

/** Lock real contests at the first tip-off and settle them once every game (and box score) is final. */
export function tickContest(c: Contest) {
  if (c.mode === "sim") {
    if (c.status === "live" && contestProgress(c) >= 1) settleContest(c.id);
    return;
  }
  const games = slateGames(c);
  if (!games.length) return;
  if (c.status === "open" && games.some((g) => g.state !== "pre" || g.start_ts <= Date.now())) {
    const n = one<{ n: number }>("SELECT COUNT(*) n FROM dfs_entries WHERE contest_id = ?", c.id)?.n ?? 0;
    if (!c.solo && n < 2) addBots(c, 2 - n);
    run("UPDATE dfs_contests SET status = 'live', started_at = ? WHERE id = ?", Date.now(), c.id);
    c = { ...c, status: "live" };
  }
  if (c.status === "live" && games.every((g) => g.state === "post" && g.box_at)) settleContest(c.id);
}
export const maybeSettle = tickContest;

export const prizeLadder = (c: Contest) => {
  const idx = PACKS.findIndex((p) => p.id === c.prize_pack);
  return [PACK_BY_ID[c.prize_pack], PACKS[Math.max(0, idx - 1)], PACK_BY_ID.rookie];
};
