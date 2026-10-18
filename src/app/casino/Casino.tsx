"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Coins, CoinIcon } from "@/components/Coins";
import * as A from "./actions";

type Game = "crash" | "chicken" | "blackjack" | "mines";
type Res<T> = T | { error: string };
const isErr = (r: any): r is { error: string } => !!r && typeof r === "object" && "error" in r;
/** Run a server action, turning a dropped connection into an error message instead of a crash. */
async function safe<T>(fn: () => Promise<Res<T>>): Promise<Res<T>> {
  try { return await fn(); } catch { return { error: "Connection lost. Try again." }; }
}

// Same maths as src/lib/casino.ts (the client only animates; the server decides).
const CRASH_RATE = 0.07;
const crashAt = (ms: number) => Math.floor(Math.exp(CRASH_RATE * (Math.max(0, ms) / 1000)) * 100 + 1e-9) / 100;
const ROAD = 26;
const CARS: Record<string, number> = { easy: 2, medium: 4, hard: 6, expert: 11 };
const chickenMult = (cars: number, k: number) => { let m = 0.98; for (let i = 0; i < k; i++) m *= (ROAD - i) / (ROAD - cars - i); return k === 0 ? 1 : Math.floor(m * 100 + 1e-9) / 100; };
const minesMult = (mines: number, k: number) => { let m = 0.99; for (let i = 0; i < k; i++) m *= (25 - i) / (25 - mines - i); return k === 0 ? 1 : Math.floor(m * 100 + 1e-9) / 100; };
const fmtX = (m: number) => `${m.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;

// Stake-like palette for the casino floor.
const C = { side: "#1a2535", stage: "#0f1620", field: "#0c121b", raised: "#2a3648", raised2: "#344257", green: "#22e36b" };

type Initial = { crash: any; chicken: any; mines: any; blackjack: any };
const GAMES: { id: Game; name: string; blurb: string; bg: string }[] = [
  { id: "crash", name: "Crash", blurb: "Cash out before it crashes", bg: "linear-gradient(160deg,#f0abfc 0%,#a21caf 38%,#5b21b6 70%,#2e1065 100%)" },
  { id: "chicken", name: "Chicken", blurb: "Cross the road, lane by lane", bg: "linear-gradient(160deg,#fcd34d 0%,#f97316 40%,#c2410c 72%,#7c2d12 100%)" },
  { id: "blackjack", name: "Blackjack", blurb: "Beat the dealer to 21", bg: "linear-gradient(160deg,#86efac 0%,#16a34a 38%,#166534 70%,#052e16 100%)" },
  { id: "mines", name: "Mines", blurb: "Find gems, dodge mines", bg: "linear-gradient(160deg,#7dd3fc 0%,#0ea5e9 34%,#1d4ed8 68%,#172554 100%)" },
];

export function Casino({ game, initial, tester }: { game: Game; initial: Initial; tester: boolean }) {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(initial.crash.balance);
  const sync = (b: number) => { if (b !== balance) { setBalance(b); router.refresh(); } };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:max-w-[780px] sm:grid-cols-4">
        {GAMES.map((g) => <GameThumb key={g.id} g={g} active={game === g.id} />)}
      </div>
      {game === "crash" && <Crash init={initial.crash} onBalance={sync} tester={tester} />}
      {game === "chicken" && <Chicken init={initial.chicken} onBalance={sync} tester={tester} />}
      {game === "blackjack" && <Blackjack init={initial.blackjack} onBalance={sync} tester={tester} />}
      {game === "mines" && <Mines init={initial.mines} onBalance={sync} tester={tester} />}
      <p className="text-center text-xs text-zinc-500">Pack Points only, no real money. Crash and Mines pay back 99% over the long run, Chicken 98%, Blackjack about 99.5% with perfect play.</p>
    </div>
  );
}

// ---------------------------------------------------------------- game thumbnails

/** Sunburst behind each thumbnail's art: 16 wedges around a point just above the middle. */
const RAYS = Array.from({ length: 16 }, (_, i) => {
  const a = (i * Math.PI) / 8, b = a + Math.PI / 16;
  const p = (t: number) => `${(50 + 95 * Math.cos(t)).toFixed(2)} ${(36 + 95 * Math.sin(t)).toFixed(2)}`;
  return `M50 36L${p(a)}L${p(b)}Z`;
}).join("");

/** A square, casino-style game tile: bright gradient, sunburst, the game's art and its name. Sizes are in cqw so the art scales with the tile. */
function GameThumb({ g, active }: { g: (typeof GAMES)[number]; active: boolean }) {
  return (
    <Link href={`/casino?g=${g.id}`} scroll={false} aria-current={active ? "page" : undefined} style={{ background: g.bg }}
      className={`casino-thumb @container group relative block aspect-square overflow-hidden rounded-2xl transition duration-200 hover:-translate-y-1 ${active ? "is-active ring-[3px] ring-[#fff]" : "ring-1 ring-white/10 brightness-[.86] hover:brightness-100"}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id={`thumb-glow-${g.id}`} cx="50%" cy="36%" r="50%"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        </defs>
        <g className="casino-rays" fill="#fff" opacity=".09"><path d={RAYS} /></g>
        <circle cx="50" cy="36" r="48" fill={`url(#thumb-glow-${g.id})`} />
      </svg>
      <div className="absolute inset-x-0 top-0 flex h-[70%] items-center justify-center transition-[scale] duration-300 group-hover:scale-[1.06]">
        {g.id === "crash" ? <CrashArt /> : g.id === "chicken" ? <ChickenArt /> : g.id === "blackjack" ? <BlackjackArt /> : <MinesArt />}
      </div>
      <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5">
        <p className="text-xl font-black leading-tight text-white">{g.name}</p>
        <p className="truncate text-[11px] font-semibold text-white/80">{g.blurb}</p>
      </div>
    </Link>
  );
}

function CrashArt() {
  // A multiplier line shooting up into the stars with a rocket riding the tip.
  const stars: [number, number, number][] = [[10, 12, .9], [24, 30, .6], [36, 8, .7], [52, 22, .5], [90, 40, .7], [64, 4, .8], [8, 40, .5], [94, 12, .6], [80, 52, .5]];
  return (
    <svg viewBox="0 0 100 70" className="h-full w-[92%] overflow-visible">
      <defs>
        <linearGradient id="crash-thumb-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" stopOpacity=".5" /><stop offset="1" stopColor="#fde047" stopOpacity="0" /></linearGradient>
      </defs>
      {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity=".8" />)}
      <path d="M6 64Q48 62 72 22L72 64Z" fill="url(#crash-thumb-area)" />
      <path d="M6 64Q48 62 72 22" stroke="#fde047" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <g transform="translate(77 13) rotate(31) scale(1.2)">
        <g className="crash-rocket">
          <path className="crash-flame" d="M-3.4 7.5Q0 20 3.4 7.5z" fill="#f97316" />
          <path className="crash-flame" d="M-1.8 7.5Q0 14 1.8 7.5z" fill="#fde047" />
          <path d="M-4 1L-9 9L-3.6 7z" fill="#ef4444" /><path d="M4 1L9 9L3.6 7z" fill="#ef4444" />
          <path d="M0-13C5-8 5.2 2 4 8L-4 8C-5.2 2-5-8 0-13z" fill="#fff" />
          <path d="M0-13C2.6-10.6 3.8-8.6 4.4-6.4L-4.4-6.4C-3.8-8.6-2.6-10.6 0-13z" fill="#ef4444" />
          <circle cy="-1.5" r="2.4" fill="#38bdf8" stroke="#1e3a8a" strokeWidth=".9" />
        </g>
      </g>
    </svg>
  );
}

function ChickenArt() {
  // The chicken on its manhole, with a car barrelling down the next lane.
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-y-0 left-[64%] border-l-[3px] border-dashed border-white/45" />
      <div className="absolute -top-[10cqw] left-[70%]"><Vehicle kind="sedan" color="#2563eb" width="21cqw" /></div>
      <div className="absolute bottom-[2%] left-[33%] flex -translate-x-1/2 flex-col items-center">
        <div className="relative z-10 -mb-[9cqw] h-[40cqw] w-[36cqw]"><StandingChicken state="idle" /></div>
        <Manhole className="h-[16cqw] w-[30cqw]" />
      </div>
    </div>
  );
}

function MiniCard({ r, s, className }: { r: number; s: number; className: string }) {
  return (
    <div className={`absolute flex h-[36cqw] w-[25cqw] flex-col justify-between rounded-[2.4cqw] bg-[#fff] p-[2.2cqw] shadow-[0_6px_14px_rgba(0,0,0,.35)] transition-[rotate,translate] duration-300 ${className}`} style={{ color: s === 1 || s === 2 ? "#e11d48" : "#0b0f17" }}>
      <p className="text-[8.5cqw] font-black leading-none">{RANK[r]}</p>
      <Suit s={s} className="h-[12cqw] w-[12cqw] self-end" />
    </div>
  );
}

function Chip({ color, edge, className }: { color: string; edge: string; className: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`absolute ${className}`}>
      <circle cx="20" cy="20" r="19" fill={color} />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke={edge} strokeWidth="5" strokeDasharray="6.17 6" />
      <circle cx="20" cy="20" r="10.5" fill={color} stroke={edge} strokeWidth="1.4" opacity=".95" />
    </svg>
  );
}

function BlackjackArt() {
  // Blackjack in two cards, fanning out a little more on hover, with a couple of chips.
  return (
    <div className="relative h-full w-full">
      <MiniCard r={1} s={0} className="left-[22%] top-[16%] -rotate-12 group-hover:-translate-x-[1.5cqw] group-hover:-rotate-[18deg]" />
      <MiniCard r={13} s={1} className="left-[42%] top-[11%] rotate-[9deg] group-hover:translate-x-[1.5cqw] group-hover:rotate-[15deg]" />
      <Chip color="#111827" edge="#facc15" className="left-[62%] top-[55%] w-[17cqw]" />
      <Chip color="#dc2626" edge="#fff" className="left-[68%] top-[48%] w-[17cqw]" />
    </div>
  );
}

function MinesArt() {
  // A corner of the board with two gems and a mine turned over.
  const cells = ["", "gem", "", "", "bomb", "", "gem", "", ""];
  return (
    <div className="grid h-[46cqw] w-[46cqw] -rotate-6 grid-cols-3 gap-[1.8cqw]">
      {cells.map((c, i) => (
        <div key={i} className="grid place-items-center rounded-[2cqw]" style={c ? { background: "#0f1620" } : { background: "#2f3d52", boxShadow: "inset 0 -1cqw 0 #1f2a3a" }}>
          {c === "gem" ? <GemIcon /> : c === "bomb" ? <BombIcon /> : null}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- shared controls

function Shell({ controls, children, stageClass = "" }: { controls: React.ReactNode; children: React.ReactNode; stageClass?: string }) {
  return (
    <div className="grid overflow-hidden rounded-2xl ring-1 ring-white/5 lg:grid-cols-[320px_1fr]" style={{ background: C.stage }}>
      <div className="space-y-4 p-4" style={{ background: C.side }}>{controls}</div>
      <div className={`relative min-h-[520px] overflow-hidden ${stageClass}`}>{children}</div>
    </div>
  );
}

function Label({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return <div className="mb-1.5 flex items-center justify-between text-sm font-semibold text-zinc-500"><span>{left}</span>{right != null && <span className="font-mono text-xs">{right}</span>}</div>;
}

function BetField({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div>
      <Label left="Bet Amount" right={<Coins n={value || 0} />} />
      <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10" style={{ background: C.field }}>
        <div className="relative flex-1">
          <input type="number" min={0} value={value} disabled={disabled} placeholder="0" onChange={(e) => onChange(Math.max(0, Math.min(10000, Math.floor(Number(e.target.value) || 0))))}
            className="w-full bg-transparent py-2.5 pl-3 pr-9 font-mono text-white outline-none disabled:opacity-60" />
          <CoinIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
        </div>
        <div className="flex items-stretch" style={{ background: C.raised }}>
          <button type="button" disabled={disabled} onClick={() => onChange(Math.floor(value / 2))} className="px-3.5 text-sm font-bold text-zinc-700 hover:bg-white/5 disabled:opacity-40">½</button>
          <span className="my-2 w-px bg-white/15" />
          <button type="button" disabled={disabled} onClick={() => onChange(Math.min(10000, value * 2))} className="px-3.5 text-sm font-bold text-zinc-700 hover:bg-white/5 disabled:opacity-40">2×</button>
        </div>
      </div>
      {value === 0 && <p className="mt-1.5 text-xs font-semibold text-[#22e36b]">Free play: try it out, nothing is won or lost.</p>}
    </div>
  );
}

function ProfitField({ label, mult, amount }: { label: string; mult: number; amount: number }) {
  return (
    <div>
      <Label left={`${label} (${fmtX(mult)})`} right={<Coins n={amount} />} />
      <div className="flex items-center justify-between rounded-lg px-3 py-2.5 ring-1 ring-white/10" style={{ background: C.field }}>
        <span className="font-mono text-white">{amount.toLocaleString("en-US")}</span><CoinIcon className="text-emerald-500" />
      </div>
    </div>
  );
}

function BigButton({ children, onClick, disabled, tone = "blue" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: "blue" | "green" | "grey" }) {
  const bg = tone === "green" ? "bg-[#22e36b] text-[#06240f] hover:bg-[#4cf08a]" : tone === "grey" ? "bg-[#344257] text-white hover:bg-[#3e4e67]" : "bg-[#1f6fe0] text-white hover:bg-[#3584f0]";
  return <button type="button" onClick={onClick} disabled={disabled} className={`flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-base font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${bg}`}>{children}</button>;
}

function Err({ text }: { text: string | null }) {
  return text ? <p className="text-sm font-semibold text-red-500">{text}</p> : null;
}

// ---------------------------------------------------------------- Crash (shared rounds)

function Crash({ init, onBalance, tester }: { init: any; onBalance: (b: number) => void; tester: boolean }) {
  const [bet, setBet] = useState(10);
  const [target, setTarget] = useState(2);
  const [s, setS] = useState<any>(init);
  const [queued, setQueued] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // First render uses the server's clock so it matches the server HTML; the animation loop takes over after.
  const [now, setNow] = useState<number>(init.game.now);
  const [mounted, setMounted] = useState(false); // the live graph is drawn in the browser only (no server/browser float mismatch)
  useEffect(() => setMounted(true), []);
  const offset = useRef(0);
  useEffect(() => { offset.current = init.game.now - Date.now(); }, [init.game.now]);
  const queueRef = useRef(queued);
  queueRef.current = queued;

  // Poll the shared round; animate every frame from the server's clock.
  useEffect(() => {
    let stop = false, raf = 0;
    const frame = () => { setNow(Date.now() + offset.current); if (!stop) raf = requestAnimationFrame(frame); };
    frame();
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/casino/crash", { cache: "no-store" });
        const r = await res.json();
        if (stop || !res.ok || isErr(r)) return;
        offset.current = r.game.now - Date.now();
        setNow(r.game.now); // keeps time moving even when animation frames are paused (background tab)
        setS(r);
        onBalance(r.balance);
      } catch { /* blip: next tick */ }
    }, 250);
    return () => { stop = true; cancelAnimationFrame(raf); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = s.game;
  const phase: "betting" | "running" | "crashed" = g.crash ? "crashed" : g.phase === "running" || now >= g.start ? "running" : "betting";
  const mult = phase === "betting" ? 1 : phase === "crashed" ? g.crash : crashAt(now - g.start);
  const my = s.bet;
  const inRound = my && my.status === "live";

  const place = () => start(async () => {
    setErr(null);
    const r = await safe(() => A.crashBet(bet, target >= 1.01 ? target : null));
    if (isErr(r)) return setErr(r.error);
    setS(r); onBalance(r.balance);
  });
  const cash = () => start(async () => {
    const r = await safe(() => A.crashCashout());
    if (isErr(r)) return setErr(r.error);
    setS(r); onBalance(r.balance);
  });
  // A bet queued during a round goes in as soon as the next countdown opens.
  useEffect(() => {
    if (phase === "betting" && queueRef.current && !my) { setQueued(false); place(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, g.id]);

  const total = s.players.reduce((x: number, p: any) => x + p.stake, 0);
  // Graph: time on x, multiplier on y, rescaled as the round climbs.
  const tNow = phase === "betting" ? 0 : Math.log(Math.max(1, mult)) / CRASH_RATE;
  const tMax = Math.max(10, tNow * 1.12), mMax = Math.max(2, mult * 1.15);
  const pts = Array.from({ length: 60 }, (_, i) => { const t = (tNow * i) / 59; const m = Math.exp(CRASH_RATE * t); return [(t / tMax) * 100, 100 - ((m - 1) / (mMax - 1)) * 100]; });
  const tip = pts[pts.length - 1];
  const color = phase === "crashed" ? "#ef4444" : my?.status === "won" ? C.green : "#3b82f6";

  let button: React.ReactNode;
  if (inRound && phase === "running") button = <BigButton tone="green" onClick={cash} disabled={pending}>Cash out <Coins n={Math.floor(my.stake * mult)} /></BigButton>;
  else if (inRound && phase === "betting") button = <BigButton disabled>Waiting for the round…</BigButton>;
  else if (phase === "betting" && g.start - now > 250) button = <BigButton onClick={place} disabled={pending}>Bet</BigButton>;
  else button = <BigButton tone="grey" onClick={() => setQueued((q) => !q)}>{queued ? "Cancel (queued for next round)" : "Bet next round"}</BigButton>;

  return (
    <Shell controls={<>
      <BetField value={bet} onChange={setBet} disabled={!!inRound} />
      <div>
        <Label left="Cashout At" />
        <div className="flex overflow-hidden rounded-lg ring-1 ring-white/10" style={{ background: C.field }}>
          <input type="number" step="0.01" min={1.01} value={target} disabled={!!inRound} onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full flex-1 bg-transparent px-3 py-2.5 font-mono text-white outline-none disabled:opacity-60" />
          <div className="flex items-stretch" style={{ background: C.raised }}>
            <button type="button" disabled={!!inRound} onClick={() => setTarget((t) => Math.max(1.01, Math.round((t - (t > 2 ? 0.5 : 0.1)) * 100) / 100))} className="px-3.5 text-zinc-700 hover:bg-white/5 disabled:opacity-40" aria-label="Lower">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            <span className="my-2 w-px bg-white/15" />
            <button type="button" disabled={!!inRound} onClick={() => setTarget((t) => Math.min(1000, Math.round((t + (t >= 2 ? 0.5 : 0.1)) * 100) / 100))} className="px-3.5 text-zinc-700 hover:bg-white/5 disabled:opacity-40" aria-label="Raise">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 15l6-6 6 6" /></svg>
            </button>
          </div>
        </div>
      </div>
      {button}
      <ProfitField label="Profit on Win" mult={target} amount={Math.max(0, Math.floor(bet * target) - bet)} />
      <Err text={err} />
      {tester && <p className="text-xs text-zinc-500">Test mode: bets are free.</p>}
      <div className="rounded-lg p-3 text-sm ring-1 ring-white/5" style={{ background: C.field }}>
        <div className="flex items-center justify-between font-bold text-white">
          <span className="flex items-center gap-1.5"><svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-500" fill="currentColor"><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-4 3-6 7-6s7 2 7 6z" /><circle cx="17" cy="9" r="2.5" /><path d="M15 14c4 0 7 2 7 6h-5" /></svg>{s.players.length}</span>
          <Coins n={total} />
        </div>
        {s.players.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-white/5 pt-2 text-xs">
            {s.players.map((p: any, i: number) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate text-zinc-400">{p.name}</span>
                <span className={`font-mono ${p.cashed ? "text-[#22e36b]" : "text-zinc-500"}`}>{p.cashed ? `${fmtX(p.cashed)} · ${p.payout.toLocaleString("en-US")}` : p.status === "lost" ? "Busted" : p.stake.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>}>
      <div className="absolute inset-x-4 top-4 z-10 flex gap-2 overflow-hidden">
        {s.recent.map((c: number, i: number) => (
          <span key={`${g.id}-${i}`} className={`anim-deal shrink-0 rounded-full px-3.5 py-1.5 font-mono text-xs font-bold ${c >= 2 ? "text-[#06240f]" : "text-white"}`} style={{ background: c >= 2 ? C.green : C.raised }}>{fmtX(c)}</span>
        ))}
      </div>
      <div className="absolute inset-0 pt-16">
        <svg className="absolute inset-x-10 bottom-10 top-20 h-[calc(100%-7.5rem)] w-[calc(100%-5rem)] overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[0, 25, 50, 75, 100].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,.05)" vectorEffect="non-scaling-stroke" />)}
          {mounted && phase !== "betting" && <>
            <polygon points={`0,100 ${pts.map((p) => p.join(",")).join(" ")} ${tip[0]},100`} fill={color} opacity=".14" />
            <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>}
        </svg>
        {mounted && phase !== "betting" && (
          <div className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-white/20" style={{ left: `calc(2.5rem + (100% - 5rem) * ${tip[0] / 100})`, top: `calc(5rem + (100% - 7.5rem) * ${tip[1] / 100})`, background: color }} />
        )}
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-mono text-7xl font-black tabular-nums sm:text-8xl" style={{ color: phase === "crashed" ? "#ef4444" : "#ffffff" }}>{mounted ? fmtX(mult) : "1.00x"}</p>
            {mounted && phase === "betting" && (
              <p className="mx-auto mt-3 inline-block rounded-full px-4 py-1.5 text-sm font-bold text-white" style={{ background: C.raised }}>
                Starting in <span className="font-mono" style={{ color: C.green }}>{Math.max(0, (g.start - now) / 1000).toFixed(2)}s</span>
              </p>
            )}
            {phase === "crashed" && <p className="mt-2 text-sm font-black uppercase tracking-[0.3em] text-red-500">Crashed</p>}
            {my?.status === "won" && my.cashed && <p className="mt-2 text-sm font-bold" style={{ color: C.green }}>You cashed out at {fmtX(my.cashed)}: +{(my.payout - my.stake).toLocaleString("en-US")}</p>}
            {my?.status === "lost" && phase === "crashed" && <p className="mt-1 text-sm text-zinc-500">Lost {my.stake.toLocaleString("en-US")}</p>}
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- Chicken

/**
 * Stake-style chicken: flat colours, a round white body with a fluffy two-puff tail, a tall head with a three-bump
 * comb, two dot eyes, a yellow beak over an orange underside, a red wattle and orange legs with flat feet.
 * Each part is its own group so it animates separately (chk-* rules in globals.css): the head bobs, comb and wattle
 * wobble, eyes blink, tail sways, feet shuffle; a jump squashes, stretches and tucks the legs.
 * When it's hit, the standing chicken squashes down and swaps for the flattened one.
 */
const CHK = { white: "#ffffff", shade: "#eef1f5", red: "#d9354a", beak: "#f6c443", beakUnder: "#f08a3a", leg: "#ef8a3c", eye: "#0f1720" };

function StandingChicken({ state }: { state: "idle" | "hop" | "won" | "squash" }) {
  return (
    <svg viewBox="0 0 100 112" className={`chk chk-${state} block h-full w-full overflow-visible`}>
      <ellipse className="chk-shadow" cx="56" cy="108" rx="26" ry="4" fill="#000" opacity=".22" />
      {/* legs + flat feet */}
      <g className="chk-leg chk-leg-l"><path d="M47 92l2.5 13" stroke={CHK.leg} strokeWidth="5" strokeLinecap="round" /><rect x="42" y="103" width="15" height="4.4" rx="2.2" fill={CHK.leg} /></g>
      <g className="chk-leg chk-leg-r"><path d="M68 92l2 11" stroke={CHK.leg} strokeWidth="5" strokeLinecap="round" /><rect x="64" y="101" width="15" height="4.4" rx="2.2" fill={CHK.leg} /></g>
      <g className="chk-body">
        {/* fluffy tail */}
        <g className="chk-tail"><circle cx="25" cy="44" r="13.5" fill={CHK.white} /><circle cx="15" cy="62" r="11.5" fill={CHK.white} /></g>
        <ellipse cx="54" cy="70" rx="38" ry="25" fill={CHK.white} />
        {/* thighs */}
        <ellipse cx="49" cy="93" rx="7.5" ry="4.5" fill={CHK.white} /><ellipse cx="68" cy="93" rx="7" ry="4" fill={CHK.white} />
      </g>
      <g className="chk-head">
        <g className="chk-comb"><circle cx="58" cy="25" r="6" fill={CHK.red} /><circle cx="63" cy="17" r="6.5" fill={CHK.red} /><circle cx="71" cy="17" r="6.5" fill={CHK.red} /></g>
        <rect x="51" y="20" width="44" height="68" rx="22" fill={CHK.white} />
        <g className="chk-eyes"><circle cx="70" cy="37" r="2.9" fill={CHK.eye} /><circle cx="84.5" cy="34" r="2.9" fill={CHK.eye} /></g>
        <g className="chk-wattle"><ellipse cx="81" cy="55" rx="4" ry="6" fill={CHK.red} /></g>
        <g className="chk-beak">
          <path d="M77 42.5L89.5 41.5Q91 42.5 89.6 44.6L79 47.6Q76.8 47.3 77 42.5z" fill={CHK.beak} />
          <path d="M78.5 46.8L89.6 44.2Q89 46.6 86.5 47.2L80 49z" fill={CHK.beakUnder} />
        </g>
      </g>
    </svg>
  );
}

function FlatChicken() {
  // Run over: a squashed pancake seen from above, legs sticking out, eyes screwed shut.
  return (
    <svg viewBox="0 0 130 80" className="chk-flat block h-full w-full overflow-visible">
      <ellipse cx="66" cy="50" rx="56" ry="20" fill="#000" opacity=".18" />
      <path d="M14 46l-8-3 3-7M12 46l-6 6" stroke={CHK.leg} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M112 22l6-8 8 1M118 14l2-6" stroke={CHK.leg} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="30" cy="22" r="11" fill={CHK.white} /><circle cx="44" cy="15" r="11" fill={CHK.white} />
      <ellipse cx="66" cy="42" rx="54" ry="24" transform="rotate(-8 66 42)" fill={CHK.white} />
      <ellipse cx="44" cy="58" rx="30" ry="9" transform="rotate(-6 44 58)" fill={CHK.shade} />
      <g transform="rotate(-18 62 30)"><circle cx="56" cy="31" r="5" fill={CHK.red} /><circle cx="63" cy="27" r="5.5" fill={CHK.red} /><circle cx="70" cy="28" r="5" fill={CHK.red} /></g>
      <path d="M86 54q3-2.5 6 0M100 50q3-3 6 0" stroke={CHK.eye} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M94 57l11-1q1 3-2 4.5l-8 2z" fill={CHK.beak} /><path d="M95 61.5l8-1.5q-1 2.3-3 2.8z" fill={CHK.beakUnder} />
      <path d="M98 63q4 1 3.5 7-1 3-3.5 1.5-2.5-3 0-8.5z" fill={CHK.red} />
    </svg>
  );
}

function ChickenSprite({ state }: { state: "idle" | "hop" | "dead" | "won" }) {
  if (state !== "dead") return <div className="h-[94px] w-[84px]"><StandingChicken state={state} /></div>;
  return (
    <div className="relative h-[94px] w-[84px]">
      {/* squashes flat as the car lands, then the flattened chicken takes over */}
      <div className="chk-squash-out absolute inset-0"><StandingChicken state="squash" /></div>
      <div className="chk-splat-in absolute -left-[18px] top-[46px] h-[74px] w-[120px]"><FlatChicken /></div>
    </div>
  );
}

// ---- Vehicles (top-down, nose pointing down the screen) ----
type VehicleKind = "race" | "sedan" | "sports" | "taxi" | "police" | "pickup" | "van" | "bus" | "bike";
const PAINT = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#e5e7eb", "#64748b"];
/** Width on screen and how long it takes to cross the screen (seconds, min-max). Buses lumber, bikes zip. */
const VEHICLE: Record<VehicleKind, { w: number; speed: [number, number]; weight: number }> = {
  sedan: { w: 50, speed: [0.8, 1.05], weight: 5 }, sports: { w: 50, speed: [0.55, 0.7], weight: 3 }, race: { w: 54, speed: [0.45, 0.6], weight: 2 },
  taxi: { w: 50, speed: [0.8, 1.0], weight: 2 }, police: { w: 50, speed: [0.55, 0.75], weight: 1 }, pickup: { w: 52, speed: [0.85, 1.1], weight: 3 },
  van: { w: 54, speed: [1.0, 1.3], weight: 2 }, bus: { w: 60, speed: [1.3, 1.6], weight: 1 }, bike: { w: 24, speed: [0.5, 0.65], weight: 2 },
};
const KINDS = (Object.keys(VEHICLE) as VehicleKind[]).flatMap((k) => Array(VEHICLE[k].weight).fill(k) as VehicleKind[]);
const pickVehicle = (r = Math.random) => {
  const kind = KINDS[Math.floor(r() * KINDS.length)];
  const color = kind === "taxi" ? "#facc15" : kind === "police" ? "#f8fafc" : kind === "bus" ? (r() < 0.5 ? "#fbbf24" : "#2563eb") : PAINT[Math.floor(r() * PAINT.length)];
  const [lo, hi] = VEHICLE[kind].speed;
  return { kind, color, dur: lo + r() * (hi - lo) };
};

const GLASS = "#0f172a";
const TYRE = "#0b0f16";
const tyres = (x1: number, x2: number, ys: number[], w = 7, h = 16) => ys.flatMap((y) => [<rect key={`a${y}`} x={x1} y={y} width={w} height={h} rx="2.5" fill={TYRE} />, <rect key={`b${y}`} x={x2} y={y} width={w} height={h} rx="2.5" fill={TYRE} />]);

function Vehicle({ kind, color, width }: { kind: VehicleKind; color: string; width?: string }) {
  const w = VEHICLE[kind].w;
  let body: React.ReactNode, h = 110;
  switch (kind) {
    case "race":
      h = 100;
      body = <>
        {tyres(2, 47, [14, 66], 11, 20)}
        <path d="M8 6h44v10H8z" fill={color} />
        <path d="M18 14h24l4 30-4 44H18l-4-44z" fill={color} />
        <path d="M27 14h6v74h-6z" fill="#fff" opacity=".35" />
        <rect x="22" y="40" width="16" height="22" rx="6" fill={GLASS} /><circle cx="30" cy="51" r="5" fill="#f8fafc" />
        <path d="M8 88h44v8H8z" fill={color} />
      </>;
      break;
    case "sports":
      h = 104;
      body = <>
        {tyres(3, 50, [16, 70])}
        <path d="M14 4h32q8 0 9 10l2 64q0 22-27 24Q3 100 3 78l2-64Q6 4 14 4z" fill={color} />
        <path d="M8 8h44v6H8z" fill="#0b0f16" opacity=".55" />
        <path d="M24 4h4v96h-4zM32 4h4v96h-4z" fill="#fff" opacity=".7" />
        <path d="M13 30h34l-3 16H16z" fill={GLASS} /><path d="M12 64h36l-4 18H16z" fill={GLASS} />
        <rect x="8" y="96" width="10" height="4" rx="2" fill="#fde68a" /><rect x="42" y="96" width="10" height="4" rx="2" fill="#fde68a" />
      </>;
      break;
    case "taxi":
    case "police":
    case "sedan":
      h = 110;
      body = <>
        {tyres(2, 51, [18, 76])}
        <rect x="6" y="4" width="48" height="102" rx="14" fill={kind === "police" ? "#111827" : color} />
        {kind === "police" && <rect x="6" y="34" width="48" height="40" fill="#f8fafc" />}
        <rect x="11" y="18" width="38" height="13" rx="5" fill={GLASS} opacity=".9" />
        <rect x="11" y="33" width="38" height="34" rx="6" fill={kind === "police" ? "#f8fafc" : color} />
        <rect x="11" y="33" width="38" height="34" rx="6" fill="#000" opacity=".12" />
        <rect x="10" y="68" width="40" height="17" rx="6" fill={GLASS} />
        {kind === "taxi" && <>
          <rect x="20" y="44" width="20" height="10" rx="2" fill="#111827" /><rect x="22" y="46" width="16" height="6" rx="1" fill="#fde047" />
          <path d="M6 58h48v4H6z" fill="#111827" /><path d="M10 58h4v4h-4zM18 58h4v4h-4zM26 58h4v4h-4zM34 58h4v4h-4zM42 58h4v4h-4zM50 58h4v4h-4z" fill="#fde047" />
        </>}
        {kind === "police" && <>
          <rect x="13" y="45" width="17" height="8" rx="2" fill="#ef4444" /><rect x="30" y="45" width="17" height="8" rx="2" fill="#3b82f6" />
        </>}
        <rect x="9" y="5" width="10" height="4" rx="2" fill="#ef4444" /><rect x="41" y="5" width="10" height="4" rx="2" fill="#ef4444" />
        <rect x="9" y="101" width="11" height="4" rx="2" fill="#fde68a" /><rect x="40" y="101" width="11" height="4" rx="2" fill="#fde68a" />
        <rect x="1" y="66" width="6" height="5" rx="2" fill={kind === "police" ? "#111827" : color} /><rect x="53" y="66" width="6" height="5" rx="2" fill={kind === "police" ? "#111827" : color} />
      </>;
      break;
    case "pickup":
      h = 124;
      body = <>
        {tyres(2, 51, [16, 92])}
        <rect x="6" y="4" width="48" height="116" rx="10" fill={color} />
        <rect x="11" y="9" width="38" height="52" rx="4" fill="#000" opacity=".28" />
        <path d="M11 22h38M11 36h38M11 50h38" stroke="#000" strokeOpacity=".2" strokeWidth="2" />
        <rect x="10" y="66" width="40" height="12" rx="4" fill={GLASS} opacity=".9" />
        <rect x="10" y="78" width="40" height="18" rx="5" fill="#000" opacity=".12" />
        <rect x="9" y="97" width="42" height="15" rx="5" fill={GLASS} />
        <rect x="8" y="115" width="11" height="4" rx="2" fill="#fde68a" /><rect x="41" y="115" width="11" height="4" rx="2" fill="#fde68a" />
      </>;
      break;
    case "van":
      h = 132;
      body = <>
        {tyres(2, 51, [16, 100])}
        <rect x="5" y="3" width="50" height="126" rx="9" fill={color} />
        <rect x="10" y="10" width="40" height="88" rx="4" fill="#000" opacity=".1" />
        <path d="M14 18v72M46 18v72" stroke="#000" strokeOpacity=".22" strokeWidth="3" strokeLinecap="round" />
        <rect x="9" y="106" width="42" height="15" rx="5" fill={GLASS} />
        <rect x="8" y="124" width="11" height="4" rx="2" fill="#fde68a" /><rect x="41" y="124" width="11" height="4" rx="2" fill="#fde68a" />
      </>;
      break;
    case "bus":
      h = 190;
      body = <>
        {tyres(1, 52, [22, 150])}
        <rect x="4" y="3" width="52" height="184" rx="10" fill={color} />
        <rect x="9" y="12" width="42" height="150" rx="5" fill="#000" opacity=".1" />
        <rect x="16" y="40" width="28" height="20" rx="3" fill="#cbd5e1" /><rect x="16" y="100" width="28" height="20" rx="3" fill="#cbd5e1" />
        <path d="M18 46h24M18 52h24M18 106h24M18 112h24" stroke="#64748b" strokeWidth="2" />
        <rect x="8" y="166" width="44" height="14" rx="5" fill={GLASS} />
        <rect x="8" y="182" width="10" height="4" rx="2" fill="#fde68a" /><rect x="42" y="182" width="10" height="4" rx="2" fill="#fde68a" />
      </>;
      break;
    case "bike":
      h = 70;
      body = <>
        <rect x="11" y="2" width="8" height="18" rx="4" fill={TYRE} /><rect x="11" y="50" width="8" height="18" rx="4" fill={TYRE} />
        <rect x="9" y="16" width="12" height="36" rx="5" fill={color} />
        <path d="M2 46h26" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="15" cy="32" r="8" fill="#111827" /><circle cx="15" cy="34" r="5" fill={color} opacity=".85" />
        <rect x="12" y="64" width="6" height="4" rx="2" fill="#fde68a" />
      </>;
      break;
  }
  return <svg viewBox={`0 0 ${kind === "bike" ? 30 : 60} ${h}`} style={{ width: width ?? w }} className="block h-auto">{body}</svg>;
}

function Manhole({ open, className = "h-12 w-20" }: { open?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 80 50" className={className}>
      <ellipse cx="40" cy="25" rx="36" ry="22" fill="#2b3647" />
      <ellipse cx="40" cy="25" rx="30" ry="17" fill={open ? "#0b0f16" : "#344257"} stroke="#24303f" strokeWidth="3" />
      {!open && <path d="M28 17v16M36 15v20M44 15v20M52 17v16" stroke="#24303f" strokeWidth="4" strokeLinecap="round" />}
    </svg>
  );
}

const LANE_W = 112;
const JUMP_MS = 340;

function Chicken({ init, onBalance, tester }: { init: any; onBalance: (b: number) => void; tester: boolean }) {
  const [bet, setBet] = useState(10);
  const [level, setLevel] = useState<string>(init.round?.level ?? "medium");
  const [round, setRound] = useState<any>(init.round);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [hopping, setHopping] = useState(false);
  const [landing, setLanding] = useState<number | null>(null);
  const [traffic, setTraffic] = useState<{ id: number; lane: number; kind: VehicleKind; color: string; dur: number }[]>([]);
  const liveRound = round && round.status === "live";
  const over = round && round.status !== "live";
  const cars = CARS[round?.level ?? level];
  const lanes = ROAD - cars;
  const step = round?.step ?? 0;
  const dead = over && round.status === "lost";
  const pos = dead ? round.hit : landing ?? step;

  const act = (fn: () => Promise<any>, hop = false) => {
    setErr(null);
    // A Go jumps straight away (into the next lane) while the server decides; the result shows once it lands.
    // These updates sit outside the transition so they render now (transition updates wait for the request).
    if (hop) { setLanding(step + 1); setHopping(true); setTimeout(() => setHopping(false), JUMP_MS); }
    start(async () => {
      const [r] = await Promise.all([safe(fn), new Promise((ok) => setTimeout(ok, hop ? JUMP_MS - 20 : 0))]);
      setLanding(null);
      if (isErr(r)) return setErr(r.error);
      setRound(r.round); onBalance(r.balance);
    });
  };

  // Background traffic in the lanes ahead, for a bit of life.
  useEffect(() => {
    let id = 0;
    const t = setInterval(() => {
      const ahead = Math.max(1, pos + 1);
      const lane = ahead + Math.floor(Math.random() * Math.min(6, Math.max(1, lanes - ahead + 1)));
      if (lane > lanes) return;
      const car = { id: ++id, lane, ...pickVehicle() };
      setTraffic((x) => (x.some((c) => c.lane === lane) ? x : [...x.slice(-7), car]));
      setTimeout(() => setTraffic((x) => x.filter((c) => c.id !== car.id)), car.dur * 1000 + 100);
    }, 480);
    return () => clearInterval(t);
  }, [pos, lanes]);

  // The vehicle that gets the chicken is picked from the round id, so it stays the same on every render.
  const hitter = useMemo(() => { let x = (round?.id ?? 1) * 9301 + 49297; const r = () => ((x = (x * 9301 + 49297) % 233280) / 233280); return pickVehicle(r); }, [round?.id]);
  const shift = Math.max(0, pos - 2) * LANE_W;
  const chickenState = dead ? "dead" : hopping ? "hop" : over && round.status === "won" ? "won" : "idle";

  return (
    <Shell stageClass="bg-[#121a26]" controls={<>
      <BetField value={bet} onChange={setBet} disabled={!!liveRound} />
      <div>
        <Label left="Difficulty" right={`${lanes} lanes`} />
        <select value={level} disabled={!!liveRound} onChange={(e) => setLevel(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-white ring-1 ring-white/10 outline-none disabled:opacity-60" style={{ background: C.field }}>
          <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="expert">Expert</option>
        </select>
      </div>
      {liveRound ? (
        <>
          <BigButton onClick={() => act(A.chickenCashout)} disabled={pending || step === 0}>Cashout {step > 0 && <Coins n={Math.floor(round.stake * round.multiplier)} />}</BigButton>
          <BigButton tone="grey" onClick={() => act(A.chickenStep, true)} disabled={pending}>Go</BigButton>
        </>
      ) : (
        <BigButton onClick={() => act(() => A.chickenStart(bet, level))} disabled={pending}>Bet</BigButton>
      )}
      <ProfitField label="Total Profit" mult={liveRound || (over && round.status === "won") ? round.multiplier : 1} amount={liveRound || (over && round.status === "won") ? Math.floor(round.stake * round.multiplier) - round.stake : 0} />
      <Err text={err} />
      {over && <p className={`text-sm font-bold ${dead ? "text-red-500" : "text-[#22e36b]"}`}>{dead ? `Hit in lane ${round.hit}. Lost ${round.stake.toLocaleString("en-US")}.` : `Crossed ${round.step} lanes: +${(round.payout - round.stake).toLocaleString("en-US")}`}</p>}
      {tester && <p className="text-xs text-zinc-500">Test mode: bets are free.</p>}
    </>}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 left-0 flex transition-transform duration-500 ease-out" style={{ transform: `translateX(${-shift}px)` }}>
          {/* Start: sidewalk with a traffic light and a bush */}
          <div className="relative w-[150px] shrink-0 bg-[#1b2433]">
            <div className="absolute inset-y-0 right-0 w-5 bg-[repeating-linear-gradient(180deg,#2b3647_0_70px,#1b2433_70px_80px)]" />
            <svg viewBox="0 0 60 150" className="absolute left-6 top-8 h-40 w-16">
              <rect x="6" y="2" width="48" height="30" rx="15" fill="#2b3647" />
              <circle cx="20" cy="17" r="10" fill={liveRound ? "#f59e0b" : "#16a34a"} /><circle cx="40" cy="17" r="10" fill="#111827" />
              <rect x="26" y="32" width="8" height="90" fill="#2b3647" /><ellipse cx="30" cy="128" rx="18" ry="10" fill="#2b3647" />
            </svg>
            <svg viewBox="0 0 80 60" className="absolute bottom-6 left-4 h-20 w-28"><path d="M8 50c-6-10 2-22 12-20 2-12 18-16 24-6 8-8 24-2 22 10 12 2 12 18 2 20z" fill="#253041" /></svg>
          </div>
          {/* Lanes */}
          {Array.from({ length: lanes }, (_, i) => i + 1).map((n) => {
            const passed = n < pos || (n === pos && !dead);
            const isHit = dead && n === round.hit;
            return (
              <div key={n} className="relative shrink-0 border-r-[3px] border-dashed border-white/10" style={{ width: LANE_W }}>
                {/* Vehicles sit in a full-width centred column; the animation only moves them down the lane. */}
                {traffic.filter((c) => c.lane === n && !isHit).map((c) => (
                  <div key={c.id} className="pointer-events-none absolute inset-x-0 top-0 z-[5] flex justify-center">
                    <div className="anim-car-pass" style={{ animationDuration: `${c.dur}s` }}><Vehicle kind={c.kind} color={c.color} /></div>
                  </div>
                ))}
                {/* The car that gets the chicken drives straight over it and on off the screen. */}
                {isHit && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
                    <div className="anim-car-runover"><Vehicle kind={hitter.kind} color={hitter.color} /></div>
                  </div>
                )}
                <div className="absolute left-1/2 top-[54%] -translate-x-1/2">
                  {passed && !isHit ? (
                    <svg viewBox="0 0 80 50" className="h-12 w-20"><rect x="6" y="10" width="68" height="30" rx="8" fill="#3b2f12" /><path d="M14 10l14 30M34 10l14 30M54 10l14 30" stroke="#f59e0b" strokeWidth="7" /></svg>
                  ) : <Manhole />}
                </div>
                <div className={`absolute left-1/2 top-[68%] -translate-x-1/2 rounded-xl px-3 py-2 font-mono text-sm font-bold transition ${passed && !isHit ? "text-[#06240f]" : "text-white"}`}
                  style={{ background: passed && !isHit ? C.green : C.raised }}>{fmtX(chickenMult(cars, n))}</div>
              </div>
            );
          })}
          <div className="relative w-[150px] shrink-0 bg-[#1b2433]"><p className="absolute inset-x-0 top-1/2 text-center text-xs font-black uppercase tracking-[0.3em] text-[#22e36b]">Safe</p></div>
        </div>
        {/* The chicken hops lane to lane */}
        <div className="absolute top-[38%] z-10 transition-transform duration-[340ms] [transition-timing-function:cubic-bezier(.45,.05,.3,1)]" style={{ transform: `translateX(${(pos === 0 ? 75 : 150 + (pos - 1) * LANE_W + LANE_W / 2) - shift - 42}px)` }}>
          <ChickenSprite state={chickenState} />
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- Mines

function GemIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-3/5 w-3/5">
      <path d="M12 8h24l10 12-22 22L2 20z" fill="#22e36b" /><path d="M2 20h44L24 42z" fill="#16b955" /><path d="M12 8l6 12h12l6-12" fill="#7dfba9" /><path d="M18 20l6 22 6-22" fill="#1fd862" />
    </svg>
  );
}
function BombIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-3/5 w-3/5">
      <circle cx="22" cy="28" r="15" fill="#ef4444" /><circle cx="17" cy="23" r="4" fill="#fca5a5" />
      <rect x="27" y="9" width="8" height="8" rx="2" transform="rotate(45 31 13)" fill="#7f1d1d" /><path d="M34 10c3-4 7-4 9-1" stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="44" cy="8" r="3" fill="#fde047" />
    </svg>
  );
}

function Mines({ init, onBalance, tester }: { init: any; onBalance: (b: number) => void; tester: boolean }) {
  const [bet, setBet] = useState(10);
  const [count, setCount] = useState<number>(init.round?.count ?? 3);
  const [round, setRound] = useState<any>(init.round);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [last, setLast] = useState<number | null>(null);
  const liveRound = round && round.status === "live";
  const over = round && round.status !== "live";
  const act = (fn: () => Promise<any>) => start(async () => { setErr(null); const r = await safe(fn); if (isErr(r)) return setErr(r.error); setRound(r.round); onBalance(r.balance); });
  const pick = (i: number | "random") => start(async () => {
    setErr(null);
    const r = await safe(() => A.minesPick(i));
    if (isErr(r)) return setErr(r.error);
    if (r.round) setLast(r.round.picks[r.round.picks.length - 1]);
    setRound(r.round); onBalance(r.balance);
  });
  const picks: number[] = round?.picks ?? [];
  const mines: number[] | null = round?.mines ?? null;
  const m = liveRound || over ? round.count : count;
  const mult = round?.multiplier ?? 1;

  return (
    <Shell controls={<>
      <BetField value={bet} onChange={setBet} disabled={!!liveRound} />
      <div>
        <Label left="Mines" right={<span className="font-sans text-sm text-zinc-500">Gems</span>} />
        <div className="flex items-center gap-3 rounded-lg px-3 py-3 ring-1 ring-white/10" style={{ background: C.field }}>
          <span className="w-6 text-center font-mono text-white">{m}</span>
          <input type="range" min={1} max={24} value={m} disabled={!!liveRound} onChange={(e) => setCount(Number(e.target.value))} className="flex-1 accent-[#3b82f6]" />
          <span className="w-6 text-center font-mono text-white">{25 - m}</span>
        </div>
      </div>
      {liveRound
        ? <BigButton tone="green" onClick={() => act(A.minesCashout)} disabled={pending || picks.length === 0}>Cashout <Coins n={Math.floor(round.stake * mult)} /></BigButton>
        : <BigButton onClick={() => act(() => A.minesStart(bet, count))} disabled={pending}>Bet</BigButton>}
      <BigButton tone="grey" onClick={() => pick("random")} disabled={!liveRound || pending}>Random Pick</BigButton>
      <ProfitField label="Total Profit" mult={liveRound || (over && round.status === "won") ? mult : 1} amount={liveRound || (over && round.status === "won") ? Math.floor(round.stake * mult) - round.stake : 0} />
      {liveRound && <p className="text-sm text-zinc-500">Next gem: <span className="font-mono text-white">{fmtX(round.next)}</span></p>}
      <Err text={err} />
      {over && <p className={`text-sm font-bold ${round.status === "lost" ? "text-red-500" : "text-[#22e36b]"}`}>{round.status === "lost" ? `Boom. Lost ${round.stake.toLocaleString("en-US")}.` : `Cashed out at ${fmtX(round.multiplier)}: +${(round.payout - round.stake).toLocaleString("en-US")}`}</p>}
      {tester && <p className="text-xs text-zinc-500">Test mode: bets are free.</p>}
    </>}>
      <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
        <div className="grid w-full max-w-[520px] grid-cols-5 gap-3">
          {Array.from({ length: 25 }, (_, i) => {
            const picked = picks.includes(i);
            const isMine = mines?.includes(i);
            const boom = round?.boom === i;
            const revealed = picked || over;
            const fresh = i === last;
            return (
              <button key={i} type="button" disabled={!liveRound || picked || pending} onClick={() => pick(i)}
                className={`group grid aspect-square place-items-center rounded-xl transition-all duration-150 ${revealed ? "" : "hover:-translate-y-1 hover:brightness-125 active:translate-y-0"}`}
                style={{
                  background: boom ? "#4a1d24" : revealed ? (picked ? "#0b1a14" : "#0b0f16") : C.raised,
                  boxShadow: revealed ? "inset 0 0 0 2px rgba(255,255,255,.04)" : "0 6px 0 #1c2533",
                  opacity: over && !picked && !boom ? 0.4 : 1,
                  transform: over && !picked && !boom ? "scale(.92)" : undefined,
                }}>
                {revealed && (isMine ? <span className={boom || fresh ? "anim-tile-pop grid h-full w-full place-items-center" : "grid h-full w-full place-items-center"}><BombIcon /></span>
                  : over || picked ? <span className={fresh ? "anim-tile-pop grid h-full w-full place-items-center" : "grid h-full w-full place-items-center"}><GemIcon /></span> : null)}
              </button>
            );
          })}
        </div>
        <span className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: C.raised }}>Max Multiplier {fmtX(minesMult(m, 25 - m))}</span>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- Blackjack

const RANK = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
function Suit({ s, className = "" }: { s: number; className?: string }) {
  const d = [
    "M12 2C9 7 3 9 3 14a4.5 4.5 0 0 0 8 2.8L10 22h4l-1-5.2A4.5 4.5 0 0 0 21 14c0-5-6-7-9-12z",
    "M12 21C5 15 2 12 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 4-3 7-10 13z",
    "M12 2l8 10-8 10-8-10z",
    "M12 2a4 4 0 0 1 3.6 5.8A4 4 0 1 1 13.5 15L14.5 22h-5l1-7a4 4 0 1 1-2.1-7.2A4 4 0 0 1 12 2z",
  ][s];
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d={d} /></svg>;
}

function PlayingCard({ c, hidden, index }: { c?: { r: number; s: number }; hidden?: boolean; index: number }) {
  const red = c && (c.s === 1 || c.s === 2);
  return (
    <div className="anim-card-deal relative h-[124px] w-[88px] shrink-0 [perspective:800px]" style={{ animationDelay: `${index * 0.12}s`, marginLeft: index ? -44 : 0 }}>
      <div className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${hidden ? "[transform:rotateY(180deg)]" : ""}`}>
        <div className="absolute inset-0 flex flex-col justify-between rounded-lg bg-[#fff] p-2 shadow-[0_6px_14px_rgba(0,0,0,.45)] [backface-visibility:hidden]" style={{ color: red ? "#e11d48" : "#0b0f17" }}>
          {c && <>
            <div className="leading-none"><p className="text-xl font-black">{RANK[c.r]}</p><Suit s={c.s} className="mt-0.5 h-5 w-5" /></div>
            <Suit s={c.s} className="h-10 w-10 self-end opacity-90" />
          </>}
        </div>
        <div className="absolute inset-0 rounded-lg border-4 border-[#fff] [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ background: "#1f6fe0", backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 5px, transparent 5px 12px)" }} />
      </div>
    </div>
  );
}

function HandValue({ v, tone, final }: { v: { total: number; soft: boolean } | null; tone?: "win" | "lose" | "push" | null; final?: boolean }) {
  if (!v) return null;
  const bg = tone === "win" ? C.green : tone === "lose" ? "#ef4444" : tone === "push" ? "#f59e0b" : C.raised;
  const text = v.soft && v.total < 21 && !final ? `${v.total - 10}, ${v.total}` : String(v.total);
  return <span className="rounded-full px-3 py-1 font-mono text-sm font-bold" style={{ background: bg, color: tone === "win" ? "#06240f" : "#fff" }}>{text}</span>;
}

function ActionButton({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex items-center justify-center gap-2 rounded-lg py-3.5 font-bold text-white transition hover:brightness-125 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40" style={{ background: C.raised }}>
      {label}{icon}
    </button>
  );
}

function Blackjack({ init, onBalance, tester }: { init: any; onBalance: (b: number) => void; tester: boolean }) {
  const [bet, setBet] = useState(10);
  const [round, setRound] = useState<any>(init.round);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<any>) => start(async () => { setErr(null); const r = await safe(fn); if (isErr(r)) return setErr(r.error); setRound(r.round); onBalance(r.balance); });
  const liveRound = round && round.status === "live";
  const over = round && round.status !== "live";
  const playing = liveRound && round.phase === "play";
  const toneFor = (res: string | null) => (!res ? null : /Win|Dealer busts|Blackjack$/.test(res) ? "win" : res === "Push" ? "push" : "lose");
  const dealerTone = over ? (round.hands.every((h: any) => toneFor(h.result) === "lose") ? "win" : round.hands.some((h: any) => toneFor(h.result) === "win") ? "lose" : "push") : null;
  const won = over && round.payout > 0 && round.status === "won";
  const deck = useMemo(() => Array.from({ length: 5 }), []);

  return (
    <Shell controls={<>
      <BetField value={bet} onChange={setBet} disabled={!!liveRound} />
      {liveRound && round.phase === "insurance" ? (
        <div className="space-y-2 rounded-lg p-3 ring-1 ring-white/10" style={{ background: C.field }}>
          <p className="text-sm font-bold text-white">Dealer shows an ace. Take insurance?</p>
          <p className="text-xs text-zinc-500">Costs <Coins n={Math.floor(round.stake / 2)} />, pays 2 to 1 if the dealer has blackjack.</p>
          <div className="grid grid-cols-2 gap-2">
            <BigButton onClick={() => act(() => A.bjInsurance(true))} disabled={pending}>Accept</BigButton>
            <BigButton tone="grey" onClick={() => act(() => A.bjInsurance(false))} disabled={pending}>No</BigButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <ActionButton label="Hit" disabled={!playing || pending} onClick={() => act(() => A.bjAction("hit"))}
            icon={<svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-400" fill="currentColor"><rect x="5" y="3" width="11" height="15" rx="2" /><path d="M19 12v7l-2.5-2.5M19 19l2.5-2.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>} />
          <ActionButton label="Stand" disabled={!playing || pending} onClick={() => act(() => A.bjAction("stand"))}
            icon={<svg viewBox="0 0 24 24" className="h-5 w-5 text-violet-400" fill="currentColor"><path d="M8 11V5a1.5 1.5 0 0 1 3 0v5h.5V3.5a1.5 1.5 0 0 1 3 0V10h.5V5a1.5 1.5 0 0 1 3 0v8c0 5-3 8-7 8s-6-2-7.5-5L3 12a1.5 1.5 0 0 1 2.5-1.5L8 13z" /></svg>} />
          <ActionButton label="Split" disabled={!playing || !round.canSplit || pending} onClick={() => act(() => A.bjAction("split"))}
            icon={<svg viewBox="0 0 24 24" className="h-5 w-5 text-zinc-500" fill="currentColor"><rect x="3" y="5" width="10" height="14" rx="2" transform="rotate(-12 8 12)" /><rect x="11" y="5" width="10" height="14" rx="2" transform="rotate(12 16 12)" /></svg>} />
          <ActionButton label="Double" disabled={!playing || !round.canDouble || pending} onClick={() => act(() => A.bjAction("double"))}
            icon={<span className="text-sm text-zinc-500">×2</span>} />
        </div>
      )}
      <BigButton onClick={() => act(() => A.bjStart(bet))} disabled={!!liveRound || pending}>Bet</BigButton>
      <Err text={err} />
      {over && <p className={`text-sm font-bold ${won ? "text-[#22e36b]" : round.status === "push" ? "text-amber-400" : "text-red-500"}`}>{round.result}{round.payout ? `: paid ${round.payout.toLocaleString("en-US")}` : ""}</p>}
      {tester && <p className="text-xs text-zinc-500">Test mode: bets are free.</p>}
    </>}>
      <div className="relative flex h-full min-h-[520px] flex-col items-center justify-between px-6 py-8">
        {/* Shoe */}
        <div className="absolute right-8 top-0">
          {deck.map((_, i) => <div key={i} className="absolute h-[96px] w-[72px] -translate-y-1/2 rounded-md border-[3px] border-[#fff]" style={{ right: 0, top: 30 + i * 3, background: "#1f6fe0" }} />)}
        </div>
        {/* Dealer */}
        <div className="flex min-h-[170px] flex-col items-center gap-2">
          {round && <>
            <div className="flex">{round.dealer.map((c: any, i: number) => <PlayingCard key={`d${round.id}-${i}`} c={c} index={i} />)}{round.hidden ? <PlayingCard key={`dh${round.id}`} hidden index={round.dealer.length} /> : null}</div>
            <HandValue v={round.dealerValue} tone={dealerTone as any} final={!!over} />
          </>}
        </div>
        {/* Table banner */}
        <div className="pointer-events-none text-center">
          <div className="relative mx-auto inline-block px-10 py-2.5" style={{ background: "#1a2535" }}>
            <span className="absolute -left-6 top-3 h-full w-8 skew-y-[20deg]" style={{ background: "#162030" }} />
            <span className="absolute -right-6 top-3 h-full w-8 -skew-y-[20deg]" style={{ background: "#162030" }} />
            <p className="relative text-sm font-black uppercase tracking-wider text-zinc-500">Blackjack pays 3 to 2</p>
          </div>
          <p className="mt-2 text-sm font-black uppercase tracking-wider text-zinc-500">Insurance pays 2 to 1</p>
        </div>
        {/* Player hands */}
        <div className="flex min-h-[170px] flex-wrap items-start justify-center gap-10">
          {round?.hands.map((h: any, hi: number) => (
            <div key={hi} className={`flex flex-col items-center gap-2 rounded-xl p-2 transition ${h.active && round.hands.length > 1 ? "ring-2 ring-[#3b82f6]" : ""}`}>
              <div className="flex">{h.cards.map((c: any, i: number) => <PlayingCard key={`p${round.id}-${hi}-${i}`} c={c} index={i} />)}</div>
              <div className="flex items-center gap-2"><HandValue v={h.value} tone={toneFor(h.result) as any} final={!!over || h.done} />{h.doubled && <span className="text-xs font-bold text-zinc-500">×2</span>}</div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
