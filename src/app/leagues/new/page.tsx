import { Coins } from "@/components/Coins";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { createLeague } from "../../actions";
import { PageHeader } from "@/components/PageHeader";

export default async function NewLeague() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Leagues" title="Create a league" description={<>Up to 8 teams is free. Bigger leagues cost <Coins n={2500} className="font-semibold text-emerald-600" />. You can change everything later in commissioner settings.</>} />
      <ActionForm action={createLeague} submit="Create league" className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">League name</label><input name="name" className="input" placeholder="The Pack Rats" required /></div>
          <div><label className="label">Your team name</label><input name="team_name" className="input" placeholder="Wemby Wanna Cry" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Teams</label>
            <select name="max_teams" className="input" defaultValue="8">
              <option value="4">4</option><option value="6">6</option><option value="8">8 (free max)</option>
              <option value="10">10 · 2,500 Pack Points</option><option value="12">12 · 2,500 Pack Points</option>
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
        <p className="text-xs text-zinc-400">Real leagues follow the NBA calendar: week 1 starts the day after your draft, then Monday–Sunday weeks, daily lineups, live box scores. Simulated leagues are for testing or offseason fun: the commish tips off each week and games play out over the sim week length.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_public" className="h-4 w-4" /> Public league (anyone on PackDraft can find and join)</label>
      </ActionForm>
    </div>
  );
}
