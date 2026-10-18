// Casino originals modelled on Stake's: Crash, Chicken, Blackjack and Mines, played with Pack Points.
// Everything is decided on the server with crypto randomness; the client only sees what has been revealed.
// Odds follow Stake's published maths:
//   Crash     P(crash >= x) = 0.99 / x                       RTP 99%
//   Mines     0.99 x C(25,k) / C(25-mines,k)                 RTP 99%   (3 mines tops out at 2,277x)
//   Chicken   a 26-spot road with hidden cars, 0.98 x C(26,k) / C(26-cars,k)   RTP 98%
//             (Easy 2 cars / 24 lanes, Medium 4 / 22, Hard 6 / 20, Expert 11 / 15: Medium reads 1.15x, 1.37x, 1.65x, 2.00x...)
//   Blackjack infinite deck, dealer peeks and stands on all 17s, blackjack 3:2, insurance 2:1, double any two,
//             split once                                                       RTP ~99.5% with basic strategy
// scripts/casino/sim.mjs re-checks these by simulation.
import crypto from "node:crypto";
import { all, one, run, tx } from "./db";

export const MIN_BET = 0; // 0 = free play: try a game without risking anything (nothing won or lost)
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
  run(`CREATE TABLE IF NOT EXISTS crash_games (id INTEGER PRIMARY KEY, crash REAL NOT NULL, start_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`);
  ready = true;
}

const rand = () => crypto.randomInt(0, 2 ** 47) / 2 ** 47; // uniform in [0, 1)
const floor2 = (x: number) => Math.floor(x * 100 + 1e-9) / 100;

type Round = { id: number; user_id: number; game: Game; stake: number; state: string; status: string; payout: number; multiplier: number; created_at: number };
type User = { id: number; coins: number; is_tester: number };

const user = (id: number) => one<User>("SELECT id, coins, is_tester FROM users WHERE id = ?", id)!;
const balance = (id: number) => user(id).coins;
const byId = (id: number) => one<Round>("SELECT * FROM casino_rounds WHERE id = ?", id)!;

function live(userId: number, game: Game) {
  ensure();
  return one<Round>("SELECT * FROM casino_rounds WHERE user_id = ? AND game = ? AND status = 'live' ORDER BY id DESC LIMIT 1", userId, game) ?? null;
}

/** Take Pack Points for a bet (test accounts play free). */
function charge(userId: number, amount: number, what = "bet") {
  const u = user(userId);
  if (u.is_tester) return;
  if (u.coins < amount) throw new Error(`Not enough Pack Points to ${what}`);
  run("UPDATE users SET coins = coins - ? WHERE id = ?", amount, userId);
}

function checkStake(stake: number) {
  stake = Math.floor(stake);
  if (!(stake >= MIN_BET && stake <= MAX_BET)) throw new Error(`Bets are ${MIN_BET} to ${MAX_BET.toLocaleString("en-US")} Pack Points`);
  return stake;
}

/** Take the stake and open a round. */
function open(userId: number, game: Game, stake: number, state: object) {
  ensure();
  stake = checkStake(stake);
  return tx(() => {
    if (live(userId, game)) throw new Error("Finish your current round first");
    charge(userId, stake);
    const id = Number(run("INSERT INTO casino_rounds (user_id, game, stake, state, created_at) VALUES (?, ?, ?, ?, ?)",
      userId, game, stake, JSON.stringify(state), Date.now()).lastInsertRowid);
    return byId(id);
  });
}

const save = (r: Round, state: object) => run("UPDATE casino_rounds SET state = ? WHERE id = ?", JSON.stringify(state), r.id);

/** Close a round paying a total amount back (0 = lost). Multiplier is recorded against the opening stake. */
function settlePaid(r: Round, paid: number, state: object, status?: "won" | "lost" | "push", multiplier?: number) {
  const payout = Math.min(MAX_WIN, Math.floor(paid));
  const st = status ?? (payout > 0 ? "won" : "lost");
  tx(() => {
    const done = run("UPDATE casino_rounds SET status = ?, payout = ?, multiplier = ?, state = ?, settled_at = ? WHERE id = ? AND status = 'live'",
      st, payout, multiplier ?? (r.stake ? payout / r.stake : 0), JSON.stringify(state), Date.now(), r.id);
    if (Number(done.changes) && payout > 0 && !user(r.user_id).is_tester) run("UPDATE users SET coins = coins + ? WHERE id = ?", payout, r.user_id);
  });
  return payout;
}
// Status comes from the multiplier (not the payout) so free-play rounds still record wins and losses.
const settle = (r: Round, multiplier: number, state: object) => settlePaid(r, r.stake * multiplier, state, multiplier > 0 ? "won" : "lost", multiplier);

// ---------------------------------------------------------------- Crash (shared rounds, like Stake)
// One round at a time for everyone: 6s to place bets, the multiplier climbs as e^(0.07 t) until it crashes, then a
// 3s pause before the next countdown. Crash points are drawn when the round is created and never sent early.

export const CRASH_RATE = 0.07;
export const CRASH_BET_MS = 6000;
export const CRASH_PAUSE_MS = 3000;
export const crashAt = (ms: number) => floor2(Math.exp(CRASH_RATE * (Math.max(0, ms) / 1000)));
const msFor = (m: number) => (Math.log(m) / CRASH_RATE) * 1000;
export const crashPoint = (r = rand()) => Math.min(1000, Math.max(1, Math.floor(99 / (1 - r)) / 100));

type CrashGame = { id: number; crash: number; start_at: number };
type CrashBet = { game: number; auto: number | null; cashed?: number };

/** The current shared game, creating the next one once the last has crashed and paused. */
function crashGame(now = Date.now()): CrashGame {
  ensure();
  const g = one<CrashGame>("SELECT * FROM crash_games ORDER BY id DESC LIMIT 1");
  if (g && now < g.start_at + msFor(g.crash) + CRASH_PAUSE_MS) return g;
  return tx(() => {
    const again = one<CrashGame>("SELECT * FROM crash_games ORDER BY id DESC LIMIT 1");
    if (again && now < again.start_at + msFor(again.crash) + CRASH_PAUSE_MS) return again;
    const id = Number(run("INSERT INTO crash_games (crash, start_at, created_at) VALUES (?, ?, ?)", crashPoint(), now + CRASH_BET_MS, now).lastInsertRowid);
    return one<CrashGame>("SELECT * FROM crash_games WHERE id = ?", id)!;
  });
}

/** Settle a bet once its game has crashed or its auto cash-out has been reached. */
function crashSettle(r: Round, now = Date.now()) {
  const b = JSON.parse(r.state) as CrashBet;
  const g = one<CrashGame>("SELECT * FROM crash_games WHERE id = ?", b.game);
  if (!g || r.status !== "live") return;
  if (b.auto && b.auto <= g.crash && now >= g.start_at + msFor(b.auto)) { b.cashed = b.auto; settle(r, b.auto, b); }
  else if (now >= g.start_at + msFor(g.crash)) settle(r, 0, b);
}

export function crashState(userId: number) {
  const now = Date.now();
  const g = crashGame(now);
  // Settle anything of mine still open from this or earlier games.
  for (const r of all<Round>("SELECT * FROM casino_rounds WHERE user_id = ? AND game = 'crash' AND status = 'live'", userId)) crashSettle(r, now);
  const crashed = now >= g.start_at + msFor(g.crash);
  const phase = now < g.start_at ? "betting" : crashed ? "crashed" : "running";
  const mine = one<Round>("SELECT * FROM casino_rounds WHERE user_id = ? AND game = 'crash' ORDER BY id DESC LIMIT 1", userId);
  const mb = mine ? (JSON.parse(mine.state) as CrashBet) : null;
  const bets = all<{ user_id: number; stake: number; state: string; status: string; payout: number; name: string }>(
    `SELECT r.user_id, r.stake, r.state, r.status, r.payout, u.name FROM casino_rounds r JOIN users u ON u.id = r.user_id
     WHERE r.game = 'crash' AND json_extract(r.state, '$.game') = ? ORDER BY r.stake DESC`, g.id);
  return {
    game: { id: g.id, start: g.start_at, now, phase, crash: crashed ? g.crash : null },
    bet: mine && mb && mb.game === g.id ? { id: mine.id, stake: mine.stake, auto: mb.auto, cashed: mb.cashed ?? null, status: mine.status, payout: mine.payout } : null,
    players: bets.map((b) => ({ name: b.name, me: b.user_id === userId, stake: b.stake, cashed: (JSON.parse(b.state) as CrashBet).cashed ?? null, status: b.status, payout: b.payout })),
    recent: all<{ crash: number }>("SELECT crash FROM crash_games WHERE id < ? ORDER BY id DESC LIMIT 12", g.id).map((x) => x.crash),
    balance: balance(userId),
  };
}

/** Milliseconds until the shared round next changes: bets close, it crashes, or the next round opens. */
export function crashWake(now = Date.now()) {
  const g = crashGame(now);
  const end = g.start_at + msFor(g.crash);
  return now < g.start_at ? g.start_at - now : now < end ? end - now : end + CRASH_PAUSE_MS - now;
}

export function crashBet(userId: number, stake: number, auto: number | null) {
  const g = crashGame();
  if (Date.now() >= g.start_at) throw new Error("Round in progress. Bet on the next one.");
  ensure();
  stake = checkStake(stake);
  tx(() => {
    if (one("SELECT 1 FROM casino_rounds WHERE user_id = ? AND game = 'crash' AND json_extract(state, '$.game') = ?", userId, g.id)) throw new Error("You're already in this round");
    charge(userId, stake);
    const b: CrashBet = { game: g.id, auto: auto && auto >= 1.01 ? Math.min(1000, floor2(auto)) : null };
    run("INSERT INTO casino_rounds (user_id, game, stake, state, created_at) VALUES (?, 'crash', ?, ?, ?)", userId, stake, JSON.stringify(b), Date.now());
  });
  return crashState(userId);
}

export function crashCashout(userId: number) {
  const now = Date.now();
  const r = live(userId, "crash");
  if (!r) throw new Error("No bet in this round");
  crashSettle(r, now);
  const r2 = byId(r.id);
  if (r2.status === "live") {
    const b = JSON.parse(r2.state) as CrashBet;
    const g = one<CrashGame>("SELECT * FROM crash_games WHERE id = ?", b.game)!;
    if (now < g.start_at) throw new Error("The round hasn't started yet");
    const m = crashAt(now - g.start_at);
    if (m < g.crash) { b.cashed = m; settle(r2, m, b); }
    else settle(r2, 0, b);
  }
  return crashState(userId);
}

// ---------------------------------------------------------------- Chicken
// The road has 26 spots with a few cars hidden among them; each Go moves one lane. Surviving k lanes pays
// 0.98 x C(26,k) / C(26-cars,k), exactly like Mines on a straight line.

export const ROAD = 26;
export const CHICKEN_CARS: Record<string, number> = { easy: 2, medium: 4, hard: 6, expert: 11 };
export const CHICKEN_EDGE = 0.02;
export function chickenMult(cars: number, k: number) {
  let m = 1 - CHICKEN_EDGE;
  for (let i = 0; i < k; i++) m *= (ROAD - i) / (ROAD - cars - i);
  return k === 0 ? 1 : floor2(m);
}
type ChickenState = { level: string; step: number; hit: number };

function chickenView(r: Round, s: ChickenState) {
  const cars = CHICKEN_CARS[s.level] ?? 4;
  return { id: r.id, stake: r.stake, level: s.level, step: s.step, lanes: ROAD - cars, status: r.status, payout: r.payout,
    multiplier: chickenMult(cars, s.step), next: chickenMult(cars, s.step + 1), hit: r.status === "live" ? null : s.hit };
}

export function chickenStart(userId: number, stake: number, level: string) {
  const cars = CHICKEN_CARS[level];
  if (!cars) throw new Error("Pick a difficulty");
  // Hide the cars among the 26 spots; the chicken is hit on the first one it reaches.
  const spots = Array.from({ length: ROAD }, (_, i) => i + 1);
  for (let i = spots.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const hit = Math.min(...spots.slice(0, cars));
  const s: ChickenState = { level, step: 0, hit };
  return { round: chickenView(open(userId, "chicken", stake, s), s), balance: balance(userId) };
}

export function chickenStep(userId: number) {
  const r = live(userId, "chicken");
  if (!r) throw new Error("No round running");
  const s = JSON.parse(r.state) as ChickenState;
  const cars = CHICKEN_CARS[s.level];
  s.step++;
  if (s.step >= s.hit) settle(r, 0, s);
  else if (s.step === ROAD - cars) settle(r, chickenMult(cars, s.step), s);
  else save(r, s);
  return chickenState(userId, r.id);
}

export function chickenCashout(userId: number) {
  const r = live(userId, "chicken");
  if (!r) throw new Error("No round running");
  const s = JSON.parse(r.state) as ChickenState;
  if (s.step === 0) throw new Error("Cross at least one lane first");
  settle(r, chickenMult(CHICKEN_CARS[s.level], s.step), s);
  return chickenState(userId, r.id);
}

export function chickenState(userId: number, id?: number) {
  ensure();
  const r = id ? byId(id) : live(userId, "chicken");
  return { round: r ? chickenView(r, JSON.parse(r.state)) : null, balance: balance(userId) };
}

// ---------------------------------------------------------------- Mines

export const TILES = 25;
export function minesMult(mines: number, k: number) {
  let m = 0.99;
  for (let i = 0; i < k; i++) m *= (TILES - i) / (TILES - mines - i);
  return k === 0 ? 1 : floor2(m);
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
  return { round: minesView(open(userId, "mines", stake, s), s), balance: balance(userId) };
}

export function minesPick(userId: number, tile: number | "random") {
  const r = live(userId, "mines");
  if (!r) throw new Error("No round running");
  const s = JSON.parse(r.state) as MinesState;
  if (tile === "random") {
    const open = Array.from({ length: TILES }, (_, i) => i).filter((i) => !s.picks.includes(i));
    tile = open[crypto.randomInt(0, open.length)];
  }
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
  const r = id ? byId(id) : live(userId, "mines");
  return { round: r ? minesView(r, JSON.parse(r.state)) : null, balance: balance(userId) };
}

// ---------------------------------------------------------------- Blackjack

export type Card = { r: number; s: number }; // rank 1-13 (A..K), suit 0-3
type Hand = { cards: Card[]; bet: number; doubled: boolean; done: boolean; result?: string; paid?: number };
type BjState = { hands: Hand[]; active: number; dealer: Card[]; phase: "insurance" | "play" | "done"; insurance: number; insured?: boolean; insurancePaid?: number; split: boolean; result?: string };
const HAND_RETURN: Record<string, number> = { Blackjack: 2.5, Win: 2, "Dealer busts": 2, Push: 1 };
/** Settle a finished hand set. Win/loss is worked out in bet units, so it's right for free (0-point) hands too. */
function bjSettle(r: Round, s: BjState, paid: number) {
  const dBj = isBj(s.dealer);
  let net = 0, units = 0;
  for (const h of s.hands) { const u = h.doubled ? 2 : 1; units += u; net += ((HAND_RETURN[h.result ?? ""] ?? 0) - 1) * u; }
  if (s.insured) net += dBj ? 1 : -0.5;
  settlePaid(r, paid, s, net > 0 ? "won" : net < 0 ? "lost" : "push", r.stake ? undefined : Math.max(0, 1 + net / units));
}
const draw = (): Card => ({ r: crypto.randomInt(1, 14), s: crypto.randomInt(0, 4) });
const cardVal = (c: Card) => (c.r === 1 ? 11 : Math.min(10, c.r));

export function handValue(cards: Card[]) {
  let total = 0, aces = 0;
  for (const c of cards) { total += cardVal(c); if (c.r === 1) aces++; }
  while (total > 21 && aces) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
const isBj = (c: Card[]) => c.length === 2 && handValue(c).total === 21;

function bjView(r: Round, s: BjState) {
  const over = r.status !== "live";
  const dealer = over || s.phase === "done" ? s.dealer : [s.dealer[0]];
  const h = s.hands[s.active];
  const playing = !over && s.phase === "play";
  return {
    id: r.id, stake: r.stake, status: r.status, payout: r.payout, result: s.result ?? null, phase: over ? "done" : s.phase,
    hands: s.hands.map((x, i) => ({ cards: x.cards, value: handValue(x.cards), bet: x.bet, doubled: x.doubled, done: x.done, result: x.result ?? null, active: playing && i === s.active })),
    dealer, dealerValue: handValue(dealer), hidden: dealer.length < s.dealer.length ? 1 : 0, insurance: s.insurance,
    canDouble: playing && h.cards.length === 2 && !h.doubled,
    canSplit: playing && !s.split && h.cards.length === 2 && cardVal(h.cards[0]) === cardVal(h.cards[1]) && h.cards[0].r === h.cards[1].r,
  };
}

/** Dealer plays out (if any hand is still standing), every hand is paid, the round closes. */
function bjFinish(r: Round, s: BjState) {
  const standing = s.hands.some((h) => handValue(h.cards).total <= 21);
  if (standing) while (handValue(s.dealer).total < 17) s.dealer.push(draw());
  const d = handValue(s.dealer).total;
  let paid = s.insurancePaid ?? 0;
  for (const h of s.hands) {
    const p = handValue(h.cards).total;
    if (p > 21) { h.result = "Bust"; h.paid = 0; }
    else if (d > 21) { h.result = "Dealer busts"; h.paid = h.bet * 2; }
    else if (p > d) { h.result = "Win"; h.paid = h.bet * 2; }
    else if (p === d) { h.result = "Push"; h.paid = h.bet; }
    else { h.result = "Lose"; h.paid = 0; }
    paid += h.paid;
  }
  s.phase = "done";
  s.result = s.hands.length > 1 ? s.hands.map((h) => h.result).join(" · ") : s.hands[0].result;
  bjSettle(r, s, paid);
}

/** Dealer checks for blackjack (after insurance is decided when showing an ace). */
function bjPeek(r: Round, s: BjState) {
  const pBj = isBj(s.hands[0].cards), dBj = isBj(s.dealer);
  if (dBj) {
    s.insurancePaid = s.insurance * 3;
    s.hands[0].result = pBj ? "Push" : "Dealer blackjack";
    s.hands[0].paid = pBj ? s.hands[0].bet : 0;
    s.phase = "done";
    s.result = pBj ? "Push: both blackjack" : "Dealer blackjack";
    const paid = s.hands[0].paid + s.insurancePaid;
    return bjSettle(r, s, paid);
  }
  if (pBj) {
    s.hands[0].result = "Blackjack"; s.hands[0].paid = s.hands[0].bet * 2.5; s.phase = "done"; s.result = "Blackjack!";
    return bjSettle(r, s, s.hands[0].paid);
  }
  s.phase = "play";
  save(r, s);
}

export function bjStart(userId: number, stake: number) {
  const s: BjState = { hands: [{ cards: [draw(), draw()], bet: 0, doubled: false, done: false }], active: 0, dealer: [draw(), draw()], phase: "play", insurance: 0, split: false };
  const r = open(userId, "blackjack", stake, s);
  s.hands[0].bet = r.stake;
  if (s.dealer[0].r === 1 && !isBj(s.hands[0].cards)) { s.phase = "insurance"; save(r, s); }
  else bjPeek(r, s);
  return bjState(userId, r.id);
}

export function bjInsurance(userId: number, take: boolean) {
  const r = live(userId, "blackjack");
  if (!r) throw new Error("No hand in play");
  const s = JSON.parse(r.state) as BjState;
  if (s.phase !== "insurance") throw new Error("Insurance isn't on offer");
  if (take) { const cost = Math.floor(r.stake / 2); charge(userId, cost, "take insurance"); s.insurance = cost; s.insured = true; }
  bjPeek(r, s);
  return bjState(userId, r.id);
}

/** Move to the next unfinished hand, or let the dealer play. */
function bjNext(r: Round, s: BjState) {
  const i = s.hands.findIndex((h) => !h.done);
  if (i === -1) return bjFinish(r, s);
  s.active = i;
  save(r, s);
}

export function bjAction(userId: number, action: "hit" | "stand" | "double" | "split") {
  const r = live(userId, "blackjack");
  if (!r) throw new Error("No hand in play");
  const s = JSON.parse(r.state) as BjState;
  if (s.phase !== "play") throw new Error("Decide on insurance first");
  const h = s.hands[s.active];
  if (action === "split") {
    if (s.split || h.cards.length !== 2 || h.cards[0].r !== h.cards[1].r) throw new Error("You can split a pair once");
    charge(userId, h.bet, "split");
    const aces = h.cards[0].r === 1;
    const second: Hand = { cards: [h.cards[1], draw()], bet: h.bet, doubled: false, done: aces };
    h.cards = [h.cards[0], draw()];
    h.done = aces; // split aces get one card each
    s.hands.splice(s.active + 1, 0, second);
    s.split = true;
    if (handValue(h.cards).total === 21) h.done = true;
    if (handValue(second.cards).total === 21) second.done = true;
    return bjNext(r, s), bjState(userId, r.id);
  }
  if (action === "double") {
    if (h.cards.length !== 2 || h.doubled) throw new Error("You can only double on your first two cards");
    charge(userId, h.bet, "double");
    h.bet *= 2; h.doubled = true; h.cards.push(draw()); h.done = true;
  } else if (action === "hit") {
    h.cards.push(draw());
    if (handValue(h.cards).total >= 21) h.done = true;
  } else h.done = true;
  bjNext(r, s);
  return bjState(userId, r.id);
}

export function bjState(userId: number, id?: number) {
  ensure();
  const r = id ? byId(id) : live(userId, "blackjack");
  if (r && r.status === "live") {
    const s = JSON.parse(r.state);
    if (!s.hands) { settlePaid(r, r.stake, s, "push"); return bjState(userId, r.id); } // old-format hand: refund
  }
  return { round: r ? bjView(r, JSON.parse(r.state)) : null, balance: balance(userId) };
}
