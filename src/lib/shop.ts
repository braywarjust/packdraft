// League Shop (Update 4.0-R): each league sells two items for Fantasy Coins, at prices its League Manager sets.
// - Acquisition: one add (free agent or waiver claim) past the league's free adds per matchup or season.
// - Trade: one trade past the league's free trades per season (each side of a trade over its limit uses one).
// They belong to your team in that league and are used up automatically when you need them (activity.ts).
import { one, run, topUpTester, tx, ACQ_PRICE, TRADE_PRICE, type League, type Team, type User } from "./db";
import { postSystem } from "./league";

export type ShopItem = "acquisition" | "trade";
export const MAX_QTY = 10;

export const SHOP_ITEMS: Record<ShopItem, { name: string; plural: string; blurb: string; column: "acq_tokens" | "trade_tokens" }> = {
  acquisition: { name: "Acquisition", plural: "Acquisitions", blurb: "One more player add after your free adds run out.", column: "acq_tokens" },
  trade: { name: "Trade", plural: "Trades", blurb: "One more trade after your free trades run out.", column: "trade_tokens" },
};

export const shopPrice = (l: Pick<League, "acq_price" | "trade_price">, item: ShopItem) =>
  item === "acquisition" ? l.acq_price ?? ACQ_PRICE : l.trade_price ?? TRADE_PRICE;

export function buyShopItem(l: League, t: Team, userId: number, item: ShopItem, qty: number) {
  const it = SHOP_ITEMS[item];
  if (!it) throw new Error("Unknown item");
  const n = Math.round(qty);
  if (!(n >= 1 && n <= MAX_QTY)) throw new Error(`Buy between 1 and ${MAX_QTY} at a time`);
  const price = shopPrice(l, item);
  const total = price * n;
  const left = tx(() => {
    topUpTester(userId); // test accounts pay like everyone else, from a large balance that refills
    const u = one<User>("SELECT * FROM users WHERE id = ?", userId)!;
    if (u.coins < total) throw new Error(`You need ${total.toLocaleString("en-US")} Fantasy Coins for that`);
    run("UPDATE users SET coins = coins - ? WHERE id = ?", total, userId);
    run(`UPDATE teams SET ${it.column} = ${it.column} + ? WHERE id = ?`, n, t.id);
    run("INSERT INTO shop_purchases (league_id, team_id, user_id, item, qty, price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", l.id, t.id, userId, item, n, price, Date.now());
    return { coins: u.coins - total, items: (one<Record<string, number>>(`SELECT ${it.column} n FROM teams WHERE id = ?`, t.id)?.n ?? 0) };
  });
  const what = n > 1 ? `${n} ${it.plural}` : `${item === "acquisition" ? "an" : "a"} ${it.name}`;
  postSystem(l.id, `${t.name} bought ${what} in the League Shop.`);
  return { coins: left.coins, owned: left.items, bought: n, item };
}
