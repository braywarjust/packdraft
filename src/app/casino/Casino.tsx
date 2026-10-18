"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Coins, CoinIcon } from "@/components/Coins";
import * as A from "./actions";

type Game = "crash" | "chicken" | "blackjack" | "mines";
type Res<T> = T | { error: string };
/** Run a server action, turning a dropped connection into an error message instead of a crash. */
async function safe<T>(fn: () => Promise<Res<T>>): Promise<Res<T>> {
  try { return await fn(); } catch { return { error: "Connection lost. Try again." }; }
}
const isErr = <T,>(r: Res<T>): r is { error: string } => typeof r === "object" && r !== null && "error" in r;

// Same curve as src/lib/casino.ts (client only animates; the server decides).
const CRASH_RATE = 0.07;
const crashAt = (ms: number) => Math.floor(Math.exp(CRASH_RATE * (Math.max(0, ms) / 1000)) * 100) / 100;
const CHICKEN_P: Record<string, number> = { easy: 0.96, medium: 0.88, hard: 0.8, expert: 0.7 };
const chickenMult = (p: number, k: number) => (k === 0 ? 1 : Math.floor((0.99 / Math.pow(p, k)) * 100) / 100);
const minesMult = (m: number, k: number) => { let x = 0.99; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return k === 0 ? 1 : Math.floor(x * 100) / 100; };
const fmtX = (m: number) => `${m.toFixed(2)}x`;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Initial = { crash: any; chicken: any; mines: any; blackjack: any };

const GAMES: { id: Game; name: string; blurb: string }[] = [
  { id: "crash", name: "Crash", blurb: "Cash out before it crashes" },
  { id: "chicken", name: "Chicken", blurb: "Cross the road, lane by lane" },
  { id: "blackjack", name: "Blackjack", blurb: "Beat the dealer to 21" },
  { id: "mines", name: "Mines", blurb: "Find gems, dodge mines" },
];

export function Casino({ game, initial, tester }: { game: Game; initial: Initial; tester: boolean }) {
  const [balance, setBalance] = useState<number>(initial.crash.balance);
  const router = useRouter();
  const sync = (b: number) => { setBalance(b); router.refresh(); };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GAMES.map((g) => (
          <Link key={g.id} href={`/casino?g=${g.id}`} scroll={false}
            className={`rounded-xl p-3 ring-1 transition ${game === g.id ? "bg-brand text-white ring-brand" : "bg-panel text-zinc-700 ring-white/5 hover:bg-panel2"}`}>
            <p className="font-black">{g.name}</p>
            <p className={`text-xs ${game === g.id ? "text-white/75" : "text-zinc-500"}`}>{g.blurb}</p>
          </Link>
        ))}
      </div>
      {game === "crash" && <Crash init={initial.crash} balance={balance} onBalance={sync} tester={tester} />}
      {game === "chicken" && <Chicken init={initial.chicken} balance={balance} onBalance={sync} tester={tester} />}
      {game === "blackjack" && <Blackjack init={initial.blackjack} balance={balance} onBalance={sync} tester={tester} />}
      {game === "mines" && <Mines init={initial.mines} balance={balance} onBalance={sync} tester={tester} />}
      <p className="text-center text-xs text-zinc-500">Pack Points only, no real money. Crash, Chicken and Mines pay back 99% over the long run; Blackjack about 99.5% with perfect play.</p>
    </div>
  );
}

// ---------------------------------------------------------------- shared bits

function Shell({ controls, children }: { controls: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-line bg-panel lg:grid-cols-[300px_1fr]">
      <div className="space-y-4 border-b border-line bg-ink/60 p-4 lg:border-b-0 lg:border-r">{controls}</div>
      <div className="relative min-h-[420px] p-4 sm:p-6">{children}</div>
    </div>
  );
}

function BetInput({ value, onChange, balance, disabled, tester }: { value: number; onChange: (n: number) => void; balance: number; disabled?: boolean; tester: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between"><label className="label">Bet amount</label><span className="text-xs text-zinc-500">{tester ? "Test mode: free" : <Coins n={balance} />}</span></div>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <CoinIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
          <input type="number" min={1} value={value || ""} disabled={disabled} onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value))))}
            className="input w-full pl-9 font-mono" />
        </div>
        <button type="button" disabled={disabled} onClick={() => onChange(Math.max(1, Math.floor(value / 2)))} className="btn-ghost px-2.5 py-2 text-xs">½</button>
        <button type="button" disabled={disabled} onClick={() => onChange(Math.min(10000, value * 2 || 1))} className="btn-ghost px-2.5 py-2 text-xs">2×</button>
      </div>
    </div>
  );
}

function Notice({ text, tone }: { text: string | null; tone?: "win" | "loss" | "err" }) {
  if (!text) return null;
  const c = tone === "win" ? "text-emerald-500" : tone === "loss" ? "text-red-500" : "text-red-500";
  return <p className={`text-sm font-semibold ${c}`}>{text}</p>;
}

function useBet(init = 10) {
  const [bet, setBet] = useState(init);
  return [bet, setBet] as const;
}

// ---------------------------------------------------------------- Crash

function Crash({ init, balance, onBalance, tester }: { init: any; balance: number; onBalance: (b: number) => void; tester: boolean }) {
  const [bet, setBet] = useBet();
  const [auto, setAuto] = useState<string>("");
  const [round, setRound] = useState<any>(init.round);
  const [recent, setRecent] = useState<number[]>(init.recent ?? []);
  const [err, setErr] = useState<string | null>(null);
  const [mult, setMult] = useState(1);
  const [pending, start] = useTransition();
  const offset = useRef(0); // server clock - client clock
  const liveRound = round && round.status === "live";

  useEffect(() => { if (round?.now) offset.current = round.now - Date.now(); }, [round?.id, round?.now]);

  // Animate the multiplier locally; ask the server every 300ms whether it has crashed.
  useEffect(() => {
    if (!liveRound) return;
    let raf = 0, stop = false;
    const frame = () => { setMult(crashAt(Date.now() + offset.current - round.start)); if (!stop) raf = requestAnimationFrame(frame); };
    frame();
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/casino/crash", { cache: "no-store" });
        const r = await res.json();
        if (stop || !res.ok || isErr(r)) return;
        if (r.round && r.round.status !== "live") { setRound(r.round); setRecent(r.recent); onBalance(r.balance); }
      } catch { /* network blip (or the dev server reloading): try again on the next tick */ }
    }, 300);
    return () => { stop = true; cancelAnimationFrame(raf); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRound, round?.id]);

  const go = () => start(async () => {
    setErr(null);
    const a = Number(auto);
    const r = await safe(() => A.crashStart(bet, a >= 1.01 ? a : null));
    if (isErr(r)) return setErr(r.error);
    setRound(r.round); setMult(1); onBalance(r.balance);
  });
  const cash = () => start(async () => {
    const r = await safe(() => A.crashCashout());
    if (isErr(r)) return setErr(r.error);
    setRound(r.round); onBalance(r.balance);
  });

  const over = round && round.status !== "live";
  const shown = over ? (round.status === "won" ? round.cashed : round.crash) : liveRound ? mult : 1;
  const counting = liveRound && Date.now() + offset.current < round.start;
  // Curve: x = time, y = multiplier, scaled so the current point sits near the top right.
  const tNow = Math.max(0.01, Math.log(Math.max(1, shown ?? 1)) / CRASH_RATE);
  const tMax = Math.max(8, tNow * 1.15), mMax = Math.max(2, (shown ?? 1) * 1.2);
  const pts = Array.from({ length: 40 }, (_, i) => { const t = (tNow * i) / 39; const m = Math.exp(CRASH_RATE * t); return `${(t / tMax) * 100},${100 - ((m - 1) / (mMax - 1)) * 100}`; }).join(" ");
  const crashed = over && round.status === "lost";

  return (
    <Shell controls={<>
      <BetInput value={bet} onChange={setBet} balance={balance} disabled={!!liveRound} tester={tester} />
      <div>
        <label className="label">Auto cash out (optional)</label>
        <input value={auto} onChange={(e) => setAuto(e.target.value)} disabled={!!liveRound} placeholder="e.g. 2.00" inputMode="decimal" className="input w-full font-mono" />
      </div>
      {liveRound ? (
        <button onClick={cash} disabled={pending || counting} className="btn w-full bg-emerald-500 py-3 text-base font-black text-black hover:bg-emerald-400 disabled:opacity-60">
          Cash out <Coins n={Math.floor(round.stake * mult)} />
        </button>
      ) : (
        <button onClick={go} disabled={pending || !bet} className="btn-primary w-full py-3 text-base font-black">Bet</button>
      )}
      <Notice text={err} tone="err" />
      {over && <Notice text={round.status === "won" ? `Cashed out at ${fmtX(round.cashed)} for ${round.payout.toLocaleString("en-US")}` : `Crashed at ${fmtX(round.crash)}`} tone={round.status === "won" ? "win" : "loss"} />}
    </>}>
      <div className="flex flex-wrap gap-1.5">
        {recent.map((c, i) => <span key={i} className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${c >= 2 ? "bg-emerald-500/15 text-emerald-500" : "bg-panel2 text-zinc-500"}`}>{fmtX(c)}</span>)}
      </div>
      <div className="relative mt-4 h-[340px] overflow-hidden rounded-xl bg-ink ring-1 ring-white/5">
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        {(liveRound || over) && (
          <svg className="absolute inset-4" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points={`0,100 ${pts} ${(tNow / tMax) * 100},100`} fill={crashed ? "rgba(239,68,68,.12)" : "rgba(56,189,248,.12)"} stroke="none" />
            <polyline points={pts} fill="none" stroke={crashed ? "#ef4444" : "#38bdf8"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          </svg>
        )}
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            {counting ? <p className="font-mono text-4xl font-black text-zinc-500">Starting…</p> : (
              <p className={`font-mono text-6xl font-black ${crashed ? "text-red-500" : over ? "text-emerald-500" : "text-white"}`}>{fmtX(shown ?? 1)}</p>
            )}
            {crashed && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-red-500">Crashed</p>}
            {over && round.status === "won" && <p className="mt-1 text-sm font-bold uppercase tracking-widest text-emerald-500">Cashed out</p>}
            {!round && <p className="mt-2 text-sm text-zinc-500">Place a bet to launch</p>}
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- Chicken

function ChickenIcon({ dead }: { dead?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11">
      <path d="M18 6c2-3 5-3 6 0 1-2 4-1 3 2" fill="#ef4444" />
      <ellipse cx="20" cy="22" rx="11" ry="12" fill={dead ? "#71717a" : "#fafafa"} />
      <path d="M30 18l6 2-6 2z" fill="#f59e0b" />
      <circle cx="25" cy="17" r="1.8" fill="#111827" />
      <path d="M14 33l-2 5M24 33l2 5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
      <path d="M11 22c-3 1-4 4-2 6" stroke={dead ? "#52525b" : "#e5e7eb"} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Chicken({ init, balance, onBalance, tester }: { init: any; balance: number; onBalance: (b: number) => void; tester: boolean }) {
  const [bet, setBet] = useBet();
  const [level, setLevel] = useState<string>(init.round?.level ?? "easy");
  const [round, setRound] = useState<any>(init.round);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const road = useRef<HTMLDivElement>(null);
  const liveRound = round && round.status === "live";
  const p = CHICKEN_P[round?.level ?? level];
  const step = round?.step ?? 0;

  useEffect(() => {
    const el = road.current?.querySelector(`[data-lane="${Math.max(0, step)}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [step]);

  const call = (fn: () => Promise<any>) => start(async () => { setErr(null); const r = await safe(fn); if (isErr(r)) return setErr(r.error); setRound(r.round); onBalance(r.balance); });
  const over = round && round.status !== "live";
  const lanes = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <Shell controls={<>
      <BetInput value={bet} onChange={setBet} balance={balance} disabled={!!liveRound} tester={tester} />
      <div>
        <label className="label">Difficulty</label>
        <div className="grid grid-cols-4 gap-1">
          {Object.keys(CHICKEN_P).map((l) => (
            <button key={l} type="button" disabled={!!liveRound} onClick={() => setLevel(l)} className={`tab justify-center capitalize ${level === l ? "tab-active" : ""}`}>{l}</button>
          ))}
        </div>
      </div>
      {liveRound ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => call(A.chickenStep)} disabled={pending} className="btn-primary py-3 font-black">Go</button>
          <button onClick={() => call(A.chickenCashout)} disabled={pending || step === 0} className="btn bg-emerald-500 py-3 font-black text-black hover:bg-emerald-400 disabled:opacity-50">
            Cash out
          </button>
        </div>
      ) : (
        <button onClick={() => call(() => A.chickenStart(bet, level))} disabled={pending || !bet} className="btn-primary w-full py-3 text-base font-black">Bet</button>
      )}
      {liveRound && <p className="text-sm text-zinc-400">Now {fmtX(chickenMult(p, step))} · next lane {fmtX(chickenMult(p, step + 1))}</p>}
      <Notice text={err} tone="err" />
      {over && <Notice text={round.status === "won" ? `Made it ${round.step} lanes for ${round.payout.toLocaleString("en-US")}` : `Hit in lane ${round.hit}`} tone={round.status === "won" ? "win" : "loss"} />}
    </>}>
      <div ref={road} className="flex h-full min-h-[380px] overflow-x-auto rounded-xl bg-[#1b2230] ring-1 ring-white/5">
        <div data-lane="0" className="relative flex w-24 shrink-0 items-center justify-center border-r-4 border-dashed border-white/20 bg-[#1f3326]">
          {step === 0 && <ChickenIcon />}
        </div>
        {lanes.map((n) => {
          const passed = n <= step && !(over && round.status === "lost" && n === round.hit);
          const here = n === step;
          const hitHere = over && round.status === "lost" && n === round.hit;
          return (
            <div key={n} data-lane={n} className={`relative flex w-24 shrink-0 flex-col items-center justify-between border-r-2 border-dashed border-white/10 py-4 ${passed ? "bg-white/[0.03]" : ""}`}>
              <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${passed ? "bg-emerald-500/20 text-emerald-500" : "bg-black/30 text-zinc-500"}`}>{fmtX(chickenMult(p, n))}</span>
              <div className="grid h-16 place-items-center">
                {here && !hitHere && <ChickenIcon />}
                {hitHere && (
                  <div className="relative">
                    <ChickenIcon dead />
                    <div className="anim-deal absolute -top-10 left-1/2 h-14 w-9 -translate-x-1/2 rounded-md bg-red-600 ring-2 ring-red-400" />
                  </div>
                )}
              </div>
              <span className="h-8 w-1 rounded bg-yellow-400/30" />
            </div>
          );
        })}
        <div className="flex w-24 shrink-0 items-center justify-center bg-[#1f3326] text-xs font-bold uppercase tracking-widest text-emerald-500">Safe</div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- Mines

function Gem() {
  return <svg viewBox="0 0 24 24" className="h-9 w-9"><path d="M6 4h12l4 6-10 11L2 10z" fill="#34d399" /><path d="M2 10h20M8 4l4 17 4-17" stroke="#065f46" strokeWidth="1" fill="none" opacity=".5" /></svg>;
}
function Mine() {
  return <svg viewBox="0 0 24 24" className="h-9 w-9"><circle cx="12" cy="13" r="7" fill="#ef4444" /><path d="M12 2v4M12 20v2M3 13H1M23 13h-2M5 6l2 2M19 6l-2 2" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" /><circle cx="9.5" cy="10.5" r="1.8" fill="#fecaca" /></svg>;
}

function Mines({ init, balance, onBalance, tester }: { init: any; balance: number; onBalance: (b: number) => void; tester: boolean }) {
  const [bet, setBet] = useBet();
  const [count, setCount] = useState<number>(init.round?.count ?? 3);
  const [round, setRound] = useState<any>(init.round);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const liveRound = round && round.status === "live";
  const over = round && round.status !== "live";
  const call = (fn: () => Promise<any>) => start(async () => { setErr(null); const r = await safe(fn); if (isErr(r)) return setErr(r.error); setRound(r.round); onBalance(r.balance); });
  const picks: number[] = round?.picks ?? [];
  const mines: number[] | null = round?.mines ?? null;

  return (
    <Shell controls={<>
      <BetInput value={bet} onChange={setBet} balance={balance} disabled={!!liveRound} tester={tester} />
      <div>
        <label className="label">Mines</label>
        <select value={count} disabled={!!liveRound} onChange={(e) => setCount(Number(e.target.value))} className="input w-full">
          {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {liveRound ? (
        <button onClick={() => call(A.minesCashout)} disabled={pending || picks.length === 0} className="btn w-full bg-emerald-500 py-3 text-base font-black text-black hover:bg-emerald-400 disabled:opacity-50">
          Cash out <Coins n={Math.floor(round.stake * round.multiplier)} />
        </button>
      ) : (
        <button onClick={() => call(() => A.minesStart(bet, count))} disabled={pending || !bet} className="btn-primary w-full py-3 text-base font-black">Bet</button>
      )}
      {liveRound && <p className="text-sm text-zinc-400">Now {fmtX(round.multiplier)} · next gem {fmtX(round.next)}</p>}
      {!liveRound && <p className="text-xs text-zinc-500">First gem pays {fmtX(minesMult(count, 1))}</p>}
      <Notice text={err} tone="err" />
      {over && <Notice text={round.status === "won" ? `Cashed out at ${fmtX(round.multiplier)} for ${round.payout.toLocaleString("en-US")}` : "Boom. You hit a mine."} tone={round.status === "won" ? "win" : "loss"} />}
    </>}>
      <div className="mx-auto grid max-w-[460px] grid-cols-5 gap-2.5">
        {Array.from({ length: 25 }, (_, i) => {
          const picked = picks.includes(i);
          const isMine = mines?.includes(i);
          const boom = round?.boom === i;
          const showGem = picked && !isMine;
          const reveal = over && !picked;
          return (
            <button key={i} type="button" disabled={!liveRound || picked || pending} onClick={() => call(() => A.minesPick(i))}
              className={`grid aspect-square place-items-center rounded-xl transition ${picked || reveal ? "" : "hover:-translate-y-0.5 hover:bg-[#3a4560]"}
                ${boom ? "bg-red-500/25 ring-2 ring-red-500" : showGem ? "bg-emerald-500/15 ring-1 ring-emerald-500/40" : picked || reveal ? "bg-ink" : "bg-panel2 shadow-[0_4px_0_rgba(0,0,0,.35)]"}`}>
              {(showGem || (reveal && !isMine)) && <span className={reveal ? "opacity-35" : ""}><Gem /></span>}
              {isMine && (boom || reveal) && <span className={boom ? "" : "opacity-50"}><Mine /></span>}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- Blackjack

const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT = ["♠︎", "♥︎", "♦︎", "♣︎"];

function PlayingCard({ c, hidden }: { c?: { r: number; s: number }; hidden?: boolean }) {
  if (hidden || !c) {
    return <div className="anim-deal h-28 w-20 rounded-lg bg-brand ring-2 ring-white/20" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.12) 0 4px, transparent 4px 10px)" }} />;
  }
  const red = c.s === 1 || c.s === 2;
  return (
    <div className={`anim-deal flex h-28 w-20 flex-col justify-between rounded-lg bg-[#fff] p-1.5 shadow-lg ${red ? "text-red-600" : "text-zinc-950"}`} style={{ color: red ? "#dc2626" : "#0b0f17" }}>
      <span className="text-lg font-black leading-none">{RANK[c.r]}<br /><span className="text-base">{SUIT[c.s]}</span></span>
      <span className="self-center text-3xl">{SUIT[c.s]}</span>
      <span className="rotate-180 text-lg font-black leading-none">{RANK[c.r]}</span>
    </div>
  );
}

function Blackjack({ init, balance, onBalance, tester }: { init: any; balance: number; onBalance: (b: number) => void; tester: boolean }) {
  const [bet, setBet] = useBet();
  const [round, setRound] = useState<any>(init.round);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const liveRound = round && round.status === "live";
  const over = round && round.status !== "live";
  const call = (fn: () => Promise<any>) => start(async () => { setErr(null); const r = await safe(fn); if (isErr(r)) return setErr(r.error); setRound(r.round); onBalance(r.balance); });
  const total = (v: { total: number; soft: boolean }) => (v.soft && v.total < 21 ? `${v.total - 10}/${v.total}` : String(v.total));
  const won = over && round.payout > round.stake * (round.doubled ? 2 : 1);

  return (
    <Shell controls={<>
      <BetInput value={bet} onChange={setBet} balance={balance} disabled={!!liveRound} tester={tester} />
      {liveRound ? (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => call(() => A.bjAction("hit"))} disabled={pending} className="btn-primary py-3 font-black">Hit</button>
          <button onClick={() => call(() => A.bjAction("stand"))} disabled={pending} className="btn-ghost py-3 font-black">Stand</button>
          <button onClick={() => call(() => A.bjAction("double"))} disabled={pending || !round.canDouble} className="btn-ghost py-3 font-black">Double</button>
        </div>
      ) : (
        <button onClick={() => call(() => A.bjStart(bet))} disabled={pending || !bet} className="btn-primary w-full py-3 text-base font-black">Deal</button>
      )}
      <p className="text-xs text-zinc-500">Blackjack pays 3:2. Dealer stands on soft 17. Double on your first two cards.</p>
      <Notice text={err} tone="err" />
      {over && <Notice text={`${round.result}${round.payout ? ` · paid ${round.payout.toLocaleString("en-US")}` : ""}`} tone={won ? "win" : round.status === "push" ? undefined : "loss"} />}
    </>}>
      <div className="flex h-full min-h-[380px] flex-col justify-between rounded-xl bg-[#13402a] p-5 ring-1 ring-white/5" style={{ backgroundImage: "radial-gradient(circle at 50% 40%, rgba(255,255,255,.08), transparent 60%)" }}>
        {round ? (
          <>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/60">Dealer · {total(round.dealerValue)}{round.hidden ? " + ?" : ""}</p>
              <div className="flex gap-2">{round.dealer.map((c: any, i: number) => <PlayingCard key={i} c={c} />)}{round.hidden ? <PlayingCard hidden /> : null}</div>
            </div>
            {over && <p className={`self-center rounded-full px-4 py-1 text-sm font-black ${won ? "bg-emerald-500 text-black" : round.status === "push" ? "bg-panel2 text-white" : "bg-red-600 text-white"}`}>{round.result}</p>}
            <div>
              <div className="flex gap-2">{round.player.map((c: any, i: number) => <PlayingCard key={i} c={c} />)}</div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-white/60">You · {total(round.playerValue)}{round.doubled ? " · doubled" : ""}</p>
            </div>
          </>
        ) : <p className="m-auto text-sm text-white/60">Place a bet and deal</p>}
      </div>
    </Shell>
  );
}
