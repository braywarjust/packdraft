import { PACK_BY_ID } from "@/lib/packs";

/** The reward ladder for a solo run, optionally with the run's points filled in. */
export function CeilingLadder({ rows, points }: { rows: { pack: string; points: number }[]; points?: number }) {
  const top = [...rows].reverse().find((r) => points != null && points >= r.points);
  return (
    <ul className="space-y-1.5 text-sm">
      {[...rows].reverse().map((r) => {
        const hit = points != null && points >= r.points;
        const best = top?.pack === r.pack;
        return (
          <li key={r.pack} className={`flex items-center justify-between rounded-lg px-3 py-2 ${best ? "bg-emerald-50 ring-1 ring-emerald-600/40" : hit ? "bg-panel2" : "bg-ink/40"}`}>
            <span className={`font-semibold ${r.pack === "megacase" ? "text-amber-600" : ""}`}>{PACK_BY_ID[r.pack]?.name}</span>
            <span className="font-mono">
              {r.points.toLocaleString()} pts
              {hit && <span className="ml-2 text-emerald-600">✓</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
