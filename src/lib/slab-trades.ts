// Slab Trades (Update 3.0): any manager can offer another manager a swap of slabs, with Pack Points on either side if
// they like. One side can be empty, so a trade can also be a gift ("here, have this Curry") or a buy ("500 PP for your
// Curry"). The other manager accepts or declines; the proposer can cancel while it's pending.
//
// Accepting re-checks everything inside one transaction: every slab must still be owned by the same manager, unused,
// not equipped for a game, and both balances must cover their Pack Points. Then the slabs change owner (cards.user_id)
// and the Pack Points move. A slab keeps its card id, rarity, serial, multiplier and stat boost when it moves, so it
// can't be duplicated and its buff goes with it (it still only works on its own player). Featured-on-profile pins of
// moved slabs are dropped. Any other pending trade that included a moved slab can no longer happen and is voided.
//
// Slabs equipped for a game can't be traded until they're unequipped (same rule as re-rolls). Test accounts only trade
// with test accounts, so test pulls and the tester balance never leak into real collections.
import { all, one, run, tx, type User } from "./db";
import { cardsWhere, type Card } from "./packs-server";
import { ensureBoosts } from "./boost";
import { postSystem } from "./league";
import { RARITIES, fmtCoins } from "./packs";

export const TRADE_MAX_SLABS = 12;
export const TRADE_MAX_PP = 1_000_000;

let ready = false;
export function ensureSlabTrades() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS slab_trades (
    id INTEGER PRIMARY KEY, from_user_id INTEGER NOT NULL, to_user_id INTEGER NOT NULL,
    give TEXT NOT NULL, get TEXT NOT NULL, give_pp INTEGER NOT NULL DEFAULT 0, get_pp INTEGER NOT NULL DEFAULT 0,
    note TEXT, status TEXT NOT NULL DEFAULT 'pending', reason TEXT, created_at INTEGER NOT NULL, decided_at INTEGER)`);
  run("CREATE INDEX IF NOT EXISTS idx_slab_trades_to ON slab_trades(to_user_id, status)");
  run("CREATE INDEX IF NOT EXISTS idx_slab_trades_from ON slab_trades(from_user_id, status)");
  ready = true;
}

export type SlabTradeRow = {
  id: number; from_user_id: number; to_user_id: number; give: string; get: string; give_pp: number; get_pp: number;
  note: string | null; status: "pending" | "accepted" | "declined" | "cancelled" | "void"; reason: string | null; created_at: number; decided_at: number | null;
};

const ids = (s: string) => JSON.parse(s) as number[];
const cleanIds = (a: number[]) => [...new Set(a.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
const cleanPp = (n: number) => Math.max(0, Math.min(TRADE_MAX_PP, Math.floor(Number(n) || 0)));

/** Why a slab can't be traded by this manager right now, or null when it can. */
function slabProblem(cardId: number, ownerId: number): string | null {
  const c = one<{ user_id: number; sold: number; name: string | null }>(
    "SELECT c.user_id, c.sold, COALESCE(s.player, p.name) name FROM cards c LEFT JOIN slabs s ON s.id = c.slab_id LEFT JOIN players p ON p.id = COALESCE(s.player_id, c.player_id) WHERE c.id = ?", cardId);
  if (!c || c.user_id !== ownerId || c.sold !== 0) return `${c?.name ?? "A slab"} is no longer in that collection`;
  if (one("SELECT 1 FROM slab_equips WHERE consumed_at IS NULL AND card_id = ?", cardId)) return `${c.name ?? "A slab"} is equipped for a game. Unequip it first`;
  return null;
}

function checkSide(cards: number[], ownerId: number) {
  for (const id of cards) {
    const p = slabProblem(id, ownerId);
    if (p) throw new Error(p);
  }
}

/** Offer a trade. `give` are your card ids, `get` are theirs; either can be empty but not both (counting Pack Points). */
export function proposeSlabTrade(from: User, toUserId: number, give: number[], get: number[], givePp: number, getPp: number, note: string) {
  ensureSlabTrades();
  ensureBoosts();
  const to = one<User>("SELECT * FROM users WHERE id = ?", toUserId);
  if (!to) throw new Error("Pick a manager to trade with");
  if (to.id === from.id) throw new Error("You can't trade with yourself");
  if (!!to.is_tester !== !!from.is_tester) throw new Error("Test accounts can only trade with test accounts");
  const g = cleanIds(give), w = cleanIds(get);
  const gp = cleanPp(givePp), wp = cleanPp(getPp);
  if (g.length > TRADE_MAX_SLABS || w.length > TRADE_MAX_SLABS) throw new Error(`Up to ${TRADE_MAX_SLABS} slabs a side`);
  if (!g.length && !w.length) throw new Error("Add at least one slab");
  if (!g.length && !gp) throw new Error("Offer a slab or some Pack Points for theirs");
  checkSide(g, from.id);
  checkSide(w, to.id);
  if (gp > from.coins) throw new Error(`You only have ${fmtCoins(from.coins)}`);
  const r = run(`INSERT INTO slab_trades (from_user_id, to_user_id, give, get, give_pp, get_pp, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    from.id, to.id, JSON.stringify(g), JSON.stringify(w), gp, wp, note.trim().slice(0, 200) || null, Date.now());
  return Number(r.lastInsertRowid);
}

/** Pending trades that touch any of these cards can't go through any more. */
function voidTradesWith(cardIds: number[], exceptId: number, reason: string) {
  if (!cardIds.length) return;
  const set = new Set(cardIds);
  for (const t of all<SlabTradeRow>("SELECT * FROM slab_trades WHERE status = 'pending' AND id != ?", exceptId))
    if ([...ids(t.give), ...ids(t.get)].some((id) => set.has(id)))
      run("UPDATE slab_trades SET status = 'void', reason = ?, decided_at = ? WHERE id = ?", reason, Date.now(), t.id);
}

/** Accept (the receiver), decline (the receiver) or cancel (the proposer) a pending trade. */
export function respondSlabTrade(me: User, tradeId: number, accept: boolean) {
  ensureSlabTrades();
  ensureBoosts();
  const done = tx(() => {
    const t = one<SlabTradeRow>("SELECT * FROM slab_trades WHERE id = ?", tradeId);
    if (!t || (t.to_user_id !== me.id && t.from_user_id !== me.id)) throw new Error("Trade not found");
    if (t.status !== "pending") throw new Error(`That trade was already ${t.status === "void" ? "called off" : t.status}`);
    if (!accept) {
      run("UPDATE slab_trades SET status = ?, decided_at = ? WHERE id = ?", t.to_user_id === me.id ? "declined" : "cancelled", Date.now(), t.id);
      return null;
    }
    if (t.to_user_id !== me.id) throw new Error("Only the other manager can accept");
    const give = ids(t.give), get = ids(t.get);
    try {
      checkSide(give, t.from_user_id);
      checkSide(get, t.to_user_id);
      const bal = (id: number) => one<{ coins: number }>("SELECT coins FROM users WHERE id = ?", id)!.coins;
      if (t.give_pp > bal(t.from_user_id)) throw new Error("They no longer have the Pack Points they offered");
      if (t.get_pp > bal(t.to_user_id)) throw new Error(`This trade asks for ${fmtCoins(t.get_pp)} and you don't have enough`);
    } catch (e) {
      // A slab moved or got equipped, or a balance dropped: this trade can't happen as offered. Pack Points shortfalls
      // on your own side don't void it, so you can top up and accept.
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("you don't have enough")) run("UPDATE slab_trades SET status = 'void', reason = ?, decided_at = ? WHERE id = ?", msg, Date.now(), t.id);
      return { error: msg };
    }
    const move = run.bind(null, "UPDATE cards SET user_id = ? WHERE id = ? AND user_id = ? AND sold = 0");
    for (const id of give) if (Number(move(t.to_user_id, id, t.from_user_id).changes) !== 1) throw new Error("A slab moved mid-trade. Try again");
    for (const id of get) if (Number(move(t.from_user_id, id, t.to_user_id).changes) !== 1) throw new Error("A slab moved mid-trade. Try again");
    const moved = [...give, ...get];
    if (moved.length) {
      run(`DELETE FROM profile_featured WHERE card_id IN (${moved.map(() => "?").join(",")})`, ...moved);
    }
    const pp = (amt: number, payer: number, payee: number) => {
      if (!amt) return;
      run("UPDATE users SET coins = coins - ? WHERE id = ?", amt, payer);
      run("UPDATE users SET coins = coins + ? WHERE id = ?", amt, payee);
    };
    pp(t.give_pp, t.from_user_id, t.to_user_id);
    pp(t.get_pp, t.to_user_id, t.from_user_id);
    run("UPDATE slab_trades SET status = 'accepted', decided_at = ? WHERE id = ?", Date.now(), t.id);
    voidTradesWith(moved, t.id, "A slab in this trade was traded away");
    return t;
  });
  if (done && "error" in done) throw new Error(done.error);
  if (done) announce(done);
}

/** Shout accepted trades into every league both managers play in. */
function announce(t: SlabTradeRow) {
  const from = one<User>("SELECT * FROM users WHERE id = ?", t.from_user_id)!;
  const to = one<User>("SELECT * FROM users WHERE id = ?", t.to_user_id)!;
  if (from.is_tester || to.is_tester) return;
  const desc = (cardIds: number[], pp: number) => {
    const cs = cardIds.length ? cardsWhere(`c.id IN (${cardIds.map(() => "?").join(",")}) ORDER BY c.value DESC`, ...cardIds) : [];
    const parts = cs.slice(0, 3).map((c) => `${RARITIES[c.rarity].label} ${c.name}`);
    if (cs.length > 3) parts.push(`${cs.length - 3} more`);
    if (pp) parts.push(fmtCoins(pp));
    return parts.join(", ");
  };
  const a = desc(ids(t.give), t.give_pp), b = desc(ids(t.get), t.get_pp);
  const msg = !b ? `${from.name} gifted ${to.name} ${a}!` : !a ? `${to.name} gave ${from.name} ${b}!` : `Slab trade: ${from.name} sent ${to.name} ${a} for ${b}.`;
  for (const l of all<{ league_id: number }>(
    "SELECT DISTINCT a.league_id FROM teams a JOIN teams b ON b.league_id = a.league_id WHERE a.user_id = ? AND b.user_id = ?", from.id, to.id))
    postSystem(l.league_id, msg);
}

export type SlabTrade = SlabTradeRow & { fromName: string; toName: string; giveCards: Card[]; getCards: Card[]; problem: string | null };

/** Your trades: pending ones first, then the latest history. */
export function myTrades(userId: number, limit = 30): SlabTrade[] {
  ensureSlabTrades();
  const rows = all<SlabTradeRow & { from_name: string; to_name: string }>(
    `SELECT t.*, f.name from_name, u.name to_name FROM slab_trades t JOIN users f ON f.id = t.from_user_id JOIN users u ON u.id = t.to_user_id
     WHERE t.from_user_id = ? OR t.to_user_id = ? ORDER BY (t.status = 'pending') DESC, t.id DESC LIMIT ?`, userId, userId, limit);
  return rows.map((r) => {
    const load = (s: string) => {
      const list = ids(s);
      if (!list.length) return [];
      const byId = new Map(cardsWhere(`c.id IN (${list.map(() => "?").join(",")})`, ...list).map((c) => [c.id, c]));
      return list.map((id) => byId.get(id)).filter((c): c is Card => !!c);
    };
    // A pending offer whose slabs moved or got equipped since: say so up front instead of on Accept.
    let problem: string | null = null;
    if (r.status === "pending") {
      ensureBoosts();
      for (const [list, owner] of [[ids(r.give), r.from_user_id], [ids(r.get), r.to_user_id]] as const)
        for (const id of list) problem ??= slabProblem(id, owner);
    }
    return { ...r, fromName: r.from_name, toName: r.to_name, giveCards: load(r.give), getCards: load(r.get), problem };
  });
}

/** Offers waiting on this manager (for the badge). */
export function incomingTradeCount(userId: number) {
  ensureSlabTrades();
  return one<{ n: number }>("SELECT COUNT(*) n FROM slab_trades WHERE to_user_id = ? AND status = 'pending'", userId)?.n ?? 0;
}

/** Slabs a manager can put in a trade right now (unused, not equipped). */
export function tradableCards(userId: number) {
  ensureBoosts();
  return cardsWhere("c.user_id = ? AND c.sold = 0 AND c.id NOT IN (SELECT card_id FROM slab_equips WHERE consumed_at IS NULL) ORDER BY c.value DESC", userId);
}
