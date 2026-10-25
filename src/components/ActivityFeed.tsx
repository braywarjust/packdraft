"use client";

import { useState } from "react";
import { TeamBadge, type BrandLite } from "./TeamBadge";
import type { ActivityItem } from "@/lib/activity";

type Ref = { id: number; name: string; pos: string; team: string };
const who = (p: Ref) => (
  <><b className="font-bold text-white">{p.name}</b> <span className="text-[11px] text-zinc-500">{p.team} {p.pos.split(",")[0]}</span></>
);
const list = (ps: Ref[]) => (ps.length ? ps.map((p, i) => <span key={p.id}>{i > 0 && ", "}{who(p)}</span>) : <span className="text-zinc-500">nothing</span>);

const ICON: Record<ActivityItem["kind"], [string, string]> = {
  add: ["+", "bg-emerald-500"], claim: ["+", "bg-emerald-500"], drop: ["−", "bg-red-500"], trade: ["⇄", "bg-brand"], veto: ["✕", "bg-zinc-300"],
};

function when(ts: number) {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** League home "Recent activity": adds, drops, waiver claims and trades, filterable by team. */
export function ActivityFeed({ items, brands, myTeamId }: { items: ActivityItem[]; brands: Record<number, BrandLite>; myTeamId: number | null }) {
  const [team, setTeam] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const shown = items.filter((i) => team == null || i.teamId === team || i.otherId === team);
  const rows = all ? shown : shown.slice(0, 6);
  const name = (id: number | null) => (id != null ? brands[id]?.name ?? "A team" : "A team");

  const line = (i: ActivityItem) => {
    switch (i.kind) {
      case "add": return <>added {who(i.add!)}{i.drop && <> and dropped {who(i.drop)}</>}</>;
      case "claim": return <>claimed {who(i.add!)} off waivers for <b className="text-white">${i.bid}</b>{i.drop && <>, dropped {who(i.drop)}</>}</>;
      case "drop": return <>dropped {who(i.drop!)}</>;
      case "trade": return <>traded {list(i.give)} to <b className="text-white">{name(i.otherId)}</b> for {list(i.get)}</>;
      case "veto": return <>had a trade with <b className="text-white">{name(i.otherId)}</b> vetoed by the League Manager</>;
    }
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Recent activity</h3>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setTeam(null)} className={`tab px-2 py-0.5 text-xs ${team == null ? "tab-active" : ""}`}>All</button>
          {Object.entries(brands).map(([id, b]) => (
            <button key={id} onClick={() => setTeam(Number(id))} title={b.name}
              className={`tab flex items-center gap-1 px-2 py-0.5 text-xs ${team === Number(id) ? "tab-active" : ""}`}>
              <TeamBadge brand={b} size={16} />{b.abbr}{Number(id) === myTeamId ? " (You)" : ""}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-ink/60 px-3 py-4 text-center text-sm text-zinc-500">No moves yet{team != null ? ` for ${name(team)}` : ""}. Adds, drops and trades show up here.</p>
      ) : (
        <ul className="divide-y divide-line/60">
          {rows.map((i) => {
            const [glyph, bg] = ICON[i.kind];
            const b = brands[i.teamId];
            return (
              <li key={i.id} className="flex items-start gap-2.5 py-2 text-sm">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-black text-white ${bg}`}>{glyph}</span>
                {b && <TeamBadge brand={b} size={22} className="mt-px" />}
                <p className="min-w-0 flex-1 leading-snug text-zinc-600"><b className="font-bold text-white">{b?.name ?? "A team"}</b> {line(i)}</p>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-zinc-500">{when(i.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > 6 && (
        <button onClick={() => setAll(!all)} className="mt-2 w-full text-center text-xs font-bold text-fpts hover:underline">
          {all ? "Show less" : `See all ${shown.length} moves`}
        </button>
      )}
    </div>
  );
}
