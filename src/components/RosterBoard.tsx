"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { DayInfo, DayRow } from "@/lib/league";
import { STARTERS, eligible } from "@/lib/scoring";
import { askConfirm } from "./Confirm";
import type { BrandLite } from "./TeamBadge";
import { BoxHead, BoxRow, BoxTotals, DayStrip, shortName, slotPill } from "./BoxScore";
import { Fpts } from "./Fpts";
import { PointsBreakdown } from "./PointsBreakdown";

/**
 * The roster page's lineup, ESPN style: pick a day, see every slot with the player in it, his game and full stat line,
 * and his fantasy points. On days that haven't finished, tap a slot pill to pick a player, then a green pill to swap him
 * there (a bench player's pill swaps him into the picked starter's slot). Phones show a trimmed stat line that fits
 * without scrolling sideways. Moves show instantly (Update 4.2): the board rearranges itself straight away and saves in
 * the background, and only snaps back (with the reason) if the server says no. The status line keeps one height so picking a player never shifts the page. Tap a player's
 * fantasy points to see how his stat line adds up to them.
 */
/**
 * The same move the server makes (lib/league moveToSlot), on this board's rows: the player takes the slot, and whoever
 * was there goes to the player's old slot if he can play it, else the bench. Lineups carry forward, so it applies to
 * every day that isn't over.
 */
function applyMove(days: DayInfo[], rows: Record<string, DayRow[]>, playerId: number, slot: string) {
  const out = { ...rows };
  for (const d of days) {
    if (d.past || !rows[d.key]) continue;
    const list = rows[d.key];
    const p = list.find((r) => r.id === playerId);
    if (!p) continue;
    const occupant = slot === "BN" ? undefined : list.find((r) => r.slot === slot && r.id !== playerId);
    const back = occupant && eligible(p.slot, occupant.pos) ? p.slot : "BN";
    out[d.key] = list.map((r) => (r.id === playerId ? { ...r, slot } : occupant && r.id === occupant.id ? { ...r, slot: back } : r));
  }
  return out;
}

export function RosterBoard({ days, rows: serverRows, totals, initialDay, editable, brand, scoring, setSlot, drop, header }: {
  days: DayInfo[]; rows: Record<string, DayRow[]>; totals: Record<string, number>; initialDay: string;
  editable: boolean; brand: BrandLite; scoring: string;
  setSlot?: (playerId: number, slot: string) => Promise<unknown>;
  drop?: (playerId: number) => Promise<unknown>;
  header?: React.ReactNode;
}) {
  const router = useRouter();
  const [day, setDay] = useState(initialDay);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  // Optimistic rows: moves land here instantly; fresh rows from the server replace them once the save comes back.
  const [local, setLocal] = useState<{ base: Record<string, DayRow[]>; rows: Record<string, DayRow[]> } | null>(null);
  // While saves are in flight an auto-refresh can bring back the old lineup, so the optimistic rows win until they're done.
  const [inflight, setInflight] = useState(0);
  const rows = local && (inflight > 0 || local.base === serverRows) ? local.rows : serverRows;
  // Whose points breakdown is open: looked up in `rows` each render so it stays live through auto-refreshes.
  const [breakdown, setBreakdown] = useState<{ id: number; day: string } | null>(null);
  const info = days.find((d) => d.key === day) ?? days[0];
  const list = rows[day] ?? [];
  // Lineups carry forward, so moves only make sense on a day that isn't over.
  const canEdit = editable && !!info && !info.past;
  const sel = canEdit ? list.find((r) => r.id === selected) : undefined;

  // Show the move now, save it in the background. A refusal puts the server's lineup back and says why.
  const act = (next: Record<string, DayRow[]>, fn: () => Promise<unknown>) => {
    setLocal({ base: serverRows, rows: next });
    setSelected(null);
    setErr("");
    setInflight((n) => n + 1);
    fn().then((r) => {
      const e = (r as { error?: string } | undefined)?.error;
      if (e) { setErr(e); setLocal(null); }
    }, () => { setErr("Couldn't save that move. Try again."); setLocal(null); })
      .finally(() => {
        setInflight((n) => n - 1);
        startTransition(() => router.refresh());
      });
  };
  const move = (playerId: number, slot: string) => act(applyMove(days, rows, playerId, slot), () => setSlot!(playerId, slot));
  const dropNow = (playerId: number) => act(
    Object.fromEntries(Object.entries(rows).map(([k, list]) => [k, days.find((d) => d.key === k)?.past ? list : list.filter((r) => r.id !== playerId)])),
    () => drop!(playerId));

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
    // Big, quick pills: instant colour on press (no transition delay), a firm squeeze, no double-tap zoom wait on phones.
    const cls = `hit inline-flex h-7 w-10 touch-manipulation select-none items-center justify-center rounded-full text-[11px] font-black ring-1 transition-transform duration-75 active:scale-90 sm:w-12 ${
      target ? "bg-emerald-500 text-black ring-2 ring-emerald-300 shadow-[0_0_12px_rgba(16,185,129,.55)]"
        : mine ? "bg-[#fff] text-[#0b0f17] ring-2 ring-[#fff] shadow-[0_0_12px_rgba(255,255,255,.35)]"
          : movable ? "text-white ring-white/40 hover:bg-white/10 active:bg-white/20" : "text-zinc-400 ring-line"}`;
    const style = !target && !mine && movable ? { boxShadow: `inset 0 0 0 1.5px ${brand.color}` } : undefined;
    if (target) return swapIn
      ? <button type="button" onClick={() => move(r!.id, sel!.slot)} className={cls} title={`Swap ${r!.name} in for ${sel!.name}`}>{slotPill(slot)}</button>
      : <button type="button" onClick={() => move(sel!.id, slot)} className={cls} title={`Move ${sel!.name} here`}>{slotPill(slot)}</button>;
    if (movable) return <button type="button" onClick={() => setSelected(mine ? null : r!.id)} className={cls} style={style} title={mine ? "Cancel" : `Move ${r!.name}`}>{slotPill(slot)}</button>;
    return <span className={cls}>{slotPill(slot)}</span>;
  };
  const openPoints = (r: DayRow) => setBreakdown({ id: r.id, day });
  const shown = breakdown && rows[breakdown.day]?.find((r) => r.id === breakdown.id);
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
                    {sel.slot !== "BN" && <button type="button" onClick={() => move(sel.id, "BN")} className={`${small} shrink-0 touch-manipulation bg-panel2 text-white ring-1 ring-line`}>Bench</button>}
                    <button type="button" onClick={async () => { const id = sel.id; if (await askConfirm(`Drop ${sel.name}?`, { confirmLabel: "Drop", danger: true })) dropNow(id); }} className={`${small} shrink-0 touch-manipulation bg-red-600 text-white`}>Drop</button>
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
              {STARTERS.map((slot) => { const r = bySlot.get(slot) ?? null; return <BoxRow key={slot} r={r} slotCell={pill(slot, r)} highlight={tint(r)} fit onPoints={openPoints} />; })}
              <BoxTotals rows={starters} total={totals[day] ?? 0} fit />
              {bench.map((r) => <BoxRow key={r.id} r={r} slotCell={pill("BN", r)} highlight={`opacity-80 ${tint(r)}`} fit onPoints={openPoints} />)}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-xs text-zinc-500">G = PG/SG · F = SF/PF · UTIL = anyone · Bench doesn&apos;t score · Tap a player&apos;s points to see how they add up</p>
      {shown && <PointsBreakdown r={shown} day={days.find((d) => d.key === breakdown!.day)} scoring={scoring} onClose={() => setBreakdown(null)} />}
    </div>
  );
}
