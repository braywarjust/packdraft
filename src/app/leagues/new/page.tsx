import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { createLeague } from "../../actions";

export default async function NewLeague() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-black">Create a league</h1>
      <p className="mb-6 text-slate-400">Up to 8 teams is free. Bigger leagues cost $2,500 PackBucks. You can tweak everything later in commissioner settings.</p>
      <ActionForm action={createLeague} submit="Create league" className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">League name</label><input name="name" className="input" placeholder="The Pack Rats" required /></div>
          <div><label className="label">Your team name</label><input name="team_name" className="input" placeholder="Bijan Mustard" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Teams</label>
            <select name="max_teams" className="input" defaultValue="8">
              <option value="4">4</option><option value="6">6</option><option value="8">8 (free max)</option>
              <option value="10">10 · $2,500</option><option value="12">12 · $2,500</option>
            </select>
          </div>
          <div>
            <label className="label">Scoring</label>
            <select name="scoring" className="input" defaultValue="ppr">
              <option value="ppr">PPR</option><option value="half">Half PPR</option><option value="std">Standard</option>
            </select>
          </div>
          <div>
            <label className="label">Waivers</label>
            <select name="waiver_type" className="input" defaultValue="faab">
              <option value="faab">FAAB bidding</option><option value="free">Free agency (instant)</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div><label className="label">FAAB budget</label><input name="faab_budget" type="number" min={0} defaultValue={100} className="input" /></div>
          <div><label className="label">Keepers / team</label><input name="keeper_count" type="number" min={0} max={5} defaultValue={0} className="input" /></div>
          <div><label className="label">Pick clock (s)</label><input name="pick_seconds" type="number" min={10} max={600} defaultValue={60} className="input" /></div>
          <div><label className="label">Week length (min)</label><input name="sim_minutes" type="number" step="0.5" min={0.5} defaultValue={5} className="input" /></div>
        </div>
        <p className="text-xs text-slate-500">Week length is how long a simulated week of live games takes once the commish kicks it off. Short = fast, chaotic fun.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_public" className="h-4 w-4" /> Public league (anyone on PackDraft can find and join)</label>
      </ActionForm>
    </div>
  );
}
