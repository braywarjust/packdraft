"use client";

import { XIcon } from "@/components/Icons";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Headshot } from "@/components/Headshot";
import { CoinIcon, Coins } from "@/components/Coins";
import { TeamLogo } from "@/components/TeamLogo";
import { placeBetAction } from "../actions";

type Offer = { key: string; market: string; side: string; line: number | null; odds: number; label: string; playerId?: number; stat?: string };
type Game = {
  id: string; date: string; home: string; away: string; start: number; state: string; detail: string; homeScore: number; awayScore: number;
  open: boolean; live: boolean; winProbHome: number; ml: Offer[]; spread: Offer[]; total: Offer[];
  props: { player: { id: number; name: string; team: string; pos: string; headshot: string | null }; now: Record<string, number>; offers: Offer[] }[];
};
type Leg = { id: number; label: string; odds: number; status: string; market: string; side: string; line: number | null; now: number | null; winning: string | null; game: { matchup: string; away: string; home: string; state: string; detail: string; score: string } | null };
type Bet = { id: number; stake: number; odds: number; status: string; payout: number; live: number; created_at: number; legs: Leg[] };
type Data = { games: Game[]; bets: Bet[]; coins: number };
type Pick = Offer & { game: string; moved?: boolean };

const STAT: Record<string, string> = { pts: "PTS", reb: "REB", ast: "AST", tpm: "3PM", pra: "PRA" };
const am = (d: number) => (d >= 2 ? `+${Math.round((d - 1) * 100)}` : `${Math.round(-100 / (d - 1))}`);
const fmtLine = (n: number | null) => (n == null ? "" : n > 0 ? `+${n}` : `${n}`);
const marketId = (o: Offer) => `${o.key.split("|")[0]}|${o.market}|${o.side}|${o.playerId ?? ""}|${o.stat ?? ""}`;
const time = (ts: number) => new Date(ts).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";

function OddsButton({ o, picked, disabled, onClick, top }: { o: Offer; picked: boolean; disabled: boolean; onClick: () => void; top?: string }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`flex min-w-0 flex-1 flex-col items-center rounded-lg border px-2 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${picked ? "border-brand bg-brand text-white" : "border-line bg-panel2 hover:border-brand/60"}`}>
      {top && <span className={`font-semibold ${picked ? "text-white" : "text-zinc-700"}`}>{top}</span>}
      <span className={`font-mono font-bold ${picked ? "text-white" : "text-emerald-600"}`}>{am(o.odds)}</span>
    </button>
  );
}

export function Sportsbook({ initial }: { initial: Data }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState<"board" | "mine">("board");
  const [slip, setSlip] = useState<Pick[]>([]);
  const [parlay, setParlay] = useState(true);
  const [stake, setStake] = useState(100);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [pending, start] = useTransition();

  const load = async () => {
    const r = await fetch("/api/bets", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return null;
    const j = (await r.json()) as Data;
    setD(j);
    return j;
  };
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const j = await load();
      if (stop) return;
      const live = j?.games.some((g) => g.live) || j?.bets.some((b) => b.status === "open");
      t = setTimeout(tick, live ? 7000 : 30000);
    };
    t = setTimeout(tick, 7000);
    return () => { stop = true; clearTimeout(t); };
  }, []);

  // Keep the slip in sync with live prices: same market → take the new line/odds and flag it.
  const offerIndex = useMemo(() => {
    const m = new Map<string, Offer & { game: string; open: boolean }>();
    for (const g of d.games) for (const o of [...g.ml, ...g.spread, ...g.total, ...g.props.flatMap((p) => p.offers)]) m.set(marketId(o), { ...o, game: `${g.away} @ ${g.home}`, open: g.open });
    return m;
  }, [d]);
  useEffect(() => {
    setSlip((s) => s.flatMap((p) => {
      const cur = offerIndex.get(marketId(p));
      if (!cur || !cur.open) return [];
      if (cur.key === p.key && cur.odds === p.odds) return [p];
      return [{ ...cur, moved: true }];
    }));
  }, [offerIndex]);

  const picked = new Set(slip.map((p) => p.key));
  const toggle = (o: Offer, game: string) => {
    setMsg(null);
    setSlip((s) => {
      if (s.some((p) => p.key === o.key)) return s.filter((p) => p.key !== o.key);
      return [...s.filter((p) => marketId(p) !== marketId(o)), { ...o, game }];
    });
  };
  const legsOdds = slip.reduce((x, p) => x * p.odds, 1);
  const asParlay = parlay && slip.length > 1;
  const totalStake = asParlay ? stake : stake * slip.length;
  const toWin = asParlay ? Math.floor(stake * legsOdds) : slip.reduce((s, p) => s + Math.floor(stake * p.odds), 0);

  const place = () => start(async () => {
    setMsg(null);
    const groups = asParlay ? [slip] : slip.map((p) => [p]);
    let placed = 0;
    for (const g of groups) {
      const r = (await placeBetAction(g.map((p) => ({ key: p.key, odds: p.odds })), stake)) as { error?: string };
      if (r?.error) { setMsg({ t: r.error, bad: true }); await load(); break; }
      placed++;
    }
    if (placed === groups.length) {
      setSlip([]);
      setMsg({ t: placed > 1 ? `${placed} bets placed. Good luck!` : "Bet placed. Good luck!", bad: false });
      setTab("mine");
    }
    await load();
    router.refresh();
  });

  const openBets = d.bets.filter((b) => b.status === "open");

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex gap-2">
          <button onClick={() => setTab("board")} className={tab === "board" ? "tab tab-active" : "tab"}>Games</button>
          <button onClick={() => setTab("mine")} className={tab === "mine" ? "tab tab-active" : "tab"}>My bets{openBets.length ? ` (${openBets.length} open)` : ""}</button>
        </div>

        {tab === "board" && (
          <>
            {d.games.length === 0 && <p className="card p-6 text-zinc-500">No games on the board right now. Check back when the next slate is scheduled.</p>}
            {d.games.map((g) => {
              const label = `${g.away} @ ${g.home}`;
              const hp = Math.round(g.winProbHome * 100);
              return (
                <section key={g.id} className={`card overflow-hidden ${g.live ? "ring-1 ring-red-500/40" : ""}`}>
                  <div className="flex items-center justify-between border-b border-line/60 px-4 py-2 text-xs">
                    <span className="flex items-center gap-2">
                      <TeamLogo team={g.away} size={16} /><TeamLogo team={g.home} size={16} />
                      <span className={g.live ? "font-bold text-red-600" : "text-zinc-500"}>{g.live ? `● LIVE · ${g.detail}` : time(g.start)}</span>
                    </span>
                    {!g.open && <span className="font-semibold text-zinc-400">Betting closed</span>}
                    {g.live && <span className="text-zinc-500">Win prob {g.away} {100 - hp}% · {g.home} {hp}%</span>}
                  </div>
                  <div className="grid grid-cols-[1fr_repeat(3,minmax(0,5.5rem))] items-center gap-2 px-4 py-3 text-sm">
                    <span />
                    <span className="text-center text-[11px] font-semibold uppercase text-zinc-400">Spread</span>
                    <span className="text-center text-[11px] font-semibold uppercase text-zinc-400">Total</span>
                    <span className="text-center text-[11px] font-semibold uppercase text-zinc-400">Moneyline</span>
                    {([["away", 0], ["home", 1]] as const).map(([side, i]) => (
                      <div key={side} className="contents">
                        <span className="flex items-center justify-between gap-2 font-bold">
                          <span className="flex items-center gap-2"><TeamLogo team={side === "away" ? g.away : g.home} size={28} />{side === "away" ? g.away : g.home}</span>
                          {g.state !== "pre" && <span className="font-mono text-lg">{side === "away" ? g.awayScore : g.homeScore}</span>}
                        </span>
                        <OddsButton o={g.spread[i]} top={fmtLine(g.spread[i].line)} picked={picked.has(g.spread[i].key)} disabled={!g.open} onClick={() => toggle(g.spread[i], label)} />
                        <OddsButton o={g.total[i]} top={`${i ? "U" : "O"} ${g.total[i].line}`} picked={picked.has(g.total[i].key)} disabled={!g.open} onClick={() => toggle(g.total[i], label)} />
                        <OddsButton o={g.ml[i]} picked={picked.has(g.ml[i].key)} disabled={!g.open} onClick={() => toggle(g.ml[i], label)} />
                      </div>
                    ))}
                  </div>
                  {g.props.length > 0 && (
                    <div className="border-t border-line/60">
                      <button onClick={() => setOpen(open === g.id ? null : g.id)} className="w-full px-4 py-2 text-left text-xs font-semibold text-brand hover:underline">
                        {open === g.id ? "Hide" : "Show"} player props ({g.props.length} players)
                      </button>
                      {open === g.id && (
                        <div className="space-y-2 px-4 pb-4">
                          {g.props.map((pp) => {
                            const stats = [...new Set(pp.offers.map((o) => o.stat!))];
                            return (
                              <div key={pp.player.id} className="rounded-lg bg-ink/40 p-2">
                                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                                  <Headshot src={pp.player.headshot} name={pp.player.name} size={26} />
                                  {pp.player.name} <TeamLogo team={pp.player.team} size={16} /><span className="text-xs font-normal text-zinc-500">{pp.player.pos} · {pp.player.team}</span>
                                </p>
                                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                                  {stats.map((s) => {
                                    const over = pp.offers.find((o) => o.stat === s && o.side === "over")!;
                                    const under = pp.offers.find((o) => o.stat === s && o.side === "under")!;
                                    return (
                                      <div key={s} className="rounded-md border border-line/60 p-1.5">
                                        <p className="mb-1 flex justify-between text-[10px] font-semibold text-zinc-500">
                                          <span>{STAT[s]} {over.line}</span>{g.state !== "pre" && <span className="text-zinc-700">now {pp.now[s] ?? 0}</span>}
                                        </p>
                                        <div className="flex gap-1">
                                          <OddsButton o={over} top="O" picked={picked.has(over.key)} disabled={!g.open} onClick={() => toggle(over, label)} />
                                          <OddsButton o={under} top="U" picked={picked.has(under.key)} disabled={!g.open} onClick={() => toggle(under, label)} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}

        {tab === "mine" && (
          <div className="space-y-3">
            {d.bets.length === 0 && <p className="card p-6 text-zinc-500">No bets yet. Tap any odds on the board to start a slip.</p>}
            {d.bets.map((b) => {
              const chip = b.status === "open" ? "bg-blue-50 text-brand" : b.status === "won" ? "bg-emerald-50 text-emerald-600" : b.status === "push" ? "bg-zinc-100 text-zinc-600" : "bg-red-50 text-red-600";
              return (
                <div key={b.id} className="card p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">{b.legs.length > 1 ? `${b.legs.length}-leg parlay` : "Single"} <span className="font-mono text-emerald-600">{am(b.odds)}</span>{b.live ? <span className="ml-2 text-[10px] font-bold text-red-600">LIVE BET</span> : null}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${chip}`}>{b.status}</span>
                  </div>
                  <ul className="space-y-2">
                    {b.legs.map((l) => {
                      const prog = l.line && l.now != null && (l.market === "prop" || l.market === "total") ? Math.min(1, l.now / l.line) : null;
                      const tone = l.status === "won" || l.winning === "won" ? "text-emerald-600" : l.status === "lost" || l.winning === "lost" ? "text-red-600" : "text-zinc-500";
                      return (
                        <li key={l.id} className="rounded-lg bg-ink/40 p-2 text-sm">
                          <div className="flex justify-between gap-2">
                            <span className="font-semibold">{l.label}</span>
                            <span className="font-mono text-xs text-zinc-500">{am(l.odds)}</span>
                          </div>
                          <p className="flex flex-wrap items-center gap-x-1 text-xs text-zinc-500">
                            {l.game && <><TeamLogo team={l.game.away} size={14} /><TeamLogo team={l.game.home} size={14} /></>}
                            {l.game?.matchup} · {l.game?.state === "in" ? <span className="text-red-600">● {l.game.detail} · {l.game.score}</span> : l.game?.state === "post" ? `Final · ${l.game.score}` : "Not started"}
                            {l.now != null && (l.market === "prop" || l.market === "total") && <span className={`ml-2 font-semibold ${tone}`}>Now {l.now}{l.line ? ` / ${l.line}` : ""}</span>}
                            {l.status !== "open" && <span className={`ml-2 font-bold uppercase ${tone}`}>{l.status}</span>}
                          </p>
                          {prog != null && l.status === "open" && (
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel2">
                              <div className={`h-full transition-all duration-700 ${l.side === "over" ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${prog * 100}%` }} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 flex justify-between text-sm">
                    <span className="text-zinc-500">Stake <Coins n={b.stake} /></span>
                    <span className="font-semibold">{b.status === "open" ? <>To win <Coins n={Math.floor(b.stake * b.odds)} /></> : b.status === "lost" ? <span className="text-red-600">Lost</span> : <span className="text-emerald-600">Paid <Coins n={b.payout} /></span>}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <aside className="h-fit space-y-3 lg:sticky lg:top-20">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Bet slip</h2>
            {slip.length > 0 && <button onClick={() => setSlip([])} className="text-xs text-zinc-500 hover:text-red-600">Clear</button>}
          </div>
          {slip.length === 0 ? (
            <p className="text-sm text-zinc-500">Tap any odds to add a pick. Add more than one to build a parlay.</p>
          ) : (
            <div className="space-y-3">
              {slip.length > 1 && (
                <div className="flex rounded-lg bg-panel2 p-1 text-xs font-semibold">
                  <button onClick={() => setParlay(true)} className={`flex-1 rounded-md py-1.5 ${parlay ? "bg-brand text-white" : "text-zinc-500"}`}>Parlay</button>
                  <button onClick={() => setParlay(false)} className={`flex-1 rounded-md py-1.5 ${!parlay ? "bg-brand text-white" : "text-zinc-500"}`}>Singles</button>
                </div>
              )}
              <ul className="space-y-2">
                {slip.map((p) => (
                  <li key={p.key} className="rounded-lg bg-ink/40 p-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{p.label}</span>
                      <button onClick={() => setSlip((s) => s.filter((x) => x.key !== p.key))} className="text-zinc-400 hover:text-red-600" aria-label="Remove"><XIcon /></button>
                    </div>
                    <p className="flex justify-between text-xs text-zinc-500">
                      <span className="flex items-center gap-1">{p.game.split(" @ ").map((t) => <TeamLogo key={t} team={t} size={14} />)}{p.game}</span>
                      <span className={`font-mono font-bold ${p.moved ? "text-amber-600" : "text-emerald-600"}`}>{am(p.odds)}{p.moved && " (moved)"}</span>
                    </p>
                  </li>
                ))}
              </ul>
              <div>
                <label className="label">{asParlay ? "Stake" : slip.length > 1 ? "Stake per bet" : "Stake"}</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <CoinIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
                    <input type="number" min={10} max={2500} value={stake} onChange={(e) => setStake(Math.max(0, Number(e.target.value) || 0))} className="input pl-9 font-mono" />
                  </div>
                  {[50, 100, 250].map((n) => <button key={n} onClick={() => setStake(n)} className="btn-ghost px-2 py-1.5 text-xs">{n}</button>)}
                </div>
              </div>
              <div className="space-y-1 text-sm">
                {asParlay && <p className="flex justify-between"><span className="text-zinc-500">Parlay odds</span><span className="font-mono font-bold">{am(legsOdds)}</span></p>}
                <p className="flex justify-between"><span className="text-zinc-500">Total stake</span><Coins n={totalStake} /></p>
                <p className="flex justify-between font-bold"><span>Potential payout</span><span className="text-emerald-600"><Coins n={toWin} /></span></p>
              </div>
              <button onClick={place} disabled={pending || stake < 10 || totalStake > d.coins} className="btn-primary w-full">
                {pending ? "Placing…" : totalStake > d.coins ? "Not enough Pack Points" : `Place ${asParlay ? "parlay" : slip.length > 1 ? `${slip.length} bets` : "bet"}`}
              </button>
            </div>
          )}
          {msg && <p className={`mt-3 text-sm ${msg.bad ? "text-red-600" : "text-emerald-600"}`}>{msg.t}</p>}
        </div>
        <div className="card p-4 text-xs text-zinc-500">
          <p className="mb-1 font-semibold text-zinc-700">House rules</p>
          <p>Bets are <Coins n={10} />–<Coins n={2500} />, max payout <Coins n={50000} />. Lines and odds are set by PackDraft from season averages and update live with the score and box score. Bets settle when the game goes final. Landing exactly on a line is a push (stake back; that parlay leg drops out). Live betting closes in the final minute.</p>
        </div>
      </aside>
    </div>
  );
}
