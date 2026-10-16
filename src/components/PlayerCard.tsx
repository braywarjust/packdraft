/* eslint-disable @next/next/no-img-element */
import { RARITIES, Rarity, fmtCoins } from "@/lib/packs";

export type CardData = {
  id: number; name: string; pos: string; team: string; rarity: Rarity; grade: number; serial: number; print_run: number; value: number;
  headshot?: string | null; jersey?: string | null; color?: string | null; alt?: string | null; logo?: string | null;
  slab_id?: number | null; s_year?: number | null; s_set?: string | null; s_no?: string | null; s_variant?: string | null;
  s_company?: string | null; s_grade?: string | null; s_cert?: string | null; s_flags?: string | null; s_source?: string | null;
};

const RING: Record<Rarity, string> = {
  common: "border-zinc-200", rare: "border-sky-400", epic: "border-fuchsia-500", legendary: "border-amber-400", grail: "border-emerald-400",
};
const RARITY_CHIP: Record<Rarity, string> = {
  common: "bg-zinc-100 text-zinc-600", rare: "bg-sky-100 text-sky-700", epic: "bg-fuchsia-100 text-fuchsia-700", legendary: "bg-amber-100 text-amber-700", grail: "bg-emerald-100 text-emerald-700",
};

export function slabBadges(flags: string | null | undefined) {
  if (!flags) return [];
  const f = JSON.parse(flags) as Record<string, boolean>;
  return [f.blackLabel && "Black Label", f.auto && "Auto", f.mem && "Patch", f.rookie && "Rookie", f.insert && "Insert", f.premium && "Premium", f.numbered ? "Numbered" : f.parallel && "Parallel"]
    .filter(Boolean) as string[];
}

/** A real graded slab: photo, rarity frame, card line and value. */
export function SlabCard({ c, small }: { c: CardData; small?: boolean }) {
  const r = RARITIES[c.rarity];
  const badges = slabBadges(c.s_flags).slice(0, 3);
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border-2 bg-white ${RING[c.rarity]} ${small ? "h-[250px] w-40" : "h-[300px] w-48"}`}>
      <div className="relative flex-1 overflow-hidden bg-white">
        <img src={`/api/slabs/${c.slab_id}`} alt={`${c.s_year} ${c.s_set} ${c.name}`} className="absolute inset-0 h-full w-full scale-[1.3] object-contain" loading="lazy" />
        {(c.rarity === "legendary" || c.rarity === "grail") && <div className="foil pointer-events-none absolute inset-0 opacity-60" />}
        <span className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${RARITY_CHIP[c.rarity]}`}>{r.label}</span>
      </div>
      <div className="border-t border-zinc-100 px-2 py-1.5">
        <p className="truncate text-xs font-semibold text-zinc-900">{c.name}</p>
        <p className="truncate text-[10px] text-zinc-500">{c.s_year} {c.s_set}{c.s_no ? ` #${c.s_no}` : ""}{c.s_variant ? ` · ${c.s_variant}` : ""}</p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="flex min-w-0 gap-1 overflow-hidden">
            <span className="shrink-0 rounded bg-zinc-900 px-1 text-[9px] font-bold text-white">{c.s_company} {c.s_grade}</span>
            {badges.map((b) => <span key={b} className="shrink-0 rounded bg-zinc-100 px-1 text-[9px] font-semibold text-zinc-600">{b}</span>)}
          </span>
          <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-600" title={c.s_source === "ebay" ? "eBay market value" : "Estimated value"}>
            {fmtCoins(c.value)}{c.s_source === "ebay" ? "" : "*"}
          </span>
        </div>
      </div>
    </div>
  );
}

// Slab frame per rarity: the plastic case edge and the label stripe.
const FRAME: Record<Rarity, string> = {
  common: "from-slate-300 via-slate-500 to-slate-300",
  rare: "from-sky-300 via-blue-500 to-sky-300",
  epic: "from-fuchsia-300 via-purple-500 to-fuchsia-300",
  legendary: "from-amber-200 via-yellow-500 to-amber-200",
  grail: "from-emerald-300 via-cyan-300 via-50% to-fuchsia-400",
};
export const GLOW: Record<Rarity, string> = {
  common: "rgba(148,163,184,0.25)", rare: "rgba(56,189,248,0.45)", epic: "rgba(232,121,249,0.55)", legendary: "rgba(251,191,36,0.7)", grail: "rgba(52,211,153,0.8)",
};
const GRADE_WORD: Record<number, string> = { 10: "GEM MT", 9.5: "MINT+", 9: "MINT", 8.5: "NM-MT+", 8: "NM-MT" };

export function PlayerCard({ c, small }: { c: CardData; small?: boolean }) {
  if (c.slab_id) return <SlabCard c={c} small={small} />;
  const r = RARITIES[c.rarity];
  const primary = `#${c.color ?? "334155"}`;
  const secondary = `#${c.alt ?? "0f172a"}`;
  const shiny = c.rarity !== "common";
  return (
    <div className={`relative rounded-2xl bg-gradient-to-br ${FRAME[c.rarity]} p-[3px] shadow-xl ${small ? "h-[230px] w-36" : "h-[280px] w-44"}`}>
      <div className="flex h-full flex-col rounded-[14px] bg-slate-950/90 p-1.5">
        {/* Grading label */}
        <div className="mb-1.5 rounded-md bg-gradient-to-r from-white to-slate-200 px-1.5 py-1 text-zinc-900">
          <div className="flex items-center justify-between text-[8px] font-bold uppercase leading-tight tracking-wide">
            <span className="truncate">{small ? "PackDraft '27" : "PackDraft 2026-27"}</span>
            <span className={`rounded px-1 text-white ${c.rarity === "grail" ? "bg-emerald-600" : c.rarity === "legendary" ? "bg-amber-600" : c.rarity === "epic" ? "bg-fuchsia-600" : c.rarity === "rare" ? "bg-sky-600" : "bg-slate-500"}`}>{r.label}</span>
          </div>
          <div className="flex items-end justify-between gap-1">
            <span className={`truncate font-black leading-tight ${small ? "text-[10px]" : "text-[11px]"}`}>{c.name}</span>
            <span className="text-right leading-none">
              <span className="block text-[7px] font-bold">{GRADE_WORD[c.grade] ?? ""}</span>
              <span className={`font-black ${small ? "text-sm" : "text-base"}`}>{c.grade}</span>
            </span>
          </div>
        </div>
        {/* Card */}
        <div className="relative flex-1 overflow-hidden rounded-lg" style={{ background: `linear-gradient(150deg, ${primary} 0%, ${primary} 45%, ${secondary} 100%)` }}>
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.25) 0 2px, transparent 2px 12px)" }} />
          {c.logo && <img src={c.logo} alt="" className="absolute -right-4 -top-4 h-24 w-24 opacity-25" />}
          {c.jersey && <span className={`absolute left-1.5 top-0 font-black text-white/25 ${small ? "text-4xl" : "text-5xl"}`}>{c.jersey}</span>}
          {c.headshot ? (
            <img src={c.headshot} alt={c.name} className="absolute bottom-6 left-1/2 w-[135%] max-w-none -translate-x-1/2 drop-shadow-[0_6px_10px_rgba(0,0,0,.5)]" />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-5xl font-black text-white/80">{c.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}</span>
          )}
          {shiny && <div className="foil pointer-events-none absolute inset-0" />}
          {c.rarity === "grail" && <div className="pointer-events-none absolute inset-0 mix-blend-color-dodge" style={{ background: "linear-gradient(120deg, rgba(255,0,150,.25), rgba(0,255,200,.25), rgba(255,220,0,.25))" }} />}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-1.5 py-1 text-[10px] font-bold text-white">
            <span><span className={`pos pos-${c.pos} mr-1`}>{c.pos}</span>{c.team}</span>
            <span className={r.text}>#{c.serial}/{c.print_run}</span>
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between px-0.5 text-[11px]">
          <span className="text-zinc-400">FMV</span>
          <span className="font-mono font-bold text-emerald-600">{fmtCoins(c.value)}</span>
        </div>
      </div>
    </div>
  );
}
