import { ensureBranding, leagueBrand } from "@/lib/branding";
import { BrandEditor } from "@/components/BrandEditor";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getLeague, leagueTeams, ROUNDS } from "@/lib/league";
import { PACKS } from "@/lib/packs";
import { scoringLabel } from "@/lib/scoring";
import { ActionButton } from "@/components/ActionButton";
import { SettingsForm, KeeperForm, ScoringEditor } from "./forms";
import { removeKeeper, removeTeam, setKeeper, transferManager, updateLeagueBrandAction, updateSettings } from "../../../actions";

/** League Settings, ESPN style: every manager can read them; only the League Manager can change them. */
export default async function Settings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  const lm = l.commissioner_id === u.id;
  const teams = leagueTeams(l.id);
  const pre = l.draft_status === "pre";
  const keepers = all<{ player_id: number; round: number; team_id: number; name: string; pos: string }>(
    "SELECT k.*, p.name, p.pos FROM keepers k JOIN players p ON p.id = k.player_id WHERE k.league_id = ? ORDER BY k.team_id, k.round", l.id);
  const players = lm ? all<{ id: number; name: string; pos: string }>("SELECT id, name, pos FROM players ORDER BY adp") : [];
  const owners = new Map(all<{ id: number; name: string }>(
    "SELECT u.id, u.name FROM users u JOIN teams t ON t.user_id = u.id WHERE t.league_id = ?", l.id).map((o) => [o.id, o.name]));
  const sel = (name: string, value: string) => (
    <select name={name} defaultValue={value} className="input">
      {PACKS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.price.toLocaleString()} Pack Points)</option>)}
    </select>
  );
  const lock = (s: string) => (pre || !lm ? s : `${s} (locked)`);
  const limitSel = (name: string, value: number | null | undefined, max: number, unit: string) => (
    <select name={name} defaultValue={value == null ? "none" : String(value)} className="input">
      <option value="none">No limit</option>
      {Array.from({ length: max + 1 }, (_, i) => <option key={i} value={i}>{i} {unit}{i === 1 ? "" : "s"}</option>)}
    </select>
  );

  ensureBranding();
  const lb = leagueBrand(getLeague(l.id)!);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-1 p-5 lg:col-span-2">
        <h2 className="text-lg font-bold">League Settings</h2>
        <p className="text-sm text-zinc-500">
          League Manager: <b className="text-zinc-900">{owners.get(l.commissioner_id) ?? "nobody"}</b>.{" "}
          {lm ? "You run this league: you can change every setting below and hand the job to someone else under Teams." : "Only the League Manager can change these."}
        </p>
      </section>
      {lm && (
        <section className="card space-y-3 p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">League branding</h2>
          <p className="text-sm text-zinc-500">Name, colours and logo for the whole league.</p>
          <BrandEditor label="League" subtitle={`${teams.length} teams`}
            initial={{ name: l.name, abbr: lb.abbr, color: lb.color, alt_color: lb.alt, logo_url: lb.logo }}
            onSave={updateLeagueBrandAction.bind(null, l.id)} />
        </section>
      )}
      <SettingsForm action={updateSettings.bind(null, l.id)} readOnly={!lm}>
        <h3 className="font-bold">Basic</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{lock("Games")}</label>
            <select name="mode" defaultValue={l.mode} disabled={!pre} className="input"><option value="real">Real NBA</option><option value="sim">Simulated</option></select></div>
          <div><label className="label">Sim week length (minutes)</label><input name="sim_minutes" type="number" step="0.5" min={0.5} defaultValue={l.sim_minutes} className="input" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_public" defaultChecked={!!l.is_public} className="h-4 w-4" /> Public league</label>

        <h3 className="pt-2 font-bold">Draft</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Pick clock (seconds)</label><input name="pick_seconds" type="number" min={10} defaultValue={l.pick_seconds} className="input" /></div>
          <div><label className="label">{lock("Keepers per team")}</label><input name="keeper_count" type="number" min={0} max={5} defaultValue={l.keeper_count} disabled={!pre} className="input" /></div>
        </div>

        <h3 className="pt-2 font-bold">Scoring <span className="text-sm font-normal text-zinc-500">· {scoringLabel(l.scoring)}</span></h3>
        <ScoringEditor scoring={l.scoring} />

        <h3 className="pt-2 font-bold">Acquisitions and waivers</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Waivers</label>
            <select name="waiver_type" defaultValue={l.waiver_type} className="input"><option value="faab">FAAB bidding</option><option value="free">Free agency</option></select></div>
          <div><label className="label">{lock("FAAB budget")}</label><input name="faab_budget" type="number" min={0} defaultValue={l.faab_budget} disabled={!pre} className="input" /></div>
          <div><label className="label">Acquisitions per matchup</label>{limitSel("acq_per_week", l.acq_per_week, 20, "add")}</div>
          <div><label className="label">Acquisitions per season</label>{limitSel("acq_per_season", l.acq_per_season, 99, "add")}</div>
        </div>
        <p className="text-xs text-zinc-500">Free agent adds and waiver claims count; trades don&apos;t.</p>

        <h3 className="pt-2 font-bold">Trades</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Trade limit per team</label>{limitSel("trade_limit", l.trade_limit, 30, "trade")}</div>
          <div><label className="label">LM review period</label>
            <select name="trade_review_hours" defaultValue={String(l.trade_review_hours ?? 0)} className="input">
              <option value="0">None (trades go through at once)</option><option value="12">12 hours</option><option value="24">1 day</option><option value="48">2 days</option>
            </select></div>
          <div className="col-span-2"><label className="label">Trade deadline</label>
            <select name="trade_deadline_week" defaultValue={String(l.trade_deadline_week ?? "")} className="input">
              <option value="">No deadline</option>
              {Array.from({ length: l.season_weeks }, (_, i) => <option key={i} value={i + 1}>End of Week {i + 1}</option>)}
            </select></div>
        </div>

        <h3 className="pt-2 font-bold">Season and playoffs</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">{lock("Regular season weeks")}</label><input name="season_weeks" type="number" min={1} max={24} defaultValue={l.season_weeks} disabled={!pre} className="input" /></div>
          <div><label className="label">{lock("Playoff teams")}</label>
            <select name="playoff_teams" defaultValue={String(l.playoff_teams ?? 4)} disabled={!pre} className="input">
              {[2, 4, 6, 8].filter((n) => n <= l.max_teams).map((n) => <option key={n} value={n}>{n} teams</option>)}
            </select></div>
        </div>

        <h3 className="pt-2 font-bold">Pack rewards</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Win</label>{sel("reward_win", l.reward_win)}</div>
          <div><label className="label">Loss</label>{sel("reward_loss", l.reward_loss)}</div>
          <div><label className="label">Top score bonus</label>{sel("reward_top", l.reward_top)}</div>
        </div>
      </SettingsForm>

      <div className="space-y-6">
        <div className="card p-5">
          <h2 className="mb-1 text-lg font-bold">Teams</h2>
          <p className="mb-3 text-sm text-zinc-500">Invite code <span className="font-mono font-bold text-brand">{l.invite_code}</span></p>
          <ul className="space-y-2">
            {teams.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/60 px-3 py-2 text-sm">
                <span>
                  {t.name}{" "}
                  {t.is_cpu ? <span className="text-xs text-zinc-400">CPU</span> : <span className="text-xs text-zinc-400">{owners.get(t.user_id!)}</span>}
                  {t.user_id === l.commissioner_id && <span className="ml-1 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand">LM</span>}
                </span>
                {lm && (
                  <span className="flex gap-3">
                    {!t.is_cpu && t.user_id && t.user_id !== l.commissioner_id && (
                      <ActionButton action={transferManager.bind(null, l.id, t.user_id)} className="text-xs font-semibold text-brand"
                        confirm={`Make ${owners.get(t.user_id)} the League Manager? You'll lose access to League Manager settings.`}>Make LM</ActionButton>
                    )}
                    {pre && t.user_id !== l.commissioner_id && <ActionButton action={removeTeam.bind(null, l.id, t.id)} className="text-xs text-red-600" confirm={`Remove ${t.name}?`}>Remove</ActionButton>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-1 text-lg font-bold">Keepers</h2>
          <p className="mb-3 text-sm text-zinc-500">
            {l.keeper_count === 0 ? `Keepers are off.${lm ? " Set keepers per team to enable them." : ""}` : `Each team can keep up to ${l.keeper_count}. A keeper uses that team's pick in the round chosen.`}
          </p>
          {keepers.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm">
              {keepers.map((k) => (
                <li key={k.player_id} className="flex justify-between">
                  <span>{teams.find((t) => t.id === k.team_id)?.name}: <b>{k.name}</b> (Rd {k.round})</span>
                  {lm && pre && <ActionButton action={removeKeeper.bind(null, l.id, k.player_id)} className="text-xs text-red-600">Remove</ActionButton>}
                </li>
              ))}
            </ul>
          )}
          {lm && pre && l.keeper_count > 0 && (
            <KeeperForm teams={teams.map((t) => ({ id: t.id, name: t.name }))} players={players} rounds={ROUNDS} action={setKeeper.bind(null, l.id)} />
          )}
        </div>
      </div>
    </div>
  );
}
