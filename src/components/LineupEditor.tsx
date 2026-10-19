"use client";

import { askConfirm } from "./Confirm";
import { BoltIcon, LockIcon, StarIcon, XIcon } from "./Icons";
import { TeamLogo } from "./TeamLogo";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { LivePlayer } from "@/lib/league";
import type { BoostSlab } from "@/lib/boost";
import { SlabFace } from "./SlabFace";
import { fmtMult } from "@/lib/packs";
import { Headshot, InjuryTag } from "./Headshot";
import { Fpts } from "@/components/Fpts";
import { PlayerButton } from "@/components/PlayerInspector";
import { useScrollLock } from "@/components/useScrollLock";

const STARTERS = ["G1", "G2", "F1", "F2", "C", "UTIL1", "UTIL2", "UTIL3"];

export type BoostProps = {
  slabs: BoostSlab[];
  boostable: { playerId: number; dayKey: string; day: string }[];
  /** `${cardId}|${dayKey}` → the player that slab is already on that night (any league). */
  busy: Record<string, string>;
  set: (playerId: number, cardId: number) => Promise<unknown>;
  clear: (playerId: number) => Promise<unknown>;
};

/** Bolt + "×2.31" chip for a boosted player. */
export function BoostChip({ boost }: { boost: LivePlayer["boost"] }) {
  if (!boost) return null;
  const live = boost.state === "in";
  return (
    <span title={`Slab boost ${fmtMult(boost.mult)}${boost.own ? " (his own slab)" : ""}${boost.state === "pre" ? " on his next game" : ""}`}
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${live ? "animate-pulse bg-amber-400 text-black" : "bg-amber-50 text-amber-600"}`}>
      <BoltIcon />{fmtMult(boost.mult)}{boost.own && <StarIcon className="ml-0.5" />}
    </span>
  );
}
const lbl = (s: string) => s.replace(/\d$/, "");
const eligible = (slot: string, pos: string) => slot === "BN" || lbl(slot) === "UTIL" || lbl(slot) === pos;

export function LineupEditor({
  players, editable, setSlot, autoSet, drop, boost,
}: {
  players: LivePlayer[];
  editable: boolean;
  boost?: BoostProps;
  setSlot?: (playerId: number, slot: string) => Promise<{ error?: string } | unknown>;
  autoSet?: () => Promise<unknown>;
  drop?: (playerId: number) => Promise<{ error?: string } | unknown>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [boosting, setBoosting] = useState<LivePlayer | null>(null);
  const canBoost = new Map((boost?.boostable ?? []).map((b) => [b.playerId, b]));

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      setErr(r?.error ?? "");
      setSelected(null);
      router.refresh();
    });

  const bySlot = new Map(players.filter((p) => p.slot !== "BN").map((p) => [p.slot, p]));
  const bench = players.filter((p) => p.slot === "BN");
  const sel = players.find((p) => p.id === selected);
  const weekPts = players.reduce((s, p) => s + p.pts, 0);

  const row = (slot: string, p: LivePlayer | undefined) => {
    const canTarget = editable && sel && sel.id !== p?.id && eligible(slot, sel.pos) && !(p && p.locked) && !sel.locked;
    const today = p?.now;
    return (
      <tr key={slot + (p?.id ?? "")} className={`border-t border-line/60 ${selected === p?.id ? "bg-brand/10" : ""} ${canTarget ? "bg-red-500/5" : ""}`}>
        <td className="py-2 pl-3"><span className={`pos pos-${lbl(slot)}`}>{lbl(slot)}</span></td>
        <td className="py-2">
          {p ? (
            <div className="flex items-center gap-2">
              <Headshot src={p.headshot} name={p.name} size={36} />
              <div className="min-w-0">
                <p className="font-semibold"><PlayerButton id={p.id} className="inline">{p.name}</PlayerButton> <TeamLogo team={p.team} size={14} className="mx-0.5 -mt-0.5 align-middle" /><span className="text-xs font-normal text-zinc-400">{p.pos} · {p.team}</span> <InjuryTag injury={p.injury} /> <BoostChip boost={p.boost} /> {p.locked && <LockIcon className="text-xs text-zinc-500" title="Locked: game started" />}</p>
                <p className="truncate text-xs text-zinc-500">
                  {today ? (today.state === "in" ? <span className="text-red-600">● {today.clock} {today.label} </span> : `${today.label} · ${today.clock} `) : "No games this week "}
                  {today?.line && today.state !== "pre" ? `· ${today.line}` : ""}
                </p>
              </div>
            </div>
          ) : <span className="text-zinc-400">Empty</span>}
        </td>
        <td className="text-center text-xs text-zinc-500">{p ? `${p.played}/${p.total}` : ""}</td>
        <td className="text-right font-mono font-semibold text-zinc-800">{p ? <Fpts n={p.proj} /> : ""}</td>
        <td className="pr-3 text-right font-mono font-bold">{p ? <Fpts n={p.pts} live /> : ""}</td>
        {editable && (
          <td className="py-2 pr-3 text-right">
            <div className="flex justify-end gap-1.5">
              {canTarget ? (
                <button className="btn-lime px-2 py-1 text-xs" disabled={pending} onClick={() => act(() => setSlot!(sel!.id, slot))}>Move here</button>
              ) : p && !p.locked ? (
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setSelected(selected === p.id ? null : p.id)}>{selected === p.id ? "Cancel" : "Move"}</button>
              ) : null}
              {p && !canTarget && canBoost.has(p.id) && (
                <button className={`px-2 py-1 text-xs ${p.boost?.state === "pre" ? "btn-ghost" : "btn-lime"}`} title="Slab boost his next game" onClick={() => setBoosting(p)}>
                  <BoltIcon /> {p.boost?.state === "pre" ? "Change" : "Boost"}
                </button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => act(() => autoSet!())}><BoltIcon /> Start my active players</button>
          {sel && (
            <>
              <span className="text-sm text-zinc-700">Moving <b>{sel.name}</b>: pick a highlighted slot</span>
              {sel.slot !== "BN" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => act(() => setSlot!(sel.id, "BN"))}>Bench him</button>}
              <button className="btn-danger px-2 py-1 text-xs" onClick={async () => { if (await askConfirm(`Drop ${sel.name}?`, { confirmLabel: "Drop", danger: true })) act(() => drop!(sel.id)); }}>Drop</button>
            </>
          )}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-panel2 text-xs uppercase text-zinc-500">
            <tr><th className="py-2 pl-3 text-left">Slot</th><th className="text-left">Player</th><th>GP</th><th className="text-right">Proj/g</th><th className="pr-3 text-right">Wk pts</th>{editable && <th />}</tr>
          </thead>
          <tbody>
            {STARTERS.map((s) => row(s, bySlot.get(s)))}
            <tr className="border-t border-line bg-panel2/60">
              <td colSpan={4} className="py-2 pl-3 text-xs font-bold uppercase text-zinc-500">Week total (starters only count)</td>
              <td className="pr-3 text-right font-mono font-bold"><Fpts n={weekPts} live /></td>{editable && <td />}
            </tr>
            {bench.map((p) => row("BN", p))}
          </tbody>
        </table>
      </div>

      {boost && boosting && (
        <BoostModal boost={boost} player={boosting} info={canBoost.get(boosting.id)} pending={pending} onClose={() => setBoosting(null)}
          run={(fn) => { setBoosting(null); act(fn); }} />
      )}
    </div>
  );
}

/** Slab picker for boosting one player's next game: his own player slabs, then generic slabs. */
export function BoostModal({ boost, player, info, pending, onClose, run }: {
  boost: BoostProps; player: LivePlayer; info: BoostProps["boostable"][number] | undefined; pending: boolean;
  onClose: () => void; run: (fn: () => Promise<unknown>) => void;
}) {
  useScrollLock(true);
  const fits = boost.slabs.filter((s) => s.playerId === player.id || s.playerId == null);
  const own = fits.filter((s) => s.playerId === player.id).length;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line/60 p-4">
          <div>
            <p className="flex items-center gap-1.5 font-bold"><BoltIcon className="text-amber-600" /> Boost {player.name}</p>
            <p className="text-xs text-zinc-500">
              {info?.day} · projected <Fpts n={player.proj} /> fantasy points.{" "}
              {own ? `You have ${own} ${player.name} slab${own > 1 ? "s" : ""}.` : `No ${player.name} slabs yet, so only generics fit.`}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900" aria-label="Close"><XIcon /></button>
        </div>
        <div className="grid flex-1 grid-cols-2 justify-items-center gap-3 overflow-y-auto p-4 scrollbar-thin sm:grid-cols-4">
          {fits.length === 0 && <p className="col-span-full text-sm text-zinc-500">None of your slabs fit him. Rip packs for {player.name} slabs or generic slabs.</p>}
          {fits.map((s) => {
            const on = info ? boost.busy[`${s.cardId}|${info.dayKey}`] : undefined;
            const here = player.boost?.cardId === s.cardId;
            const elsewhere = !!on && !here;
            return (
              <button key={s.cardId} disabled={pending || elsewhere || here} onClick={() => run(() => boost.set(player.id, s.cardId))}
                title={elsewhere ? `Already on ${on} tonight` : undefined}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 text-center transition hover:bg-panel2 disabled:cursor-not-allowed ${elsewhere ? "opacity-40" : ""} ${here ? "ring-2 ring-amber-500" : ""}`}>
                <SlabFace height={170} s={{ kind: s.playerId == null ? "generic" : "player", name: s.player, team: s.team, pos: s.pos, rarity: s.rarity, mult: s.mult, immortal: s.immortal, serial: s.serial, jersey: s.jersey, color: s.color, alt: s.alt, photo: s.photo }} />
                <span className="mt-1 text-[11px] font-semibold text-zinc-300">{s.playerId == null ? "Any player" : s.player}</span>
                <span className="text-[11px] text-zinc-500">{here ? "On him now" : elsewhere ? `On ${on} tonight` : s.playerId == null ? "Generic" : "His own slab"}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-line/60 px-4 py-2 text-xs text-zinc-500">
          <span>One slab per player per night. It locks at his tip-off and only counts if he starts.</span>
          {player.boost?.state === "pre" && (
            <button className="text-red-600 hover:underline" onClick={() => run(() => boost.clear(player.id))}>Remove boost</button>
          )}
        </div>
      </div>
    </div>
  );
}
