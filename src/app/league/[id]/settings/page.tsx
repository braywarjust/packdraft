import { ensureBranding, leagueBrand } from "@/lib/branding";
import { BrandEditor } from "@/components/BrandEditor";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getLeague, leagueTeams, ROUNDS } from "@/lib/league";
import { PACKS } from "@/lib/packs";
import { ActionButton } from "@/components/ActionButton";
import { SettingsForm, KeeperForm } from "./forms";
import { removeKeeper, removeTeam, setKeeper, updateLeagueBrandAction, updateSettings } from "../../../actions";

export default async function Settings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  if (l.commissioner_id !== u.id) redirect(`/league/${l.id}`);
  const teams = leagueTeams(l.id);
  const pre = l.draft_status === "pre";
  const keepers = all<{ player_id: number; round: number; team_id: number; name: string; pos: string }>(
    "SELECT k.*, p.name, p.pos FROM keepers k JOIN players p ON p.id = k.player_id WHERE k.league_id = ? ORDER BY k.team_id, k.round", l.id);
  const players = all<{ id: number; name: string; pos: string }>("SELECT id, name, pos FROM players ORDER BY adp");
  const sel = (name: string, value: string) => (
    <select name={name} defaultValue={value} className="input">
      {PACKS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.price.toLocaleString()} Pack Points)</option>)}
    </select>
  );

  ensureBranding();
  const lb = leagueBrand(getLeague(l.id)!);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-3 p-5 lg:col-span-2">
        <h2 className="text-lg font-bold">League branding</h2>
        <p className="text-sm text-zinc-500">Name, short name, colours and a transparent PNG logo. Change it whenever you like; it shows across the whole league.</p>
        <BrandEditor label="League" subtitle={`${teams.length} teams`}
          initial={{ name: l.name, abbr: lb.abbr, color: lb.color, alt_color: lb.alt, logo_url: lb.logo }}
          onSave={updateLeagueBrandAction.bind(null, l.id)} />
      </section>
      <SettingsForm action={updateSettings.bind(null, l.id)}>
        <h2 className="text-lg font-bold">League settings</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Scoring</label>
            <select name="scoring" defaultValue={l.scoring} className="input"><option value="espn">ESPN points</option><option value="dk">DraftKings style</option></select></div>
          <div><label className="label">Games {pre ? "" : "(locked)"}</label>
            <select name="mode" defaultValue={l.mode} disabled={!pre} className="input"><option value="real">Real NBA</option><option value="sim">Simulated</option></select></div>
          <div><label className="label">Waivers</label>
            <select name="waiver_type" defaultValue={l.waiver_type} className="input"><option value="faab">FAAB</option><option value="free">Free agency</option></select></div>
          <div><label className="label">Pick clock (seconds)</label><input name="pick_seconds" type="number" min={10} defaultValue={l.pick_seconds} className="input" /></div>
          <div><label className="label">Sim week length (minutes)</label><input name="sim_minutes" type="number" step="0.5" min={0.5} defaultValue={l.sim_minutes} className="input" /></div>
          <div><label className="label">FAAB budget {pre ? "" : "(locked)"}</label><input name="faab_budget" type="number" min={0} defaultValue={l.faab_budget} disabled={!pre} className="input" /></div>
          <div><label className="label">Keepers per team {pre ? "" : "(locked)"}</label><input name="keeper_count" type="number" min={0} max={5} defaultValue={l.keeper_count} disabled={!pre} className="input" /></div>
          <div><label className="label">Regular season weeks {pre ? "" : "(locked)"}</label><input name="season_weeks" type="number" min={1} max={24} defaultValue={l.season_weeks} disabled={!pre} className="input" /></div>
        </div>
        <h3 className="pt-2 font-bold">Pack rewards</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Win</label>{sel("reward_win", l.reward_win)}</div>
          <div><label className="label">Loss</label>{sel("reward_loss", l.reward_loss)}</div>
          <div><label className="label">Top score bonus</label>{sel("reward_top", l.reward_top)}</div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_public" defaultChecked={!!l.is_public} className="h-4 w-4" /> Public league</label>
      </SettingsForm>

      <div className="space-y-6">
        <div className="card p-5">
          <h2 className="mb-1 text-lg font-bold">Teams</h2>
          <p className="mb-3 text-sm text-zinc-500">Invite code <span className="font-mono font-bold text-brand">{l.invite_code}</span></p>
          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-lg bg-ink/60 px-3 py-2 text-sm">
                <span>{t.name} {t.is_cpu ? <span className="text-xs text-zinc-400">CPU</span> : null}</span>
                {pre && t.user_id !== l.commissioner_id && <ActionButton action={removeTeam.bind(null, l.id, t.id)} className="text-xs text-red-600" confirm={`Remove ${t.name}?`}>Remove</ActionButton>}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-1 text-lg font-bold">Keepers</h2>
          <p className="mb-3 text-sm text-zinc-500">
            {l.keeper_count === 0 ? "Keepers are off. Set keepers per team above to enable them." : `Each team can keep up to ${l.keeper_count}. A keeper uses that team's pick in the round you choose.`}
          </p>
          {keepers.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm">
              {keepers.map((k) => (
                <li key={k.player_id} className="flex justify-between">
                  <span>{teams.find((t) => t.id === k.team_id)?.name}: <b>{k.name}</b> (Rd {k.round})</span>
                  {pre && <ActionButton action={removeKeeper.bind(null, l.id, k.player_id)} className="text-xs text-red-600">Remove</ActionButton>}
                </li>
              ))}
            </ul>
          )}
          {pre && l.keeper_count > 0 && (
            <KeeperForm teams={teams.map((t) => ({ id: t.id, name: t.name }))} players={players} rounds={ROUNDS} action={setKeeper.bind(null, l.id)} />
          )}
        </div>
      </div>
    </div>
  );
}
