import Link from "next/link";
import type { Preset } from "@/lib/branding";
import { TeamBadge } from "./TeamBadge";

/** Radio cards to choose one of your Team Studio presets in a create/join form (field: preset_id). */
export function PresetPicker({ presets, compact = false }: { presets: Preset[]; compact?: boolean }) {
  if (!presets.length) {
    return (
      <div>
        <label className="label">Your team</label>
        <input name="team_name" className="input" placeholder="Team name" />
        <p className="mt-1 text-xs text-zinc-500">Tip: <Link href="/teams" className="text-brand underline">set up a team in Team Studio</Link> to bring your colours and logo.</p>
      </div>
    );
  }
  return (
    <div>
      <label className="label">Your team</label>
      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {presets.map((p, i) => (
          <label key={p.id} className="cursor-pointer">
            <input type="radio" name="preset_id" value={p.id} defaultChecked={i === 0} className="peer sr-only" />
            <span className="flex items-center gap-2.5 rounded-lg border border-line bg-panel p-2 transition peer-checked:border-brand peer-checked:ring-2 peer-checked:ring-brand/30">
              <TeamBadge brand={{ name: p.name, abbr: p.abbr, color: p.color, alt: p.alt_color, logo: p.logo_url }} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.alt_color }} />
            </span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-zinc-500"><Link href="/teams" className="text-brand underline">Manage teams</Link></p>
    </div>
  );
}
