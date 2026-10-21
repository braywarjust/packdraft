"use client";

import { askConfirm } from "./Confirm";
import { BoltIcon, LockIcon, XIcon } from "./Icons";
import { TeamLogo } from "./TeamLogo";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { LivePlayer } from "@/lib/league";
import { Slab, type SlabData } from "./Slab";
import { Headshot, InjuryTag } from "./Headshot";
import { FptIcon, Fpts } from "@/components/Fpts";
import { PlayerButton } from "@/components/PlayerInspector";
import { SlabOn } from "./SlabIcon";
import { useScrollLock } from "@/components/useScrollLock";

import { STARTERS, eligible, posLabel, slotLabel as lbl } from "@/lib/scoring";

type StatBoost = { pts: number; reb: number; ast: number };
type BoostSlab = { cardId: number; playerId: number; player: string; label: string; rarity: string; value: number; mult: number | null; boost: StatBoost | null; slab: SlabData };

/** "+3 PTS +1 AST" (zeros left out). */
const boostText = (b: StatBoost) => ([["PTS", b.pts], ["REB", b.reb], ["AST", b.ast]] as const).filter(([, v]) => v > 0).map(([k, v]) => `+${v} ${k}`).join(" ");
/** What a slab gives, short: a blue "1.43x", an orange "+2 PTS +1 REB", or both. */
function Buff({ mult, boost }: { mult: number | null | undefined; boost: StatBoost | null | undefined }) {
  const stats = boost ? boostText(boost) : "";
  return (
    <>
      {mult != null && mult !== 1 && <b className="text-fpts">{mult.toFixed(2)}x</b>}
      {mult != null && mult !== 1 && stats && " · "}
      {stats && <b className="text-orange-500">{stats}</b>}
    </>
  );
}
export type BoostProps = {
  /** The manager's equippable slabs (not already equipped somewhere). */
  slabs: BoostSlab[];
  /** Players a slab can go on right now: his next game this week, and the slab already on it (if any). */
  boostable: { playerId: number; dayKey: string; day: string; equipped: BoostSlab | null }[];
  set: (playerId: number, cardId: number) => Promise<unknown>;
  clear: (playerId: number) => Promise<unknown>;
};

/** Chips for a player with a slab equipped: Fantasy Points logo + "1.43x", and/or an orange "+2 PTS +1 AST". */
export function BoostChip({ boost }: { boost: LivePlayer["boost"] }) {
  if (!boost) return null;
  const live = boost.state === "in";
  const stats = boost.pts || boost.reb || boost.ast ? boostText(boost) : "";
  const when = boost.state === "pre" ? " on his next game" : "";
  return (
    <>
      {boost.mult !== 1 && (
        <span title={`Slab equipped: ${boost.mult.toFixed(2)}x fantasy points${when}`}
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${live ? "animate-pulse bg-fpts text-black" : "bg-fpts/15 text-fpts"}`}>
          <FptIcon tone={live ? "black" : "blue"} />{boost.mult.toFixed(2)}x
        </span>
      )}
      {stats && (
        <span title={`Slab equipped: ${stats} added to his stats when the game ends${when}`}
          className={`inline-flex items-center whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-black ${live ? "animate-pulse bg-orange-500 text-black" : "bg-orange-500/15 text-orange-500"}`}>
          {stats}
        </span>
      )}
    </>
  );
}

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
                <p className="font-semibold"><PlayerButton id={p.id} className="inline">{p.name}</PlayerButton> <SlabOn boost={p.boost} /> <TeamLogo team={p.team} size={14} className="mx-0.5 -mt-0.5 align-middle" /><span className="text-xs font-normal text-zinc-400">{posLabel(p.pos)} · {p.team}</span> <InjuryTag injury={p.injury} /> <BoostChip boost={p.boost} /> {p.locked && <LockIcon className="text-xs text-zinc-500" title="Locked: game started" />}</p>
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
                <button className={`px-2 py-1 text-xs ${p.boost?.state === "pre" ? "btn-ghost" : "btn-primary"}`} title="Equip one of his slabs on his next game" onClick={() => setBoosting(p)}>
                  <FptIcon tone="white" /> {p.boost?.state === "pre" ? "Swap slab" : "Equip slab"}
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

/**
 * "Equip slabs" panel at the top of your team page: every player on this roster you own slabs of, his next game, his
 * best multiplier, and an Equip button (or what's equipped). Makes it obvious slabs can go on your players.
 */
export function EquipPanel({ boost, players, onEquip }: { boost: BoostProps; players: LivePlayer[]; onEquip: (p: LivePlayer) => void }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const rows = boost.boostable.flatMap((b) => {
    const p = byId.get(b.playerId);
    if (!p) return [];
    const mine = boost.slabs.filter((s) => s.playerId === b.playerId);
    return [{ b, p, mine, best: mine[0] }];
  });
  return (
    <section className="card relative overflow-hidden p-4" style={{ boxShadow: "inset 0 0 0 1px rgba(56,189,248,.35)" }}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 font-black text-white"><FptIcon tone="blue" /> Equip slabs</h3>
        <p className="text-xs text-zinc-500">Boost one game. Equip before tip-off.</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No slabs of your players yet. Rip packs to find some.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
          {rows.map(({ b, p, mine, best }) => (
            <div key={p.id} className="flex w-56 shrink-0 items-center gap-3 rounded-xl bg-ink p-2.5 ring-1 ring-white/5">
              {b.equipped ? <Slab s={b.equipped.slab} size={64} /> : mine[0] && <Slab s={mine[0].slab} size={64} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{p.name}</p>
                <p className="truncate text-[11px] text-zinc-500">{b.day}</p>
                {b.equipped ? (
                  <p className="truncate text-[11px] font-bold text-fpts">Equipped · <Buff mult={b.equipped.mult} boost={b.equipped.boost} /></p>
                ) : (
                  <p className="truncate text-[11px] text-zinc-400">{mine.length} slab{mine.length > 1 ? "s" : ""}{best ? <> · best <Buff mult={best.mult} boost={best.boost} /></> : null}</p>
                )}
                <button className={`mt-1 px-2 py-0.5 text-xs ${b.equipped ? "btn-ghost" : "btn-primary"}`} onClick={() => onEquip(p)}>{b.equipped ? "Swap" : "Equip"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Slab picker: equip one of his own slabs on his next game (used up when that game ends). */
export function BoostModal({ boost, player, info, pending, onClose, run }: {
  boost: BoostProps; player: LivePlayer; info: BoostProps["boostable"][number] | undefined; pending: boolean;
  onClose: () => void; run: (fn: () => Promise<unknown>) => void;
}) {
  useScrollLock(true);
  const mine = boost.slabs.filter((s) => s.playerId === player.id);
  const on = info?.equipped ?? null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line/60 p-4">
          <div>
            <p className="flex items-center gap-1.5 font-bold"><FptIcon tone="blue" /> Equip a slab on {player.name}</p>
            <p className="text-xs text-zinc-500">{info?.day} · projected <Fpts n={player.proj} /> fantasy points. One use.</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900" aria-label="Close"><XIcon /></button>
        </div>
        <div className="grid flex-1 grid-cols-2 justify-items-center gap-3 overflow-y-auto p-4 scrollbar-thin sm:grid-cols-4">
          {on && (
            <div className="flex flex-col items-center gap-1 rounded-lg bg-panel2 p-2 text-center ring-2 ring-fpts">
              <Slab s={on.slab} size={128} />
              <span className="text-[11px] font-bold text-fpts">Equipped</span>
            </div>
          )}
          {mine.length === 0 && !on && <p className="col-span-full text-sm text-zinc-500">You don&apos;t have any {player.name} slabs. Rip packs to find one.</p>}
          {mine.map((s) => (
            <button key={s.cardId} disabled={pending} onClick={() => run(() => boost.set(player.id, s.cardId))}
              className="flex flex-col items-center gap-1 rounded-lg p-2 text-center transition hover:bg-panel2 disabled:opacity-40">
              <Slab s={s.slab} size={128} />
              <span className="text-[11px] text-zinc-500">{s.label}{on ? " · swap in" : ""}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line/60 px-4 py-2 text-xs text-zinc-500">
          <span>One per game. Locks at tip-off. Counts only if he starts.</span>
          {on && player.boost?.state === "pre" && (
            <button className="text-red-600 hover:underline" onClick={() => run(() => boost.clear(player.id))}>Unequip</button>
          )}
        </div>
      </div>
    </div>
  );
}
