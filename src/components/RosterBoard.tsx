"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DayInfo, DayRow, LivePlayer } from "@/lib/league";
import { STARTERS, eligible } from "@/lib/scoring";
import { askConfirm } from "./Confirm";
import { BoltIcon } from "./Icons";
import type { BrandLite } from "./TeamBadge";
import { BoxHead, BoxRow, BoxTotals, DayStrip, slotPill } from "./BoxScore";
import { BoostModal, EquipPanel, type BoostProps } from "./LineupEditor";
import { Fpts } from "./Fpts";

/**
 * The roster page's lineup, ESPN style: pick a day, see every slot with the player in it, his game and full stat line,
 * and his fantasy points. On days that haven't finished, tap a slot pill to move that player (eligible slots light up).
 * Phones keep the slot and player columns pinned while the stats scroll sideways.
 */
export function RosterBoard({ days, rows, totals, initialDay, players, editable, brand, setSlot, autoSet, drop, boost }: {
  days: DayInfo[]; rows: Record<string, DayRow[]>; totals: Record<string, number>; initialDay: string;
  players: LivePlayer[]; editable: boolean; brand: BrandLite;
  setSlot?: (playerId: number, slot: string) => Promise<unknown>;
  autoSet?: () => Promise<unknown>;
  drop?: (playerId: number) => Promise<unknown>;
  boost?: BoostProps;
}) {
  const router = useRouter();
  const [day, setDay] = useState(initialDay);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [boosting, setBoosting] = useState<LivePlayer | null>(null);
  const info = days.find((d) => d.key === day) ?? days[0];
  const list = rows[day] ?? [];
  // Lineups carry forward, so moves only make sense on a day that isn't over.
  const canEdit = editable && !!info && !info.past;
  const sel = canEdit ? list.find((r) => r.id === selected) : undefined;

  const act = (fn: () => Promise<unknown>) => start(async () => {
    const r = (await fn()) as { error?: string } | undefined;
    setErr(r?.error ?? "");
    setSelected(null);
    router.refresh();
  });

  const bySlot = new Map(list.filter((r) => r.slot !== "BN").map((r) => [r.slot, r]));
  const bench = list.filter((r) => r.slot === "BN");
  const starters = STARTERS.map((s) => bySlot.get(s)).filter(Boolean) as DayRow[];
  const canBoost = new Map((boost?.boostable ?? []).map((b) => [b.playerId, b]));

  const pill = (slot: string, r: DayRow | null) => {
    const target = !!(sel && sel.id !== r?.id && eligible(slot, sel.pos) && !(r && r.locked) && !sel.locked && (slot !== "BN" || sel.slot !== "BN"));
    const mine = !!r && selected === r.id;
    const movable = canEdit && !!r && !r.locked;
    const cls = `inline-flex h-8 w-11 items-center justify-center rounded-full text-[11px] font-black ring-1 transition sm:w-14 ${
      target ? "bg-emerald-500 text-black ring-emerald-400 animate-pulse" : mine ? "bg-white text-black ring-white" : movable ? "text-white ring-white/40 hover:bg-white/10" : "text-zinc-400 ring-line"}`;
    const style = !target && !mine && movable ? { boxShadow: `inset 0 0 0 1.5px ${brand.color}` } : undefined;
    if (target) return <button type="button" disabled={pending} onClick={() => act(() => setSlot!(sel!.id, slot))} className={cls} title={`Move ${sel!.name} here`}>{slotPill(slot)}</button>;
    if (movable) return <button type="button" onClick={() => setSelected(mine ? null : r!.id)} className={cls} style={style} title={mine ? "Cancel" : `Move ${r!.name}`}>{slotPill(slot)}</button>;
    return <span className={cls}>{slotPill(slot)}</span>;
  };
  const tint = (r: DayRow | null) => (r && selected === r.id ? "bg-brand/10" : "");

  return (
    <div className="space-y-3">
      {editable && boost && <EquipPanel boost={boost} players={players} onEquip={setBoosting} />}
      <section className="card overflow-hidden">
        <div className="space-y-3 border-b border-line/60 p-3 sm:p-4">
          <DayStrip days={days} day={day} onDay={(k) => { setDay(k); setSelected(null); }} totals={totals} />
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && <button className="btn-primary px-3 py-1.5 text-sm" disabled={pending} onClick={() => act(() => autoSet!())}><BoltIcon /> Quick lineup</button>}
            {sel ? (
              <>
                <span className="text-sm text-zinc-400">Moving <b className="text-white">{sel.name}</b>: tap a green slot</span>
                <button className="btn-danger px-2 py-1 text-xs" onClick={async () => { if (await askConfirm(`Drop ${sel.name}?`, { confirmLabel: "Drop", danger: true })) act(() => drop!(sel.id)); }}>Drop</button>
                {canBoost.has(sel.id) && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { const p = players.find((x) => x.id === sel.id); if (p) setBoosting(p); }}>Equip slab</button>}
              </>
            ) : canEdit ? <span className="text-xs text-zinc-500">Tap a slot to move a player.</span>
              : info?.past ? <span className="text-xs text-zinc-500">This day is over. Lineup shown as it played.</span> : null}
            <span className="ml-auto text-sm text-zinc-400"><span className="max-sm:hidden">{info?.label}: </span><b className="font-mono text-white"><Fpts n={totals[day] ?? 0} /></b></span>
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[900px] text-sm">
            <BoxHead dayLabel={info?.top ?? ""} first="Slot" />
            <tbody>
              {STARTERS.map((slot) => { const r = bySlot.get(slot) ?? null; return <BoxRow key={slot} r={r} slotCell={pill(slot, r)} highlight={tint(r)} />; })}
              <BoxTotals rows={starters} total={totals[day] ?? 0} />
              {bench.map((r) => <BoxRow key={r.id} r={r} slotCell={pill("BN", r)} highlight={`opacity-80 ${tint(r)}`} />)}
              {sel && sel.slot !== "BN" && (
                <tr className="border-t border-line/60"><td colSpan={17} className="p-2">
                  <button disabled={pending} onClick={() => act(() => setSlot!(sel.id, "BN"))} className="w-full rounded-lg border-2 border-dashed border-emerald-400/60 py-2 text-sm text-emerald-400">Bench {sel.name}</button>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-zinc-500">UTIL takes anyone, G takes a PG or SG, F takes an SF or PF. Bench points don&apos;t count.</p>

      {boost && boosting && (
        <BoostModal boost={boost} player={boosting} info={canBoost.get(boosting.id)} pending={pending} onClose={() => setBoosting(null)}
          run={(fn) => { setBoosting(null); act(fn); }} />
      )}
    </div>
  );
}
