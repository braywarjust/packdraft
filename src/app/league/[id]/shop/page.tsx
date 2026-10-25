import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getLeague, userTeam } from "@/lib/league";
import { leagueBrand } from "@/lib/branding";
import { acquisitions, tradeCount } from "@/lib/activity";
import { SHOP_ITEMS, shopPrice, type ShopItem } from "@/lib/shop";
import { COINS_PER_POINT } from "@/lib/economy-rate";
import { buyShopItemAction } from "../../../actions";
import { ShopCounter } from "./ShopCounter";
import { Coins } from "@/components/Coins";
import { AcqIcon, ACQ_COLOR, TradeIcon, TRADE_COLOR } from "@/components/Currencies";
import { TeamBadge } from "@/components/TeamBadge";

export const metadata = { title: "League Shop" };

/**
 * League Shop (Update 4.0-R): spend the Fantasy Coins your players' fantasy points earn on extra Acquisitions (adds) and
 * Trades for your team in this league, at the prices the League Manager sets in Settings.
 */
export default async function LeagueShop({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  const me = userTeam(l.id, u.id);
  const b = leagueBrand(l);
  const used = me ? acquisitions(l, me.id) : null;
  const trades = me ? tradeCount(l, me.id) : 0;
  // "2 per matchup (1 left)", or "none" when the League Manager allows no free ones.
  const free = (max: number, per: string, usedN: number | null) => (max === 0 ? `none ${per}` : `${max} ${per}${usedN != null ? ` (${Math.max(0, max - usedN)} left)` : ""}`);
  const freeAdds = [
    l.acq_per_week != null && free(l.acq_per_week, "per matchup", used?.week ?? null),
    l.acq_per_season != null && free(l.acq_per_season, "per season", used?.season ?? null),
  ].filter(Boolean).join(" · ");
  const freeTrades = l.trade_limit != null ? free(l.trade_limit, "per season", me ? trades : null) : "";
  const recent = all<{ team: string; item: ShopItem; qty: number; price: number; created_at: number }>(
    `SELECT t.name team, s.item, s.qty, s.price, s.created_at FROM shop_purchases s JOIN teams t ON t.id = s.team_id
     WHERE s.league_id = ? ORDER BY s.id DESC LIMIT 8`, l.id);
  const buy = buyShopItemAction.bind(null, l.id);

  return (
    <div className="space-y-6">
      {/* Hero, in the league's colours */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: `linear-gradient(115deg, ${b.color} 0%, ${b.color} 50%, ${b.alt} 140%)` }}>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
        <div className="shop-sheen pointer-events-none absolute inset-y-0 w-1/4" />
        <div className="relative flex flex-wrap items-center gap-3 p-4 sm:gap-5 sm:p-7">
          <div className="hidden shrink-0 sm:block"><TeamBadge brand={b} size={64} className="drop-shadow-xl" /></div>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">{b.abbr} · League Shop</p>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">League Shop</h2>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Every fantasy point your starters score pays {COINS_PER_POINT} Fantasy Coins. Save them up for the moves that win weeks.
            </p>
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-px bg-black/20">
          {([
            ["Fantasy Coins", <Coins key="c" n={u.coins} live />],
            ["Acquisitions", <span key="a" className="inline-flex items-center gap-1.5"><AcqIcon />{me?.acq_tokens ?? 0}</span>],
            ["Trades", <span key="t" className="inline-flex items-center gap-1.5"><TradeIcon />{me?.trade_tokens ?? 0}</span>],
          ] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k} className="bg-black/25 px-4 py-3 backdrop-blur sm:px-5">
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="truncate font-mono text-base font-black text-white sm:text-xl">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {!me ? (
        <div className="card p-6 text-center text-sm text-zinc-500">Join {l.name} to shop here.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {(["acquisition", "trade"] as const).map((k) => (
            <ShopCounter key={k} item={k} name={SHOP_ITEMS[k].name} blurb={SHOP_ITEMS[k].blurb} price={shopPrice(l, k)}
              owned={k === "acquisition" ? me.acq_tokens ?? 0 : me.trade_tokens ?? 0} coins={u.coins} buy={buy} />
          ))}
        </div>
      )}

      {/* How it works */}
      <section className="card space-y-4 p-5 text-sm">
        <h2 className="text-lg font-bold">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-ink/40 p-3">
            <p className="mb-1 text-xs font-black uppercase tracking-wider text-brand">Earn coins</p>
            <p className="text-zinc-600">Your starters pay {COINS_PER_POINT} Fantasy Coins per fantasy point when each game goes final. Coins work in every league and on the Sportsbook.</p>
          </div>
          <div className="rounded-xl bg-ink/40 p-3">
            <p className={`mb-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${ACQ_COLOR}`}><AcqIcon /> Acquisitions</p>
            <p className="text-zinc-600">
              {freeAdds ? <>Free adds here: <b className="text-white">{freeAdds}</b>. </> : <>This league has no add limit yet, so adds are free until the League Manager sets one. </>}
              Past your free adds, each player you add uses one Acquisition.
            </p>
          </div>
          <div className="rounded-xl bg-ink/40 p-3">
            <p className={`mb-1 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider ${TRADE_COLOR}`}><TradeIcon /> Trades</p>
            <p className="text-zinc-600">
              {freeTrades ? <>Free trades here: <b className="text-white">{freeTrades}</b>. </> : <>This league has no trade limit yet, so trades are free until the League Manager sets one. </>}
              Past that, each trade uses one Trade from every team that&apos;s over its limit.
            </p>
          </div>
        </div>
        <p className="text-xs text-zinc-500">They belong to your team in {l.name}, never expire, and are used automatically when you need one. The League Manager sets the prices and free limits in Settings.</p>
      </section>

      {recent.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Recent buys</h2>
          <ul className="divide-y divide-line/60 text-sm">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate"><b className="text-white">{r.team}</b> bought {r.qty} {r.qty === 1 ? SHOP_ITEMS[r.item].name : SHOP_ITEMS[r.item].plural}</span>
                <span className="shrink-0 text-xs text-zinc-500"><Coins n={r.qty * r.price} /> · {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
