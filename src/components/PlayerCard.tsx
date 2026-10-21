/* eslint-disable @next/next/no-img-element */
import { RARITIES, Rarity } from "@/lib/packs";
import { Slab, type SlabData } from "@/components/Slab";
import { TeamLogo } from "@/components/TeamLogo";
import { Coins } from "@/components/Coins";

export type CardData = {
  id: number; name: string; pos: string; team: string; rarity: Rarity; grade: number; serial: number; print_run: number; value: number;
  headshot?: string | null; jersey?: string | null; color?: string | null; alt?: string | null; logo?: string | null;
  slab_id?: number | null; s_year?: number | null; s_set?: string | null; s_no?: string | null; s_variant?: string | null;
  s_company?: string | null; s_grade?: string | null; s_cert?: string | null; s_flags?: string | null; s_source?: string | null;
  kind?: string | null; team_name?: string | null; photo?: string | null; player_id?: number; mult?: number | null;
  boost_pts?: number | null; boost_reb?: number | null; boost_ast?: number | null;
  /** "Equipped · Wed, Oct 22 · NBA" while a slab waits for its game. */
  equipped?: string | null;
};

/** Slab props for a new-style square Slab card. */
export const slabOf = (c: CardData): SlabData => ({
  name: c.name, team: c.team, team_name: c.team_name, pos: c.pos, rarity: c.rarity, serial: c.serial, jersey: c.jersey, color: c.color, alt: c.alt, photo: c.photo, mult: c.mult,
  boost: c.boost_pts == null ? null : { pts: c.boost_pts ?? 0, reb: c.boost_reb ?? 0, ast: c.boost_ast ?? 0 },
});

/** A square Slab with a short caption underneath. */
export function SlabTile({ c, small, size: sz }: { c: CardData; small?: boolean; size?: number }) {
  const size = sz ?? (small ? 176 : 208);
  return (
    <div className="flex flex-col items-center" style={{ width: size + 8 }}>
      <div className="relative">
        <Slab s={slabOf(c)} size={size} className={c.equipped ? "rounded-[9cqw] ring-2 ring-fpts ring-offset-2 ring-offset-[#171c27]" : ""} />
        {c.equipped && <span className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-fpts px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-black shadow">Equipped</span>}
      </div>
      {/* Team logo (the light version, no badge behind it), player name and number */}
      <div className="mt-2 w-full text-center">
        <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-900">
          {c.team && <TeamLogo team={c.team} size={18} />}
          <span className="truncate">{c.name}</span>
          {c.jersey && <span className="shrink-0 font-normal text-zinc-500">#{c.jersey}</span>}
        </p>
        {c.equipped && <p className="truncate text-[11px] font-semibold text-fpts">{c.equipped}</p>}
      </div>
    </div>
  );
}

// Solid rarity badge. Hex colours on purpose: the dark theme remaps Tailwind's tint scales.
const BADGE: Record<Rarity, string> = {
  common: "bg-[#64748b] text-white", rare: "bg-[#2563eb] text-white", epic: "bg-[#9333ea] text-white",
  legendary: "bg-[#dc2626] text-white", grail: "bg-[#bae6fd] text-black",
};
export function RarityBadge({ rarity, className = "" }: { rarity: Rarity; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase leading-tight tracking-wide shadow-sm ${BADGE[rarity]} ${className}`}>
      {RARITIES[rarity].label}
    </span>
  );
}

export function slabBadges(flags: string | null | undefined) {
  if (!flags) return [];
  const f = JSON.parse(flags) as Record<string, boolean>;
  return [f.blackLabel && "Black Label", f.auto && "Auto", f.mem && "Patch", f.rookie && "Rookie", f.insert && "Insert", f.premium && "Premium", f.numbered ? "Numbered" : f.parallel && "Parallel"]
    .filter(Boolean) as string[];
}

/** The slab photo on its own (transparent background), cropped to the slab. */
export function SlabImage({ id, alt, height, className = "" }: { id: number; alt: string; height: number; rarity?: Rarity; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ height, width: Math.round(height * 0.6) }}>
      <img
        src={`/api/slabs/${id}`}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{ filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.18))" }}
      />
    </div>
  );
}

/** A real graded slab: the slab itself is the tile, with a short caption underneath. */
export function SlabCard({ c, small }: { c: CardData; small?: boolean }) {
  const h = small ? 230 : 260;
  return (
    <div className="flex flex-col items-center" style={{ width: Math.round(h * 0.6) + 16 }}>
      <SlabImage id={c.slab_id!} alt={`${c.s_year} ${c.s_set} ${c.name}`} height={h} rarity={c.rarity} />
      <div className="mt-2 w-full text-center">
        <RarityBadge rarity={c.rarity} />
        <p className="mt-1 truncate text-xs font-semibold text-zinc-900">{c.name}</p>
        <p className="font-mono text-xs font-bold text-emerald-600" title={c.s_source === "ebay" ? "eBay market value" : c.s_source === "auction" ? "Record auction sale" : c.s_source === "courtyard" ? "Courtyard fair market value" : "Estimated value"}>
          <Coins n={c.value} />{c.s_source ? "" : "*"}
        </p>
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
  common: "rgba(148,163,184,0.25)", rare: "rgba(37,99,235,0.5)", epic: "rgba(147,51,234,0.55)", legendary: "rgba(220,38,38,0.65)", grail: "rgba(186,230,253,0.85)",
};
const GRADE_WORD: Record<number, string> = { 10: "GEM MT", 9.5: "MINT+", 9: "MINT", 8.5: "NM-MT+", 8: "NM-MT" };

/** The NBA season a card was pulled in (named by the year it ends, like ESPN: 2026-27 is 2027). */
function cardSeason(c: CardData & { created_at?: number }) {
  const d = new Date(c.created_at ?? Date.now());
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}

export function PlayerCard({ c, small, size }: { c: CardData; small?: boolean; size?: number }) {
  if (c.kind === "slab") return <SlabTile c={c} small={small} size={size} />;
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
            <span className="truncate">{small ? `PackDraft '${String(cardSeason(c)).slice(2)}` : `PackDraft ${cardSeason(c) - 1}-${String(cardSeason(c)).slice(2)}`}</span>
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
          <span className="font-mono font-bold text-emerald-600"><Coins n={c.value} /></span>
        </div>
      </div>
    </div>
  );
}
