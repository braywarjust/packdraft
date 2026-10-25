import { BrandEditor } from "@/components/BrandEditor";
import { PresetPicker } from "@/components/PresetPicker";
import { userPresets } from "@/lib/branding";
import { Coins } from "@/components/Coins";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { createLeague } from "../../actions";
import { PageHeader } from "@/components/PageHeader";

export default async function NewLeague() {
  const u = await requireUser();
  const presets = userPresets(u.id);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon="leagues" eyebrow="Leagues" title="Create a league" description={<>Up to 8 teams free; bigger costs <Coins n={2500} className="font-semibold text-emerald-600" />. You&apos;re the League Manager and can change anything later.</>} />
      <ActionForm action={createLeague} submit="Create league" className="card space-y-5 p-6">
        <BrandEditor fields label="League" initial={{ name: "", abbr: "", color: "#0253a4", alt_color: "#cc2b31", logo_url: null }} />
        <PresetPicker presets={presets} />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Teams</label>
            <select name="max_teams" className="input" defaultValue="8">
              <option value="4">4</option><option value="6">6</option><option value="8">8 (free max)</option>
              <option value="10">10 · 2,500 Fantasy Coins</option><option value="12">12 · 2,500 Fantasy Coins</option>
            </select>
          </div>
          <div>
            <label className="label">Scoring</label>
            <select name="scoring" className="input" defaultValue="espn">
              <option value="espn">ESPN points</option><option value="dk">DraftKings style</option>
            </select>
          </div>
          <div>
            <label className="label">Waivers</label>
            <select name="waiver_type" className="input" defaultValue="faab">
              <option value="faab">FAAB bidding</option><option value="free">Free agency (instant)</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Games</label>
            <select name="mode" className="input" defaultValue="real">
              <option value="real">Real NBA games (live ESPN stats)</option>
              <option value="sim">Simulated (play any time)</option>
            </select>
          </div>
          <div><label className="label">Regular season weeks</label><input name="season_weeks" type="number" min={1} max={24} defaultValue={20} className="input" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div><label className="label">FAAB budget</label><input name="faab_budget" type="number" min={0} defaultValue={100} className="input" /></div>
          <div><label className="label">Keepers / team</label><input name="keeper_count" type="number" min={0} max={5} defaultValue={0} className="input" /></div>
          <div><label className="label">Pick clock (s)</label><input name="pick_seconds" type="number" min={10} max={600} defaultValue={60} className="input" /></div>
          <div><label className="label">Sim week length (min)</label><input name="sim_minutes" type="number" step="0.5" min={0.5} defaultValue={5} className="input" /></div>
        </div>
        <p className="text-xs text-zinc-400">Real: follows the NBA schedule with live stats, Monday–Sunday weeks. Simulated: for testing or the offseason; the League Manager tips off each week.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_public" className="h-4 w-4" /> Public league (anyone can join)</label>
      </ActionForm>
    </div>
  );
}
