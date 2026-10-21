"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { TeamBadge } from "./TeamBadge";

export type BrandDraft = { name: string; abbr: string; color: string; alt_color: string; logo_url: string | null };
const SWATCHES = ["#0253a4", "#1f63b5", "#cc2b31", "#111827", "#ffffff", "#f5c15c", "#10b981", "#7c3aed", "#f97316", "#0ea5e9", "#be123c", "#64748b"];
const autoAbbr = (name: string) => (name.split(/\s+/).filter(Boolean).length > 1 ? name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("") : name).replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "LG";

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

/**
 * Name / short name / two colours / logo (any image), with a live banner preview.
 * `fields`: render hidden inputs (name, brand_abbr, brand_color, brand_alt, brand_logo) for a surrounding server form.
 * `onSave`: show a Save button that calls it.
 */
export function BrandEditor({ initial, label = "League", placeholder = "The Pack Rats", fields = false, onSave, subtitle }: {
  initial: BrandDraft; label?: string; placeholder?: string; fields?: boolean; subtitle?: string;
  onSave?: (b: BrandDraft) => Promise<unknown>;
}) {
  const router = useRouter();
  const [b, setB] = useState<BrandDraft>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const brand = { name: b.name || `Your ${label}`, abbr: b.abbr || autoAbbr(b.name || label), color: b.color, alt: b.alt_color, logo: b.logo_url };

  const upload = async (f: File) => {
    setErr(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/upload/logo", { method: "POST", body: fd }).catch(() => null);
    const j: { url?: string; error?: string } = r ? await r.json().catch(() => ({})) : {};
    setUploading(false);
    if (!r?.ok || !j.url) { setErr(j.error ?? (r?.status === 413 ? "That image is too big. Try a smaller one." : "Upload failed. Check your connection and try again.")); return; }
    const url = j.url;
    setB((x) => ({ ...x, logo_url: url }));
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-white/10" style={{ background: `linear-gradient(120deg, ${b.color}, ${b.color} 55%, ${b.alt_color})` }}>
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-20"><TeamBadge brand={brand} size={150} ghost /></div>
        <div className="relative flex items-center gap-4 p-4">
          <TeamBadge brand={brand} size={64} className="drop-shadow-xl" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">{brand.abbr}{subtitle ? ` · ${subtitle}` : ""}</p>
            <p className="truncate text-2xl font-black text-white">{brand.name}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div><label className="label">{label} name</label><input name={fields ? "name" : undefined} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} maxLength={40} className="input" placeholder={placeholder} required={fields} /></div>
        <div><label className="label">Short name</label><input value={b.abbr} onChange={(e) => setB({ ...b, abbr: e.target.value.toUpperCase() })} maxLength={4} className="input font-mono uppercase" placeholder={autoAbbr(b.name || label)} /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField label="Primary colour" value={b.color} onChange={(v) => setB({ ...b, color: v })} />
        <ColorField label="Secondary colour" value={b.alt_color} onChange={(v) => setB({ ...b, alt_color: v })} />
      </div>
      <div>
        <label className="label">Logo</label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-lg border border-line bg-[repeating-conic-gradient(#2c3445_0_25%,#252c3b_0_50%)] bg-[length:12px_12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {b.logo_url ? <img src={b.logo_url} alt="" className="h-12 w-12 object-contain" /> : <span className="text-[10px] text-zinc-500">None</span>}
          </div>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="btn-ghost">{uploading ? "Uploading…" : b.logo_url ? "Replace logo" : "Upload logo"}</button>
          {b.logo_url && <button type="button" onClick={() => setB({ ...b, logo_url: null })} className="text-xs text-zinc-500 hover:text-red-600">Remove</button>}
        </div>
      </div>
      {fields && (
        <>
          <input type="hidden" name="brand_abbr" value={b.abbr} />
          <input type="hidden" name="brand_color" value={b.color} />
          <input type="hidden" name="brand_alt" value={b.alt_color} />
          <input type="hidden" name="brand_logo" value={b.logo_url ?? ""} />
        </>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {onSave && (
        <div className="flex items-center gap-3">
          <button type="button" disabled={pending || uploading} className="btn-primary"
            onClick={() => start(async () => {
              setMsg(null);
              const r = (await onSave(b)) as { error?: string };
              if (r?.error) { setErr(r.error); return; }
              setErr(null);
              setMsg("Saved");
              router.refresh();
            })}>{pending ? "Saving…" : `Save ${label.toLowerCase()} branding`}</button>
          {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        </div>
      )}
    </div>
  );
}
