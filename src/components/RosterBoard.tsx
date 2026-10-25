"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DayInfo, DayRow } from "@/lib/league";
import { STARTERS, eligible } from "@/lib/scoring";
import { askConfirm } from "./Confirm";
import type { BrandLite } from "./TeamBadge";
import { BoxHead, BoxRow, BoxTotals, DayStrip, shortName, slotPill } from "./BoxScore";
import { Fpts } from "./Fpts";

/**
 * The roster page's lineup, ESPN style: pick a day, see every slot with the player in it, his game and full stat line,
 * and his fantasy points. On days that haven't finished, tap a slot pill to pick a player, then a green pill to swap him
 * there (a bench player's pill swaps him into the picked starter's slot). Phones show a trimmed stat line that fits
 * without scrolling sideways. The status line keeps one height so picking a player never shifts the page.
 */
export function RosterBoard({ days, rows, totals, initialDay, editable, brand, setSlot, drop, header }: {
  days: DayInfo[]; rows: Record<string, DayRow[]>; totals: Record<string, number>; initialDay: string;
  editable: boolean; brand: BrandLite;
  setSlot?: (playerId: number, slot: string) => Promise<unknown>;
  drop?: (playerId: number) => Promise<unknown>;
  header?: React.ReactNode;
}) {
  const router = useRouter();
  const [day, setDay] = useState(initialDay);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
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

  const pill = (slot: string, r: DayRow | null) => {
    // A starter slot takes the picked player (its occupant goes back to his old slot, or the bench). A bench pill swaps
    // that bench player into the picked starter's slot.
    const swapIn = slot === "BN" && !!(sel && r && sel.slot !== "BN" && eligible(sel.slot, r.pos));
    const target = !!(sel && sel.id !== r?.id && !sel.locked && !(r && r.locked) && (slot === "BN" ? swapIn : eligible(slot, sel.pos)));
    const mine = !!r && selected === r.id;
    const movable = canEdit && !!r && !r.locked;
    const cls = `hit press inline-flex h-8 w-10 items-center justify-center rounded-full text-[11px] font-black ring-1 transition sm:w-14 ${
      target ? "bg-emerald-500 text-black ring-emerald-400 animate-pulse" : mine ? "bg-white text-black ring-white" : movable ? "text-white ring-white/40 hover:bg-white/10" : "text-zinc-400 ring-line"}`;
    const style = !target && !mine && movable ? { boxShadow: `inset 0 0 0 1.5px ${brand.color}` } : undefined;
    if (target) return swapIn
      ? <button type="button" disabled={pending} onClick={() => act(() => setSlot!(r!.id, sel!.slot))} className={cls} title={`Swap ${r!.name} in for ${sel!.name}`}>{slotPill(slot)}</button>
      : <button type="button" disabled={pending} onClick={() => act(() => setSlot!(sel!.id, slot))} className={cls} title={`Move ${sel!.name} here`}>{slotPill(slot)}</button>;
    if (movable) return <button type="button" onClick={() => setSelected(mine ? null : r!.id)} className={cls} style={style} title={mine ? "Cancel" : `Move ${r!.name}`}>{slotPill(slot)}</button>;
    return <span className={cls}>{slotPill(slot)}</span>;
  };
  const tint = (r: DayRow | null) => (r && selected === r.id ? "bg-brand/10" : "");
  const small = "press rounded-md px-2 py-1 text-xs font-bold disabled:opacity-50";

  return (
    <div className="space-y-3">
      <section className="card overflow-hidden">
        <div className="space-y-3 border-b border-line/60 p-3 sm:p-4">
          {header}
          <DayStrip days={days} day={day} onDay={(k) => { setDay(k); setSelected(null); }} totals={totals} />
          <div className="flex h-8 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {err ? <span className="truncate text-xs text-red-500">{err}</span>
                : sel ? (
                  <>
                    <span className="min-w-0 truncate text-xs text-zinc-400"><b className="text-white">{shortName(sel.name)}</b><span className="max-sm:hidden">: tap a green slot</span></span>
                    {sel.slot !== "BN" && <button type="button" disabled={pending} onClick={() => act(() => setSlot!(sel.id, "BN"))} className={`${small} shrink-0 bg-panel2 text-white ring-1 ring-line`}>Bench</button>}
                    <button type="button" disabled={pending} onClick={async () => { if (await askConfirm(`Drop ${sel.name}?`, { confirmLabel: "Drop", danger: true })) act(() => drop!(sel.id)); }} className={`${small} shrink-0 bg-red-600 text-white`}>Drop</button>
                  </>
                ) : canEdit ? <span className="truncate text-xs text-zinc-500">Tap a slot to swap players.</span>
                  : info?.past ? <span className="truncate text-xs text-zinc-500">This day is over. Lineup shown as it played.</span> : null}
            </div>
            <span className="shrink-0 text-sm text-zinc-400"><span className="max-sm:hidden">{info?.label}: </span><b className="font-mono text-white"><Fpts n={totals[day] ?? 0} /></b></span>
          </div>
        </div>
        <div className="sm:overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm sm:min-w-[900px]">
            <BoxHead dayLabel={info?.top ?? ""} first="Slot" fit />
            <tbody>
              {STARTERS.map((slot) => { const r = bySlot.get(slot) ?? null; return <BoxRow key={slot} r={r} slotCell={pill(slot, r)} highlight={tint(r)} fit />; })}
              <BoxTotals rows={starters} total={totals[day] ?? 0} fit />
              {bench.map((r) => <BoxRow key={r.id} r={r} slotCell={pill("BN", r)} highlight={`opacity-80 ${tint(r)}`} fit />)}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-zinc-500">G = PG/SG · F = SF/PF · UTIL = anyone · Bench doesn&apos;t score</p>
    </div>
  );
}
