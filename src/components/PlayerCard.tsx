import { RARITIES, Rarity, fmtCoins } from "@/lib/packs";

export type CardData = { id: number; name: string; pos: string; team: string; rarity: Rarity; grade: number; serial: number; print_run: number; value: number };

const BG: Record<Rarity, string> = {
  common: "from-slate-600 via-slate-700 to-slate-900",
  rare: "from-sky-500 via-blue-700 to-slate-900",
  epic: "from-fuchsia-500 via-purple-700 to-slate-900",
  legendary: "from-amber-300 via-orange-500 to-rose-700",
  grail: "from-emerald-300 via-cyan-400 to-fuchsia-500",
};
export const GLOW: Record<Rarity, string> = {
  common: "rgba(148,163,184,0.25)", rare: "rgba(56,189,248,0.45)", epic: "rgba(232,121,249,0.55)", legendary: "rgba(251,191,36,0.7)", grail: "rgba(52,211,153,0.8)",
};

export function PlayerCard({ c, small }: { c: CardData; small?: boolean }) {
  const r = RARITIES[c.rarity];
  const initials = c.name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("");
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${BG[c.rarity]} p-[3px] ${small ? "w-36" : "w-44"}`}>
      <div className="relative flex h-full flex-col rounded-[10px] bg-ink/70 p-2">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="rounded bg-white/90 px-1.5 py-0.5 text-ink">PD {c.grade}</span>
          <span className={r.text}>{r.label.toUpperCase()}</span>
        </div>
        <div className={`relative my-2 grid place-items-center rounded-lg bg-gradient-to-br ${BG[c.rarity]} ${small ? "h-24" : "h-32"}`}>
          <span className={`font-black tracking-tighter text-white/90 drop-shadow ${small ? "text-4xl" : "text-5xl"}`}>{initials}</span>
          <span className={`pos pos-${c.pos} absolute left-1.5 top-1.5`}>{c.pos}</span>
          <span className="absolute bottom-1 right-1.5 text-[10px] font-bold text-white/80">{c.team}</span>
          {(c.rarity === "legendary" || c.rarity === "grail" || c.rarity === "epic") && <div className="foil absolute inset-0 rounded-lg" />}
        </div>
        <p className="truncate text-sm font-black leading-tight">{c.name}</p>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">#{c.serial}/{c.print_run}</span>
          <span className="font-mono font-bold text-lime-300">{fmtCoins(c.value)}</span>
        </div>
      </div>
    </div>
  );
}
