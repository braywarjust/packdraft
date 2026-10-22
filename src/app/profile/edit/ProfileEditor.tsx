"use client";
/* eslint-disable @next/next/no-img-element */

import { Busy } from "@/components/LoadingLogo";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Avatar, ProfileView, type ProfileViewData } from "@/components/ProfileView";
import { SlabImage, PlayerCard, RarityBadge, slabOf, type CardData } from "@/components/PlayerCard";
import { Slab } from "@/components/Slab";
import { TeamBadge } from "@/components/TeamBadge";
import { TeamLogo } from "@/components/TeamLogo";
import { CheckIcon } from "@/components/Icons";
import { SECTION_LABEL, type ProfileLook } from "@/lib/profile-look";
import { saveProfileAction } from "../actions";

type Nba = { abbr: string; name: string; color: string; alt: string };
type Initial = ProfileViewData & { cards: CardData[] };

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`tab ${value === v ? "tab-active" : ""}`}>{label}</button>
      ))}
    </div>
  );
}

function Panel({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 space-y-4 p-5">
      <div><h2 className="text-lg font-black">{title}</h2>{hint && <p className="text-sm text-zinc-500">{hint}</p>}</div>
      {children}
    </section>
  );
}

export function ProfileEditor({ initial, nba, maxFeatured }: { initial: Initial; nba: Nba[]; maxFeatured: number }) {
  const router = useRouter();
  const [name, setName] = useState(initial.user.name);
  const [tagline, setTagline] = useState(initial.user.tagline);
  const [bio, setBio] = useState(initial.user.bio);
  const [avatar, setAvatar] = useState(initial.user.avatar);
  const [look, setLook] = useState<ProfileLook>(initial.look);
  const [fav, setFav] = useState<number | null>(initial.favPresetId);
  const [featured, setFeatured] = useState<number[]>(initial.featured.map((c) => c.id));
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const set = (p: Partial<ProfileLook>) => setLook((l) => ({ ...l, ...p }));

  const byId = new Map(initial.cards.map((c) => [c.id, c]));
  const favBrand = initial.presets.find((p) => p.id === fav)?.brand ?? null;
  const nbaTeam = nba.find((t) => t.abbr === look.nba) ?? null;
  const preview: ProfileViewData = {
    ...initial,
    user: { ...initial.user, name: name || initial.user.name, tagline, bio, avatar },
    look, favBrand, nba: nbaTeam, favPresetId: fav,
    featured: featured.map((id) => byId.get(id)).filter((c): c is CardData => !!c),
  };

  const upload = async (f: File) => {
    setErr(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/upload/avatar", { method: "POST", body: fd });
    const j = await r.json();
    setUploading(false);
    if (!r.ok) { setErr(j.error ?? "Upload failed"); return; }
    setAvatar(j.url);
  };
  const toggleCard = (id: number) => setFeatured((f) => f.includes(id) ? f.filter((x) => x !== id) : f.length >= maxFeatured ? f : [...f, id]);
  const moveCard = (i: number, d: number) => setFeatured((f) => { const n = [...f]; const j = i + d; if (j < 0 || j >= n.length) return f; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const moveSection = (i: number, d: number) => setLook((l) => { const o = [...l.order]; const j = i + d; if (j < 0 || j >= o.length) return l; [o[i], o[j]] = [o[j], o[i]]; return { ...l, order: o }; });
  const save = () => start(async () => {
    setErr(null);
    const r = await saveProfileAction({ name, tagline, bio, avatar, look, favPresetId: fav, featured });
    if ("error" in r && r.error) { setErr(r.error); return; }
    router.push(`/profile/${initial.user.id}`);
    router.refresh();
  });

  return (
    <div className="space-y-6 pb-24">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Photo and name">
          <div className="flex items-center gap-4">
            <Avatar src={avatar} name={name || "?"} color={initial.user.color} size={88} />
            <div className="flex flex-wrap gap-2">
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              <button type="button" className="btn-primary" disabled={uploading} onClick={() => file.current?.click()}>{uploading ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}</button>
              {avatar && <button type="button" className="btn-ghost" onClick={() => setAvatar(null)}>Remove</button>}
            </div>
          </div>
          <p className="text-xs text-zinc-500">Any photo. We crop it to a circle.</p>
          <div>
            <label className="label">Username</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} className="input" />
            <p className="mt-1 text-xs text-zinc-500">This is also the name you sign in with.</p>
          </div>
          <div><label className="label">Tagline</label><input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} className="input" placeholder="Pulling grails since day one" /></div>
          <div><label className="label">Bio</label><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} rows={3} className="input" placeholder="Favourite players, collecting goals, smack talk…" /></div>
        </Panel>

        <Panel title="Look" hint="Pick where your colours come from, then style the banner.">
          <div><label className="label">Colours from</label>
            <Choice value={look.theme} onChange={(theme) => set({ theme })} options={[["team", "My favourite team"], ["nba", "NBA team"], ["custom", "Custom"]]} />
          </div>
          <div>
            <label className="label">Favourite team (Team Studio)</label>
            {initial.presets.length ? (
              <div className="flex flex-wrap gap-2">
                {initial.presets.map((p) => (
                  <button key={p.id} type="button" onClick={() => setFav(p.id)} title={p.brand.name}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-bold ring-1 transition ${fav === p.id ? "bg-white/10 ring-2 ring-fpts" : "ring-white/10 hover:bg-white/5"}`}>
                    <TeamBadge brand={p.brand} size={26} />{p.brand.abbr}
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-zinc-500">Make a team in Team Studio to use its colours.</p>}
          </div>
          <div>
            <label className="label">Favourite NBA team</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set({ nba: null })} className={`grid h-10 w-10 place-items-center rounded-lg text-[10px] font-bold ring-1 ${!look.nba ? "ring-2 ring-fpts" : "ring-white/10"}`}>None</button>
              {nba.map((t) => (
                <button key={t.abbr} type="button" onClick={() => set({ nba: t.abbr })} title={t.name}
                  className={`grid h-10 w-10 place-items-center rounded-lg ring-1 transition ${look.nba === t.abbr ? "bg-white/10 ring-2 ring-fpts" : "ring-white/10 hover:bg-white/5"}`}>
                  <TeamLogo team={t.abbr} size={28} />
                </button>
              ))}
            </div>
          </div>
          {look.theme === "custom" && (
            <div className="flex flex-wrap gap-4">
              {(["color", "alt"] as const).map((k) => (
                <div key={k}><label className="label">{k === "color" ? "Main colour" : "Second colour"}</label>
                  <input type="color" value={look[k]} onChange={(e) => set({ [k]: e.target.value })} className="h-10 w-16 cursor-pointer rounded-lg border border-line bg-panel p-1" />
                </div>
              ))}
            </div>
          )}
          <div><label className="label">Banner</label><Choice value={look.banner} onChange={(banner) => set({ banner })} options={[["stripes", "Stripes"], ["court", "Court lines"], ["glow", "Glow"], ["solid", "Clean"]]} /></div>
          <div><label className="label">Big logo behind the banner</label><Choice value={look.watermark} onChange={(watermark) => set({ watermark })} options={[["team", "My team"], ["nba", "NBA team"], ["none", "None"]]} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={look.ring} onChange={(e) => set({ ring: e.target.checked })} /> Colour ring around my photo</label>
        </Panel>
      </div>

      <Panel id="featured" title={`Featured slabs (${featured.length}/${maxFeatured})`} hint="Tap slabs to pin them. The first one leads the showcase.">
        <div><label className="label">Showcase style</label><Choice value={look.showcase} onChange={(showcase) => set({ showcase })} options={[["shelf", "Shelf"], ["grid", "Grid"], ["spotlight", "Spotlight"]]} /></div>
        {featured.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {featured.map((id, i) => { const c = byId.get(id); if (!c) return null; return (
              <div key={id} className="flex items-center gap-2 rounded-xl bg-black/20 p-2 ring-1 ring-white/10">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-fpts text-xs font-black text-black">{i + 1}</span>
                <span className="max-w-[140px] truncate text-sm font-semibold">{c.name}</span>
                <button type="button" className="hit press rounded px-1.5 text-zinc-400 hover:text-white disabled:opacity-30" disabled={i === 0} onClick={() => moveCard(i, -1)} aria-label="Move left">&lsaquo;</button>
                <button type="button" className="hit press rounded px-1.5 text-zinc-400 hover:text-white disabled:opacity-30" disabled={i === featured.length - 1} onClick={() => moveCard(i, 1)} aria-label="Move right">&rsaquo;</button>
              </div>
            ); })}
          </div>
        )}
        {initial.cards.length === 0 ? <p className="text-sm text-zinc-500">Rip some packs first, then pin your best pulls here.</p> : (
          <div className="-mx-2 grid max-h-[480px] grid-cols-3 gap-3 overflow-y-auto p-2 sm:grid-cols-5 lg:grid-cols-8">
            {initial.cards.map((c) => { const n = featured.indexOf(c.id); return (
              <button key={c.id} type="button" onClick={() => toggleCard(c.id)} title={c.name}
                className={`relative flex flex-col items-center rounded-xl p-2 transition ${n >= 0 ? "bg-fpts/15 ring-2 ring-fpts" : "ring-1 ring-white/5 hover:bg-white/5"} ${n < 0 && featured.length >= maxFeatured ? "opacity-40" : ""}`}>
                {n >= 0 && <span className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-fpts text-[11px] font-black text-black">{n + 1}</span>}
                {c.kind === "slab" ? <Slab s={slabOf(c)} size={120} /> : c.slab_id ? <SlabImage id={c.slab_id} alt={c.name} height={120} rarity={c.rarity} /> : <div className="flex h-[130px] w-full justify-center overflow-hidden"><div className="origin-top scale-50"><PlayerCard c={c} small /></div></div>}
                <RarityBadge rarity={c.rarity} className="mt-1" />
                <span className="mt-0.5 w-full truncate text-[10px] text-zinc-500">{c.name}</span>
              </button>
            ); })}
          </div>
        )}
      </Panel>

      <Panel title="Sections" hint="Show or hide each part of your profile and set the order.">
        <div className="space-y-2">
          {look.order.map((s, i) => (
            <div key={s} className="flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/5">
              <input type="checkbox" checked={look.sections[s]} onChange={(e) => set({ sections: { ...look.sections, [s]: e.target.checked } })} />
              <span className={`flex-1 text-sm font-semibold ${look.sections[s] ? "" : "text-zinc-500 line-through"}`}>{SECTION_LABEL[s]}</span>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={i === 0} onClick={() => moveSection(i, -1)}>Up</button>
              <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={i === look.order.length - 1} onClick={() => moveSection(i, 1)}>Down</button>
            </div>
          ))}
        </div>
      </Panel>

      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-fpts">Live preview</p>
        <div className="rounded-3xl border border-dashed border-white/15 p-4"><ProfileView d={preview} preview /></div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#171c27]/95 backdrop-blur lg:pl-[var(--sb)]">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-8">
          {err && <p className="mr-auto text-sm text-red-500">{err}</p>}
          <button type="button" className="btn-ghost" onClick={() => router.push(`/profile/${initial.user.id}`)}>Cancel</button>
          <button type="button" className="btn-primary relative inline-flex items-center gap-2" disabled={pending || uploading} onClick={save}><Busy on={pending} label="Saving"><CheckIcon />Save profile</Busy></button>
        </div>
      </div>
    </div>
  );
}
