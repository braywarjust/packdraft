"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { CardData } from "@/components/PlayerCard";
import { Coins } from "@/components/Coins";
import { TradeThumb, buffText, cardLabel } from "./TradeSlab";

type Manager = { id: number; name: string; color: string };
type Propose = (t: { to: number; give: number[]; get: number[]; givePp: number; getPp: number; note: string }) => Promise<unknown>;

/** Build a slab trade: pick a manager, tick slabs on each side, add Pack Points if you like, send. */
export function TradeDesk({
  me, coins, managers, cards, initial, propose, max,
}: {
  me: number;
  coins: number;
  managers: Manager[];
  cards: Record<number, CardData[]>;
  initial: { to?: number; give?: number[]; get?: number[] };
  propose: Propose;
  max: number;
}) {
  const router = useRouter();
  const [to, setTo] = useState<number | undefined>(initial.to && managers.some((m) => m.id === initial.to) ? initial.to : managers[0]?.id);
  // Links from the collection preselect slabs; drop any that can't be traded right now (equipped, gone).
  const has = (owner: number | undefined, id: number) => owner != null && (cards[owner] ?? []).some((c) => c.id === id);
  const [give, setGive] = useState<number[]>((initial.give ?? []).filter((id) => has(me, id)));
  const [get, setGet] = useState<number[]>((initial.get ?? []).filter((id) => has(to, id)));
  const [givePp, setGivePp] = useState("");
  const [getPp, setGetPp] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [pending, start] = useTransition();
  const mine = cards[me] ?? [];
  const theirs = to ? cards[to] ?? [] : [];
  const partner = managers.find((m) => m.id === to);
  const pp = (s: string) => Math.max(0, Math.floor(Number(s.replace(/[^\d]/g, "")) || 0));
  const total = (list: CardData[], sel: number[]) => list.filter((c) => sel.includes(c.id)).reduce((s, c) => s + c.value, 0);
  const sendVal = total(mine, give) + pp(givePp);
  const getVal = total(theirs, get) + pp(getPp);
  const kind = useMemo(() => (!give.length && !pp(givePp) ? "ask" : !get.length && !pp(getPp) ? "gift" : "trade"), [give, get, givePp, getPp]);

  if (!managers.length) return <div className="card p-5 text-sm text-zinc-500">Nobody else to trade with yet.</div>;

  const toggle = (sel: number[], set: (v: number[]) => void, id: number) =>
    set(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length >= max ? sel : [...sel, id]);

  const list = (cs: CardData[], sel: number[], set: (v: number[]) => void, empty: string) => (
    <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
      {cs.length === 0 && <li className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-zinc-400">{empty}</li>}
      {cs.map((c) => {
        const on = sel.includes(c.id);
        const buff = buffText(c);
        return (
          <li key={c.id}>
            <button type="button" onClick={() => toggle(sel, set, c.id)} aria-pressed={on}
              className={`flex w-full items-center gap-3 rounded-xl border px-2 py-1.5 text-left transition ${on ? "border-brand bg-brand/10 ring-1 ring-brand" : "border-line hover:border-zinc-400"}`}>
              <span className="shrink-0"><TradeThumb c={c} size={52} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c.name}</span>
                <span className="block truncate text-xs text-zinc-500">{cardLabel(c)}{buff && <span className="font-semibold text-fpts"> · {buff}</span>}</span>
              </span>
              <span className="shrink-0 text-right text-xs font-bold text-emerald-600"><Coins n={c.value} /></span>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-black ${on ? "border-brand bg-brand text-white" : "border-zinc-300 text-transparent"}`}>✓</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const send = () =>
    start(async () => {
      if (!to) return;
      const r = (await propose({ to, give, get, givePp: pp(givePp), getPp: pp(getPp), note })) as { error?: string; message?: string };
      if (r?.error) setMsg({ t: r.error, bad: true });
      else {
        setMsg({ t: r?.message ?? "Offer sent", bad: false });
        setGive([]); setGet([]); setGivePp(""); setGetPp(""); setNote("");
        router.refresh();
      }
    });

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">New offer</h2>
        <div className="flex flex-wrap gap-1.5">
          {managers.map((m) => (
            <button key={m.id} type="button" onClick={() => { setTo(m.id); setGet([]); setMsg(null); }}
              className={`tab ${m.id === to ? "tab-active" : ""}`}>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: m.color }} />{m.name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="label flex items-center justify-between"><span>You send ({give.length})</span><span className="text-emerald-600"><Coins n={sendVal} /></span></p>
          {list(mine, give, setGive, "No tradable slabs. Equipped slabs can't be traded until they're unequipped.")}
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            + Pack Points
            <input inputMode="numeric" value={givePp} onChange={(e) => setGivePp(e.target.value.replace(/[^\d]/g, ""))} className="input w-32" placeholder="0" />
            <span className="text-xs">of <Coins n={coins} /></span>
          </label>
        </div>
        <div className="space-y-2">
          <p className="label flex items-center justify-between"><span>You get from {partner?.name} ({get.length})</span><span className="text-emerald-600"><Coins n={getVal} /></span></p>
          {list(theirs, get, setGet, `${partner?.name ?? "They"} has no tradable slabs.`)}
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            + Pack Points
            <input inputMode="numeric" value={getPp} onChange={(e) => setGetPp(e.target.value.replace(/[^\d]/g, ""))} className="input w-32" placeholder="0" />
          </label>
        </div>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="input" placeholder="Make your pitch (or talk some trash)…" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending || kind === "ask"} onClick={send}>
          {pending ? "…" : kind === "gift" ? `Send gift to ${partner?.name}` : "Send offer"}
        </button>
        {kind === "ask" && <span className="text-xs text-zinc-500">Pick slabs to send, or add Pack Points for theirs.</span>}
        {msg && <span className={`text-sm ${msg.bad ? "text-red-600" : "text-emerald-600"}`}>{msg.t}</span>}
      </div>
      <p className="text-xs text-zinc-500">
        Slabs keep their multiplier and stat boost when they change hands, and still only work on their own player. Nothing moves until {partner?.name ?? "they"} accept{partner ? "s" : ""}.
      </p>
    </div>
  );
}
