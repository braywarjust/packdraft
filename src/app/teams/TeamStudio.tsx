"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { TeamBadge } from "@/components/TeamBadge";
import { deletePresetAction, favoritePresetAction, savePresetAction } from "../actions";
import { StarIcon } from "@/components/Icons";

type P = { id?: number; name: string; abbr: string; color: string; alt_color: string; logo_url: string | null };
const SWATCHES = ["#0253a4", "#1f63b5", "#cc2b31", "#111827", "#ffffff", "#f5c15c", "#10b981", "#7c3aed", "#f97316", "#0ea5e9", "#be123c", "#64748b"];
const autoAbbr = (name: string) => (name.split(/\s+/).filter(Boolean).length > 1 ? name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("") : name).replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "TM";
const blank = (): P => ({ name: "", abbr: "", color: "#0253a4", alt_color: "#cc2b31", logo_url: null });

/** Big branded preview card: the same look teams get across leagues. */
function Preview({ p }: { p: P }) {
  const brand = { name: p.name || "Your Team", abbr: p.abbr || autoAbbr(p.name || "Your Team"), color: p.color, alt: p.alt_color, logo: p.logo_url };
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="relative flex items-center gap-4 p-5" style={{ background: `linear-gradient(120deg, ${p.color}, ${p.color} 55%, ${p.alt_color})` }}>
        <TeamBadge brand={brand} size={72} />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">{brand.abbr}</p>
          <p className="truncate text-2xl font-black text-white drop-shadow">{brand.name}</p>
          <p className="text-xs text-white/80">7-2 · 1,048.5 PF</p>
        </div>
      </div>
      <div className="flex items-center gap-3 bg-panel2 px-5 py-3 text-sm">
        <TeamBadge brand={brand} size={24} /><span className="font-semibold">{brand.name}</span>
        <span className="ml-auto font-mono text-zinc-500">vs</span>
        <span className="h-3 w-3 rounded-full" style={{ background: p.color }} /><span className="h-3 w-3 rounded-full" style={{ background: p.alt_color }} />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-panel p-1" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="input w-28 font-mono uppercase" maxLength={7} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SWATCHES.map((c) => (
          <button key={c} type="button" onClick={() => onChange(c)} title={c} className={`h-5 w-5 rounded-full ring-1 ring-black/20 ${value.toLowerCase() === c ? "outline outline-2 outline-offset-2 outline-brand" : ""}`} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

export function TeamStudio({ presets, startNew, favorite }: { presets: P[]; startNew: boolean; favorite: number | null }) {
  const router = useRouter();
  const [edit, setEdit] = useState<P | null>(startNew ? blank() : null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  const upload = async (f: File) => {
    setErr(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/upload/logo", { method: "POST", body: fd });
    const j = await r.json();
    setUploading(false);
    if (!r.ok) { setErr(j.error ?? "Upload failed"); return; }
    setEdit((e) => (e ? { ...e, logo_url: j.url } : e));
  };
  const save = () => edit && start(async () => {
    const r = (await savePresetAction(edit)) as { error?: string };
    if (r?.error) { setErr(r.error); return; }
    setEdit(null);
    setErr(null);
    router.refresh();
  });

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        {presets.length > 1 && <p className="text-xs text-zinc-500">Star a team to brand your home page with it.</p>}
        {presets.map((p) => (
          <div key={p.id} className="relative">
          <span role="button" tabIndex={0} title={favorite === p.id ? "Favourite: brands your home page" : "Make this your favourite team"}
            onClick={() => start(async () => { await favoritePresetAction(favorite === p.id ? null : p.id!); router.refresh(); })}
            className={`absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1.5 text-lg transition hover:bg-panel2 ${favorite === p.id ? "text-amber-400" : "text-zinc-500 hover:text-amber-400"}`}>
            <StarIcon />
          </span>
          <button onClick={() => { setEdit({ ...p }); setErr(null); }}
            className={`card flex w-full items-center gap-3 p-3 pr-12 text-left transition hover:border-brand/60 ${edit?.id === p.id ? "border-brand" : ""}`}>
            <TeamBadge brand={{ name: p.name, abbr: p.abbr, color: p.color, alt: p.alt_color, logo: p.logo_url }} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{p.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                {p.abbr}
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.alt_color }} />
                {p.logo_url ? "· logo" : "· no logo"}
              </span>
            </span>
            {favorite === p.id && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-black">Favourite</span>}
          </button>
          </div>
        ))}
        <button onClick={() => { setEdit(blank()); setErr(null); }} className="card flex w-full items-center justify-center gap-2 border-dashed p-4 text-sm text-zinc-500 hover:border-brand/60 hover:text-brand">
          + New team
        </button>
        {presets.length > 0 && (
          <p className="text-xs text-zinc-500">Ready to play? <Link href="/leagues" className="text-brand underline">Join or create a league</Link> and pick one of these teams.</p>
        )}
      </div>

      <div className="lg:col-span-3">
        {edit ? (
          <div className="card space-y-5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{edit.id ? "Edit team" : "New team"}</h2>
              {edit.id && (
                <button onClick={() => { if (confirm(`Delete ${edit.name}? Leagues already using it keep their branding.`)) start(async () => { await deletePresetAction(edit.id!); setEdit(null); router.refresh(); }); }}
                  className="text-xs text-zinc-500 hover:text-red-600">Delete</button>
              )}
            </div>
            <Preview p={edit} />
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div><label className="label">Team name</label><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={32} className="input" placeholder="Wemby Wanna Cry" /></div>
              <div><label className="label">Short name</label><input value={edit.abbr} onChange={(e) => setEdit({ ...edit, abbr: e.target.value.toUpperCase() })} maxLength={4} className="input font-mono uppercase" placeholder={autoAbbr(edit.name || "Team")} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Primary colour" value={edit.color} onChange={(v) => setEdit({ ...edit, color: v })} />
              <ColorField label="Secondary colour" value={edit.alt_color} onChange={(v) => setEdit({ ...edit, alt_color: v })} />
            </div>
            <div>
              <label className="label">Logo (transparent PNG)</label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-lg border border-line bg-[repeating-conic-gradient(#2c3445_0_25%,#252c3b_0_50%)] bg-[length:12px_12px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {edit.logo_url ? <img src={edit.logo_url} alt="" className="h-14 w-14 object-contain" /> : <span className="text-[10px] text-zinc-500">None</span>}
                </div>
                <input ref={file} type="file" accept="image/png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
                <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="btn-ghost">{uploading ? "Uploading…" : edit.logo_url ? "Replace logo" : "Upload logo"}</button>
                {edit.logo_url && <button type="button" onClick={() => setEdit({ ...edit, logo_url: null })} className="text-xs text-zinc-500 hover:text-red-600">Remove</button>}
              </div>
              <p className="mt-1.5 text-xs text-zinc-500">PNG with a transparent background. Empty edges are trimmed automatically. No logo? Your short name and colours make a badge instead.</p>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button onClick={save} disabled={pending || uploading} className="btn-primary">{pending ? "Saving…" : edit.id ? "Save changes" : "Save team"}</button>
              <button onClick={() => { setEdit(null); setErr(null); }} className="btn-ghost">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="card grid place-items-center p-10 text-center text-sm text-zinc-500">
            {presets.length ? "Pick a team to edit, or make a new one." : "Make your first team to get started."}
          </div>
        )}
      </div>
    </div>
  );
}
