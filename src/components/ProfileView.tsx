/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ProfileLook } from "@/lib/profile-look";
import { TeamBadge, TeamName, type BrandLite } from "./TeamBadge";
import { TeamLogo } from "./TeamLogo";
import { PlayerCard, RarityBadge, SlabImage, type CardData } from "./PlayerCard";
import { Coins } from "./Coins";
import { SlabIcon } from "./SlabIcon";
import { CrownIcon, StarIcon } from "./Icons";
import { NAV_ICONS, NavIcon } from "./NavIcons";

export type ProfileViewData = {
  user: { id: number; name: string; color: string; avatar: string | null; tagline: string; bio: string; since: number };
  look: ProfileLook;
  favBrand: BrandLite | null;
  nba: { abbr: string; name: string; color: string; alt: string } | null;
  presets: { id: number; brand: BrandLite }[];
  favPresetId: number | null;
  featured: CardData[];
  leagues: { id: number; name: string; record: string; brand: BrandLite }[];
  stats: { slabs: number; vault: number; best: CardData | null; ripped: number; wins: number; losses: number; ppEarned: number; betsWon: number };
};

/** The profile's two colours, from the chosen source. */
export function profileColors(d: Pick<ProfileViewData, "look" | "favBrand" | "nba" | "user">): [string, string] {
  if (d.look.theme === "team" && d.favBrand) return [d.favBrand.color, d.favBrand.alt];
  if (d.look.theme === "nba" && d.nba) return [d.nba.color, d.nba.alt];
  if (d.look.theme === "custom") return [d.look.color, d.look.alt];
  return [d.look.color, d.look.alt];
}

export function Avatar({ src, name, color, size = 32, ring, className = "" }: { src: string | null; name: string; color: string; size?: number; ring?: string; className?: string }) {
  const style = { width: size, height: size, boxShadow: ring ? `0 0 0 ${Math.max(2, size / 24)}px ${ring}` : undefined };
  if (src) return <img src={src} alt={name} className={`shrink-0 rounded-full object-cover ${className}`} style={style} />;
  return (
    <span className={`inline-grid shrink-0 place-items-center rounded-full font-black text-white ${className}`} style={{ ...style, background: color, fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Banner({ look, c1, c2 }: { look: ProfileLook; c1: string; c2: string }) {
  const base = { background: `linear-gradient(115deg, ${c1} 0%, ${c1} 45%, ${c2} 135%)` };
  return (
    <div className="pointer-events-none absolute inset-0" style={base}>
      {look.banner === "stripes" && <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.07) 0 2px, transparent 2px 14px)" }} />}
      {look.banner === "glow" && <div className="absolute inset-0" style={{ background: `radial-gradient(60% 90% at 15% 20%, ${c2}aa, transparent 60%), radial-gradient(50% 80% at 90% 90%, rgba(255,255,255,.18), transparent 60%)` }} />}
      {look.banner === "court" && (
        <svg className="absolute inset-0 h-full w-full opacity-25" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid slice" fill="none" stroke="white" strokeWidth="3">
          <rect x="20" y="20" width="960" height="260" /><line x1="500" y1="20" x2="500" y2="280" /><circle cx="500" cy="150" r="60" /><circle cx="500" cy="150" r="20" />
          <rect x="20" y="90" width="170" height="120" /><path d="M20 40 H120 A150 150 0 0 1 120 260 H20" />
          <rect x="810" y="90" width="170" height="120" /><path d="M980 40 H880 A150 150 0 0 0 880 260 H980" />
        </svg>
      )}
    </div>
  );
}

function Section({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-tight">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Showcase({ cards, look, c1, c2 }: { cards: CardData[]; look: ProfileLook; c1: string; c2: string }) {
  const slab = (c: CardData, h: number) => c.slab_id
    ? <SlabImage id={c.slab_id} alt={c.name} height={h} rarity={c.rarity} className="drop-shadow-[0_18px_24px_rgba(0,0,0,.55)]" />
    : <PlayerCard c={c} small={h < 260} />;
  const caption = (c: CardData) => (
    <div className="mt-2 text-center">
      <RarityBadge rarity={c.rarity} />
      <p className="mt-1 max-w-[180px] truncate text-xs font-semibold text-zinc-900">{c.name}</p>
      <p className="font-mono text-xs font-bold text-emerald-600"><Coins n={c.value} /></p>
    </div>
  );
  if (look.showcase === "spotlight") {
    const [top, ...rest] = cards;
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6" style={{ background: `radial-gradient(70% 90% at 50% 0%, ${c1}66, transparent 70%), #121722` }}>
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="absolute -inset-10 rounded-full opacity-50 blur-3xl" style={{ background: c2 }} />
            <div className="relative">{slab(top, 380)}</div>
          </div>
          {caption(top)}
        </div>
        {rest.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-5 border-t border-white/10 pt-6">
            {rest.map((c) => <div key={c.id} className="flex flex-col items-center">{slab(c, 180)}{caption(c)}</div>)}
          </div>
        )}
      </div>
    );
  }
  if (look.showcase === "grid") {
    return (
      <div className="grid grid-cols-2 justify-items-center gap-6 sm:grid-cols-3">
        {cards.map((c) => <div key={c.id} className="flex flex-col items-center rounded-2xl bg-black/20 p-4 ring-1 ring-white/5">{slab(c, 240)}{caption(c)}</div>)}
      </div>
    );
  }
  // Shelf: slabs standing on a lit ledge in the profile colours.
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 px-4 pt-8" style={{ background: `linear-gradient(180deg, #121722, #171d2b)` }}>
      <div className="flex flex-wrap items-end justify-center gap-6">
        {cards.map((c) => <div key={c.id} className="relative z-10 flex flex-col items-center">{slab(c, 250)}</div>)}
      </div>
      <div className="relative -mx-4 mt-[-6px] h-5" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})`, boxShadow: `0 -10px 40px ${c1}88` }} />
      <div className="-mx-4 h-3 bg-black/40" />
      <div className="flex flex-wrap justify-center gap-6 py-4">
        {cards.map((c) => <div key={c.id} style={{ width: 166 }}>{caption(c)}</div>)}
      </div>
    </div>
  );
}

/** A player's profile. `editHref` shows the edit button (your own profile). */
export function ProfileView({ d, editHref, preview = false }: { d: ProfileViewData; editHref?: string; preview?: boolean }) {
  const { user, look } = d;
  const [c1, c2] = profileColors(d);
  const since = new Date(user.since).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const record = `${d.stats.wins}-${d.stats.losses}`;

  const sections: Record<string, React.ReactNode> = {
    featured: (
      <Section key="featured" title="Featured slabs" icon={<SlabIcon className="text-fpts" />}
        action={editHref && <Link href={`${editHref}#featured`} className="btn-ghost text-xs">Choose slabs</Link>}>
        {d.featured.length ? <Showcase cards={d.featured} look={look} c1={c1} c2={c2} /> : (
          <div className="card p-8 text-center text-sm text-zinc-500">
            {editHref ? <>Pin up to 6 of your slabs here. <Link href={`${editHref}#featured`} className="text-brand underline">Choose slabs</Link></> : "No featured slabs yet."}
          </div>
        )}
      </Section>
    ),
    stats: (
      <Section key="stats" title="Stats">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([
            ["Slabs", <span key="s" className="inline-flex items-center gap-1.5"><SlabIcon />{d.stats.slabs}</span>],
            ["Vault value", <Coins key="v" n={d.stats.vault} className="text-emerald-600" />],
            ["Packs ripped", String(d.stats.ripped)],
            ["League record", record],
            ["Earned in leagues", <Coins key="p" n={d.stats.ppEarned} className="text-emerald-600" />],
            ["Bets won", String(d.stats.betsWon)],
          ] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k} className="card relative overflow-hidden p-3">
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }} />
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{k}</p>
              <p className="mt-1 font-mono text-xl font-black text-white">{v}</p>
            </div>
          ))}
        </div>
        {d.stats.best && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-500"><CrownIcon className="text-amber-400" /> Best pull: <b className="text-white">{d.stats.best.name}</b> <RarityBadge rarity={d.stats.best.rarity} /> <Coins n={d.stats.best.value} className="font-bold text-emerald-600" /></p>
        )}
      </Section>
    ),
    teams: d.presets.length ? (
      <Section key="teams" title="Teams" icon={<NavIcon d={NAV_ICONS.studio} size={18} />}>
        <div className="flex flex-wrap gap-3">
          {d.presets.map((p) => (
            <div key={p.id} className="relative flex items-center gap-3 overflow-hidden rounded-xl py-2 pl-3 pr-4 ring-1 ring-white/10" style={{ background: `linear-gradient(100deg, ${p.brand.color}dd, ${p.brand.color}55 60%, ${p.brand.alt}33)` }}>
              <TeamBadge brand={p.brand} size={40} />
              <div><p className="font-black text-white">{p.brand.name}</p><p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{p.brand.abbr}</p></div>
              {p.id === d.favPresetId && <StarIcon className="text-amber-300" title="Favourite" />}
            </div>
          ))}
        </div>
      </Section>
    ) : null,
    leagues: d.leagues.length ? (
      <Section key="leagues" title="Leagues" icon={<NavIcon d={NAV_ICONS.leagues} size={18} />}>
        <div className="grid gap-2 sm:grid-cols-2">
          {d.leagues.map((l) => {
            const inner = (
              <>
                <TeamBadge brand={l.brand} size={36} />
                <div className="min-w-0 flex-1"><p className="truncate font-bold text-white">{l.brand.name}</p><p className="truncate text-xs text-zinc-500">{l.name}</p></div>
                <span className="font-mono font-black text-white">{l.record}</span>
              </>
            );
            const cls = "card flex items-center gap-3 p-3 transition hover:brightness-125";
            return preview ? <div key={l.id} className={cls}>{inner}</div> : <Link key={l.id} href={`/league/${l.id}`} className={cls}>{inner}</Link>;
          })}
        </div>
      </Section>
    ) : null,
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
        <Banner look={look} c1={c1} c2={c2} />
        {look.watermark === "team" && d.favBrand && <div className="pointer-events-none absolute -right-12 -top-10 opacity-20"><TeamBadge brand={d.favBrand} size={360} ghost /></div>}
        {look.watermark === "nba" && d.nba && <div className="pointer-events-none absolute -right-10 -top-12 opacity-20"><TeamLogo team={d.nba.abbr} size={340} /></div>}
        <div className="relative flex flex-wrap items-end gap-6 p-6 sm:p-8">
          <Avatar src={user.avatar} name={user.name} color={user.color} size={132} ring={look.ring ? c2 : undefined} className="shadow-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">PackDraft since {since}</p>
            <h1 className="mt-1 break-words text-4xl font-black leading-none tracking-tight text-white sm:text-5xl">{user.name}</h1>
            {user.tagline && <p className="mt-2 text-lg font-semibold text-white/90">{user.tagline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              {d.favBrand && <TeamName brand={d.favBrand} size={26} className="text-base font-black text-white" />}
              {d.nba && <span className="inline-flex items-center gap-2 text-base font-black text-white"><TeamLogo team={d.nba.abbr} size={26} />{d.nba.name}</span>}
            </div>
          </div>
          {editHref && <Link href={editHref} className="btn bg-[#fff] text-black hover:bg-[#e5e7eb]">Edit profile</Link>}
        </div>
        {user.bio && <p className="relative whitespace-pre-line border-t border-white/10 bg-black/30 px-6 py-4 text-sm text-white/85 backdrop-blur sm:px-8">{user.bio}</p>}
        <div className="relative h-2" style={{ background: `linear-gradient(90deg, ${c2}, ${c1}, ${c2})` }} />
      </section>
      {look.order.filter((s) => look.sections[s]).map((s) => sections[s])}
    </div>
  );
}
