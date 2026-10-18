// Casino originals (inspired by Stake's): Crash, Chicken, Blackjack and Mines, played with Pack Points.
// Everything is decided on the server with crypto randomness; the client only ever sees what has been revealed.
// House edge is 1% on Crash, Chicken and Mines (RTP 99%, like Stake's originals) and about 0.5% on Blackjack
// (infinite deck, dealer stands on soft 17, blackjack pays 3:2, double on any two). See scripts/casino-sim.mjs.
import crypto from "node:crypto";
import { all, one, run, tx } from "./db";

export const EDGE = 0.01;
export const MIN_BET = 1;
export const MAX_BET = 10_000;
export const MAX_WIN = 250_000;

export type Game = "crash" | "chicken" | "blackjack" | "mines";

let ready = false;
function ensure() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS casino_rounds (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, game TEXT NOT NULL, stake INTEGER NOT NULL, state TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'live', payout INTEGER NOT NULL DEFAULT 0, multiplier REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, settled_at INTEGER)`);
  run("CREATE INDEX IF NOT EXISTS idx_casino_user ON casino_rounds(user_id, game, status)");
  ready = true;
}

const rand = () => crypto.randomInt(0, 2 ** 47) / 2 ** 47; // uniform in [0, 1)

type Round = { id: number; user_id: number; game: Game; stake: number; state: string; status: string; payout: number; multiplier: number; created_at: number };
type User = { id: number; coins: number; is_tester: number };

function user(id: number) {
  return one<User>("SELECT id, coins, is_tester FROM users WHERE id = ?", id)!;
}
const balance = (id: number) => user(id).coins;

function live(userId: number, game: Game) {
  ensure();
  return one<Round>("SELECT * FROM casino_rounds WHERE user_id = ? AND game = ? AND status = 'live' ORDER BY id DESC LIMIT 1", userId, game) ?? null;
}

/** Take the stake and open a round. Test accounts play for free. */
function open(userId: number, game: Game, stake: number, state: object) {
  ensure();
  stake = Math.floor(stake);
  if (!(stake >= MIN_BET && stake <= MAX_BET)) throw new Error(`Bets are ${MIN_BET} to ${MAX_BET.toLocaleString("en-US")} Pack Points`);
  return tx(() => {
    if (live(userId, game)) throw new Error("Finish your current round first");
    const u = user(userId);
    if (!u.is_tester) {
      if (u.coins < stake) throw new Error("Not enough Pack Points");
      run("UPDATE users SET coins = coins - ? WHERE id = ?", stake, userId);
    }
    const id = Number(run("INSERT INTO casino_rounds (user_id, game, stake, state, created_at) VALUES (?, ?, ?, ?, ?)",
      userId, game, stake, JSON.stringify(state), Date.now()).lastInsertRowid);
    return one<Round>("SELECT * FROM casino_rounds WHERE id = ?", id)!;
  });
}

function save(r: Round, state: object) {
  run("UPDATE casino_rounds SET state = ? WHERE id = ?", JSON.stringify(state), r.id);
}

/** Close a round: multiplier 0 is a loss; anything else pays stake × multiplier (capped). */
function settle(r: Round, multiplier: number, state: object, status: "won" | "lost" | "push" = multiplier > 0 ? "won" : "lost") {
  const payout = Math.min(MAX_WIN, Math.floor(r.stake * multiplier));
  tx(() => {
    const done = run("UPDATE casino_rounds SET status = ?, payout = ?, multiplier = ?, state = ?, settled_at = ? WHERE id = ? AND status = 'live'",
      status, payout, multiplier, JSON.stringify(state), Date.now(), r.id);
    if (Number(done.changes) && payout > 0 && !user(r.user_id).is_tester) run("UPDATE users SET coins = coins + ? WHERE id = ?", payout, r.user_id);
  });
  return payout;
}

export function history(userId: number, game: Game) {
  ensure();
  return all<{ id: number; stake: number; payout: number; multiplier: number; status: string; created_at: number }>(
    "SELECT id, stake, payout, multiplier, status, created_at FROM casino_rounds WHERE user_id = ? AND game = ? AND status != 'live' ORDER BY id DESC LIMIT 12", userId, game);
}

// ---------------------------------------------------------------- Crash
// The multiplier grows as e^(0.07·t) from the round's start. The crash point is drawn up front:
// P(crash ≥ x) = 0.99 / x (so ~1% of rounds bust at 1.00x), capped at 1,000x.

export const CRASH_RATE = 0.07;
export const crashAt = (ms: number) => Math.floor(Math.exp(CRASH_RATE * (ms / 1000)) * 100) / 100;
const msFor = (m: number) => (Math.log(m) / CRASH_RATE) * 1000;
type CrashState = { crash: number; start: number; auto: number | null; cashed?: number };

export function crashPoint(r = rand()) {
  return Math.min(1000, Math.max(1, Math.floor((100 * (1 - EDGE)) / (1 - r)) / 100));
}

function crashView(r: Round, s: CrashState) {
  const over = r.status !== "live";
  return { id: r.id, stake: r.stake, start: s.start, now: Date.now(), auto: s.auto, status: r.status, cashed: s.cashed ?? null,
    crash: over ? s.crash : null, payout: r.payout };
}

/** Settle a running crash round if it has busted or hit its auto cash-out. */
function crashTick(r: Round) {
  const s = JSON.parse(r.state) as CrashState;
  if (r.status !== "live") return { r, s };
  const now = Date.now();
  const autoHit = s.auto && s.auto <= s.crash && now - s.start >= msFor(s.auto);
  if (autoHit) { s.cashed = s.auto!; settle(r, s.auto!, s); }
  else if (now - s.start >= msFor(s.crash)) settle(r, 0, s);
  return { r: one<Round>("SELECT * FROM casino_rounds WHERE id = ?", r.id)!, s };
}

export function crashStart(userId: number, stake: number, auto: number | null) {
  const a = auto && auto >= 1.01 ? Math.min(1000, Math.floor(auto * 100) / 100) : null;
  const s: CrashState = { crash: crashPoint(), start: Date.now() + 600, auto: a };
  const r = open(userId, "crash", stake, s);
  return { round: crashView(r, s), balance: balance(userId) };
}

export function crashStatus(userId: number) {
  const r = live(userId, "crash") ?? one<Round>("SELECT * FROM casino_rounds WHERE user_id = ? AND game = 'crash' ORDER BY id DESC LIMIT 1", userId);
  if (!r) return { round: null, balance: balance(userId) };
  const { r: r2, s } = crashTick(r);
  return { round: crashView(r2, s), balance: balance(userId) };
}

export function crashCashout(userId: number) {
  const r = live(userId, "crash");
  if (!r) throw new Error("No round running");
  const { r: r2, s } = crashTick(r);
  if (r2.status === "live") {
    const m = Math.max(1, crashAt(Date.now() - s.start));
    if (m < s.crash) { s.cashed = m; settle(r2, m, s); }
    else settle(r2, 0, s);
  }
  return crashStatus(userId);
}

export function crashRecent() {
  ensure();
  return all<{ state: string }>("SELECT state FROM casino_rounds WHERE game = 'crash' AND status != 'live' ORDER BY id DESC LIMIT 14")
    .map((x) => (JSON.parse(x.state) as CrashState).crash);
}

// ---------------------------------------------------------------- Chicken
// Cross up to 20 lanes. Each lane is survived with probability p (by difficulty); after k lanes the multiplier is
// 0.99 / p^k. The lane the chicken gets hit on is drawn up front and only revealed on a loss or cash-out.

export const CHICKEN_LANES = 20;
export const CHICKEN_P: Record<string, number> = { easy: 0.96, medium: 0.88, hard: 0.8, expert: 0.7 };
export const chickenMult = (p: number, k: number) => (k === 0 ? 1 : Math.floor(((1 - EDGE) / Math.pow(p, k)) * 100) / 100);
type ChickenState = { level: string; step: number; hit: number };

function chickenView(r: Round, s: ChickenState) {
  return { id: r.id, stake: r.stake, level: s.level, step: s.step, status: r.status, payout: r.payout,
    multiplier: chickenMult(CHICKEN_P[s.level], s.step), hit: r.status === "live" ? null : s.hit };
}

export function chickenStart(userId: number, stake: number, level: string) {
  const p = CHICKEN_P[level];
  if (!p) throw new Error("Pick a difficulty");
  let hit = 1;
  while (hit <= CHICKEN_LANES && rand() < p) hit++; // first lane that gets you (21 = never)
  const s: ChickenState = { level, step: 0, hit };
  const r = open(userId, "chicken", stake, s);
  return { round: chickenView(r, s), balance: balance(userId) };
}

export function chickenStep(userId: number) {
  const r = live(userId, "chicken");
  if (!r) throw new Error("No round running");
  const s = JSON.parse(r.state) as ChickenState;
  s.step++;
  if (s.step >= s.hit) settle(r, 0, s);
  else if (s.step === CHICKEN_LANES) settle(r, chickenMult(CHICKEN_P[s.level], s.step), s);
  else save(r, s);
  return chickenState(userId, r.id);
}

export function chickenCashout(userId: number) {
  const r = live(userId, "chicken");
  if (!r) throw new Error("No round running");
  const s = JSON.parse(r.state) as ChickenState;
  if (s.step === 0) throw new Error("Cross at least one lane first");
  settle(r, chickenMult(CHICKEN_P[s.level], s.step), s);
  return chickenState(userId, r.id);
}

export function chickenState(userId: number, id?: number) {
  ensure();
  const r = id ? one<Round>("SELECT * FROM casino_rounds WHERE id = ?", id) : live(userId, "chicken");
  return { round: r ? chickenView(r, JSON.parse(r.state)) : null, balance: balance(userId) };
}

// ---------------------------------------------------------------- Mines
// 5×5 board with 1-24 mines. After k safe picks the multiplier is 0.99 × C(25,k) / C(25-mines,k).

export const TILES = 25;
export function minesMult(mines: number, k: number) {
  let m = 1 - EDGE;
  for (let i = 0; i < k; i++) m *= (TILES - i) / (TILES - mines - i);
  return k === 0 ? 1 : Math.floor(m * 100) / 100;
}
type MinesState = { mines: number[]; picks: number[]; boom?: number };

function minesView(r: Round, s: MinesState) {
  const over = r.status !== "live";
  return { id: r.id, stake: r.stake, count: s.mines.length, picks: s.picks, status: r.status, payout: r.payout, boom: s.boom ?? null,
    multiplier: minesMult(s.mines.length, s.picks.length), next: minesMult(s.mines.length, s.picks.length + 1), mines: over ? s.mines : null };
}

export function minesStart(userId: number, stake: number, count: number) {
  count = Math.floor(count);
  if (!(count >= 1 && count <= 24)) throw new Error("Pick 1 to 24 mines");
  const cells = Array.from({ length: TILES }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const s: MinesState = { mines: cells.slice(0, count).sort((a, b) => a - b), picks: [] };
  const r = open(userId, "mines", stake, s);
  return { round: minesView(r, s), balance: balance(userId) };
}

export function minesPick(userId: number, tile: number) {
  const r = live(userId, "mines");
  if (!r) throw new Error("No round running");
  const s = JSON.parse(r.state) as MinesState;
  if (!(tile >= 0 && tile < TILES) || s.picks.includes(tile)) throw new Error("Pick another tile");
  s.picks.push(tile);
  if (s.mines.includes(tile)) { s.boom = tile; settle(r, 0, s); }
  else if (s.picks.length === TILES - s.mines.length) settle(r, minesMult(s.mines.length, s.picks.length), s);
  else save(r, s);
  return minesState(userId, r.id);
}

export function minesCashout(userId: number) {
  const r = live(userId, "mines");
  if (!r) throw new Error("No round running");
  const s = JSON.parse(r.state) as MinesState;
  if (!s.picks.length) throw new Error("Pick at least one tile first");
  settle(r, minesMult(s.mines.length, s.picks.length), s);
  return minesState(userId, r.id);
}

export function minesState(userId: number, id?: number) {
  ensure();
  const r = id ? one<Round>("SELECT * FROM casino_rounds WHERE id = ?", id) : live(userId, "mines");
  return { round: r ? minesView(r, JSON.parse(r.state)) : null, balance: balance(userId) };
}

// ---------------------------------------------------------------- Blackjack
// Infinite deck. Dealer peeks for blackjack, stands on soft 17. Blackjack pays 3:2. Double on any first two cards.

export type Card = { r: number; s: number }; // rank 1-13 (A..K), suit 0-3
type BjState = { player: Card[]; dealer: Card[]; doubled: boolean; result?: string };
const draw = (): Card => ({ r: crypto.randomInt(1, 14), s: crypto.randomInt(0, 4) });

export function handValue(cards: Card[]) {
  let total = 0, aces = 0;
  for (const c of cards) { total += c.r === 1 ? 11 : Math.min(10, c.r); if (c.r === 1) aces++; }
  while (total > 21 && aces) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
const isBj = (c: Card[]) => c.length === 2 && handValue(c).total === 21;

function bjView(r: Round, s: BjState) {
  const over = r.status !== "live";
  const dealer = over ? s.dealer : [s.dealer[0]];
  return { id: r.id, stake: r.stake, status: r.status, payout: r.payout, result: s.result ?? null, doubled: s.doubled,
    player: s.player, playerValue: handValue(s.player), dealer, dealerValue: handValue(dealer), hidden: over ? 0 : 1,
    canDouble: !over && s.player.length === 2 && !s.doubled };
}

function bjFinish(r: Round, s: BjState) {
  const p = handValue(s.player).total;
  if (p > 21) { s.result = "Bust"; return settle(r, 0, s); }
  while (true) {
    const d = handValue(s.dealer);
    if (d.total < 17) s.dealer.push(draw());
    else break;
  }
  const d = handValue(s.dealer).total;
  const mult = s.doubled ? 2 : 1;
  if (d > 21) { s.result = "Dealer busts"; return settle(r, 2 * mult, s); }
  if (p > d) { s.result = "You win"; return settle(r, 2 * mult, s); }
  if (p === d) { s.result = "Push"; return settle(r, mult, s, "push"); }
  s.result = "Dealer wins";
  return settle(r, 0, s);
}

export function bjStart(userId: number, stake: number) {
  const s: BjState = { player: [draw(), draw()], dealer: [draw(), draw()], doubled: false };
  const r = open(userId, "blackjack", stake, s);
  const pBj = isBj(s.player), dBj = isBj(s.dealer);
  if (pBj && dBj) { s.result = "Push: both blackjack"; settle(r, 1, s, "push"); }
  else if (pBj) { s.result = "Blackjack!"; settle(r, 2.5, s); }
  else if (dBj) { s.result = "Dealer blackjack"; settle(r, 0, s); }
  return bjState(userId, r.id);
}

export function bjAction(userId: number, action: "hit" | "stand" | "double") {
  const r = live(userId, "blackjack");
  if (!r) throw new Error("No hand in play");
  const s = JSON.parse(r.state) as BjState;
  if (action === "double") {
    if (s.player.length !== 2 || s.doubled) throw new Error("You can only double on your first two cards");
    const u = user(userId);
    if (!u.is_tester) {
      if (u.coins < r.stake) throw new Error("Not enough Pack Points to double");
      run("UPDATE users SET coins = coins - ? WHERE id = ?", r.stake, userId);
    }
    s.doubled = true;
    s.player.push(draw());
    bjFinish(r, s);
  } else if (action === "hit") {
    s.player.push(draw());
    if (handValue(s.player).total >= 21) bjFinish(r, s);
    else save(r, s);
  } else bjFinish(r, s);
  return bjState(userId, r.id);
}

export function bjState(userId: number, id?: number) {
  ensure();
  const r = id ? one<Round>("SELECT * FROM casino_rounds WHERE id = ?", id) : live(userId, "blackjack");
  return { round: r ? bjView(r, JSON.parse(r.state)) : null, balance: balance(userId) };
}
