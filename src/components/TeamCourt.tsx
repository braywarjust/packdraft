"use client";

import { askConfirm } from "./Confirm";
import { BoltIcon, LockIcon } from "./Icons";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { LivePlayer } from "@/lib/league";
import { Headshot, InjuryTag } from "./Headshot";
import { TeamLogo } from "./TeamLogo";
import { TeamBadge, type BrandLite } from "./TeamBadge";
import { BoostChip, BoostModal, LineupEditor, type BoostProps } from "./LineupEditor";
import { Fpts } from "@/components/Fpts";
import { PlayerButton } from "@/components/PlayerInspector";

const lbl = (s: string) => s.replace(/\d$/, "");
const eligible = (slot: string, pos: string) => slot === "BN" || lbl(slot) === "UTIL" || lbl(slot) === pos;
// Starting five on the court (basket at the bottom): guards up top, forwards on the wings, centre in the paint.
const COURT: { slot: string; x: number; y: number }[] = [
  { slot: "G1", x: 29, y: 6 }, { slot: "G2", x: 71, y: 6 },
  { slot: "F1", x: 17, y: 38 }, { slot: "F2", x: 83, y: 38 },
  { slot: "C", x: 50, y: 62 },
];
const UTIL = ["UTIL1", "UTIL2", "UTIL3"];
const VIEW_KEY = "pd-team-view";

type Props = {
  players: LivePlayer[]; editable: boolean; brand: BrandLite;
  setSlot?: (playerId: number, slot: string) => Promise<unknown>;
  autoSet?: () => Promise<unknown>;
  drop?: (playerId: number) => Promise<unknown>;
  boost?: BoostProps;
};

/** Half-court floor in the team's colours with the logo at centre. */
function Court({ brand }: { brand: BrandLite }) {
  return (
    <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={brand.color} stopOpacity=".55" />
          <stop offset="1" stopColor={brand.alt} stopOpacity=".35" />
        </linearGradient>
        <pattern id="planks" width="6" height="80" patternUnits="userSpaceOnUse"><rect width=".15" height="80" fill="#fff" opacity=".06" /></pattern>
      </defs>
      <rect width="100" height="80" fill="url(#floor)" />
      <rect width="100" height="80" fill="url(#planks)" />
      <g fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth=".45" vectorEffect="non-scaling-stroke">
        <rect x="1" y="1" width="98" height="78" />
        {/* half-court line + centre circle at the top */}
        <path d="M37 1 A13 13 0 0 0 63 1" />
        {/* paint, free-throw circle, restricted area, rim */}
        <rect x="36" y="49" width="28" height="30" fill={brand.color} fillOpacity=".25" />
        <path d="M36 49 A14 11 0 0 1 64 49" />
        <path d="M36 49 A14 11 0 0 0 64 49" strokeDasharray="1.5 1.5" />
        <path d="M44 74 A6 5 0 0 1 56 74" />
        <circle cx="50" cy="75.5" r="1.2" stroke="#fb923c" strokeOpacity=".9" />
        <path d="M45 77.5 H55" strokeOpacity=".6" />
        {/* three-point line */}
        <path d="M7 79 V60 A43 43 0 0 1 93 60 V79" />
      </g>
    </svg>
  );
}

function PlayerTile({ p, slot, big, brand, state }: {
  p: LivePlayer | undefined; slot: string; big?: boolean; brand: BrandLite;
  state: { selected: boolean; target: boolean; editable: boolean; boostable: boolean; pending: boolean; onMove: () => void; onTarget: () => void; onBoost: () => void };
}) {
  const live = p?.now?.state === "in";
  const head = big ? 68 : 52;
  return (
    <div className={`group relative w-full overflow-hidden rounded-2xl border bg-[#141a26]/90 shadow-xl shadow-black/40 backdrop-blur transition
      ${state.selected ? "border-white ring-2 ring-white/70" : state.target ? "border-emerald-400 ring-2 ring-emerald-400/60" : live ? "border-red-500/70" : "border-white/10"}`}>
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${brand.color}, ${brand.alt})` }} />
      <div className="flex items-center justify-between px-3 pt-2">
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white" style={{ background: brand.color }}>{lbl(slot)}</span>
        {p && <span className="flex items-center gap-1"><BoostChip boost={p.boost} />{p.locked && <LockIcon className="text-xs text-zinc-400" title="Locked: game started" />}</span>}
      </div>
      {p ? (
        <div className="px-3 pb-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Headshot src={p.headshot} name={p.name} size={head} className="ring-2" />
              <TeamLogo team={p.team} size={big ? 24 : 20} className="absolute -bottom-1 -right-1" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`line-clamp-2 font-black leading-tight text-white ${big ? "text-lg" : "text-base"}`}><PlayerButton id={p.id}>{p.name}</PlayerButton></p>
              <p className="text-xs text-zinc-400">{p.pos} · {p.team} <InjuryTag injury={p.injury} /></p>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">{p.played}/{p.total} GP</p>
              <p className="mt-0.5 whitespace-nowrap font-mono text-xs font-bold text-zinc-800"><span className="text-[10px] font-black uppercase tracking-wider text-fpts">Proj </span><Fpts n={p.proj} />/g</p>
            </div>
            <div className="text-right">
              <p className={`font-mono font-black leading-none text-white ${big ? "text-3xl" : "text-2xl"}`}><Fpts n={p.pts} iconClass="text-[0.75em]" /></p>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">wk pts</p>
            </div>
          </div>
          <p className="mt-2 truncate text-[11px] text-zinc-400">
            {p.now ? (live ? <span className="font-semibold text-red-400">● {p.now.clock} {p.now.label}</span> : <>{p.now.label} · {p.now.clock}</>) : "No games this week"}
            {p.now?.line && p.now.state !== "pre" ? <span className="text-zinc-300"> · {p.now.line}</span> : null}
          </p>
        </div>
      ) : (
        <div className="grid h-20 place-items-center text-sm text-zinc-500">Empty</div>
      )}
      {state.editable && (state.target || (p && !p.locked)) && (
        <div className="flex gap-1.5 border-t border-white/5 px-3 py-2">
          {state.target ? (
            <button disabled={state.pending} onClick={state.onTarget} className="btn-lime flex-1 px-2 py-1 text-xs">Move here</button>
          ) : (
            <>
              <button onClick={state.onMove} className="btn-ghost flex-1 px-2 py-1 text-xs">{state.selected ? "Cancel" : "Move"}</button>
              {state.boostable && <button onClick={state.onBoost} className="btn-ghost flex-1 px-2 py-1 text-xs"><BoltIcon /> {p?.boost?.state === "pre" ? "Change" : "Boost"}</button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function TeamCourt(props: Props) {
  const { players, editable, brand, setSlot, autoSet, drop, boost } = props;
  const router = useRouter();
  const [view, setView] = useState<"court" | "list">("court");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [boosting, setBoosting] = useState<LivePlayer | null>(null);
  useEffect(() => { try { if (localStorage.getItem(VIEW_KEY) === "list") setView("list"); } catch {} }, []);
  const pick = (v: "court" | "list") => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch {} };

  const act = (fn: () => Promise<unknown>) => start(async () => {
    const r = (await fn()) as { error?: string } | undefined;
    setErr(r?.error ?? "");
    setSelected(null);
    router.refresh();
  });
  const bySlot = new Map(players.filter((p) => p.slot !== "BN").map((p) => [p.slot, p]));
  const bench = players.filter((p) => p.slot === "BN");
  const sel = players.find((p) => p.id === selected);
  const canBoost = new Map((boost?.boostable ?? []).map((b) => [b.playerId, b]));
  const starters = [...bySlot.values()].reduce((s, p) => s + p.pts, 0);

  const stateFor = (slot: string, p: LivePlayer | undefined) => ({
    selected: !!p && selected === p.id,
    target: !!(editable && sel && sel.id !== p?.id && eligible(slot, sel.pos) && !(p && p.locked) && !sel.locked && (slot !== "BN" || sel.slot !== "BN")),
    editable, pending,
    boostable: !!p && canBoost.has(p.id),
    onMove: () => p && setSelected(selected === p.id ? null : p.id),
    onTarget: () => sel && act(() => setSlot!(sel.id, slot)),
    onBoost: () => p && setBoosting(p),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {editable && view === "court" && <button className="btn-primary" disabled={pending} onClick={() => act(() => autoSet!())}><BoltIcon /> Start my active players</button>}
        {editable && view === "court" && sel && (
          <>
            <span className="text-sm text-zinc-700">Moving <b>{sel.name}</b>: tap a green spot</span>
            {sel.slot !== "BN" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => act(() => setSlot!(sel.id, "BN"))}>Bench him</button>}
            <button className="btn-danger px-2 py-1 text-xs" onClick={async () => { if (await askConfirm(`Drop ${sel.name}?`, { confirmLabel: "Drop", danger: true })) act(() => drop!(sel.id)); }}>Drop</button>
          </>
        )}
        {err && <span className="text-sm text-red-600">{err}</span>}
        <div className="ml-auto flex rounded-lg bg-panel2 p-1 text-xs font-semibold">
          <button onClick={() => pick("court")} className={`rounded-md px-3 py-1.5 ${view === "court" ? "bg-brand text-white" : "text-zinc-500"}`}>Court</button>
          <button onClick={() => pick("list")} className={`rounded-md px-3 py-1.5 ${view === "list" ? "bg-brand text-white" : "text-zinc-500"}`}>List</button>
        </div>
      </div>

      {view === "list" ? (
        <LineupEditor {...{ players, editable, setSlot, autoSet, drop, boost }} />
      ) : (
        <>
          {/* Court: starting five in position */}
          <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            <Court brand={brand} />
            {/* big team logo painted on the floor */}
            <div className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 opacity-[0.18]">
              <TeamBadge brand={brand} size={300} ghost />
            </div>
            <div className="relative hidden min-h-[720px] md:block">
              {COURT.map(({ slot, x, y }) => (
                <div key={slot} className="absolute w-[300px] max-w-[40%] -translate-x-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                  <PlayerTile p={bySlot.get(slot)} slot={slot} big brand={brand} state={stateFor(slot, bySlot.get(slot))} />
                </div>
              ))}
              <div className="absolute bottom-4 left-4 rounded-xl bg-black/40 px-3 py-2 backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Starters this week</p>
                <p className="font-mono text-2xl font-black text-white"><Fpts n={starters} iconClass="text-[0.75em]" /></p>
              </div>
            </div>
            {/* phones: stack the five */}
            <div className="relative grid gap-3 p-3 md:hidden">
              {COURT.map(({ slot }) => <PlayerTile key={slot} p={bySlot.get(slot)} slot={slot} brand={brand} state={stateFor(slot, bySlot.get(slot))} />)}
            </div>
          </section>

          {/* Utility + bench */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest" style={{ color: brand.alt }}>
              <span className="h-4 w-1 rounded" style={{ background: brand.color }} /> Utility
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {UTIL.map((slot) => <PlayerTile key={slot} p={bySlot.get(slot)} slot={slot} brand={brand} state={stateFor(slot, bySlot.get(slot))} />)}
            </div>
          </section>
          <section className="relative space-y-2 overflow-hidden rounded-2xl border border-white/10 p-4" style={{ background: `linear-gradient(180deg, ${brand.color}22, transparent)` }}>
            <div className="pointer-events-none absolute -right-10 -top-10 opacity-[0.08]"><TeamBadge brand={brand} size={260} ghost /></div>
            <h3 className="relative flex items-center gap-2 text-sm font-black uppercase tracking-widest" style={{ color: brand.alt }}>
              <span className="h-4 w-1 rounded" style={{ background: brand.color }} /> Bench <span className="text-xs font-semibold normal-case tracking-normal text-zinc-500">(points don&apos;t count)</span>
            </h3>
            <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bench.map((p) => <PlayerTile key={p.id} p={p} slot="BN" brand={brand} state={stateFor("BN", p)} />)}
              {sel && sel.slot !== "BN" && (
                <button onClick={() => act(() => setSlot!(sel.id, "BN"))} className="grid min-h-24 place-items-center rounded-2xl border-2 border-dashed border-emerald-400/60 text-sm text-emerald-400">Bench {sel.name}</button>
              )}
              {bench.length === 0 && !sel && <p className="text-sm text-zinc-500">Nobody on the bench.</p>}
            </div>
          </section>
        </>
      )}

      {boost && boosting && (
        <BoostModal boost={boost} player={boosting} info={canBoost.get(boosting.id)} pending={pending} onClose={() => setBoosting(null)}
          run={(fn) => { setBoosting(null); act(fn); }} />
      )}
    </div>
  );
}
