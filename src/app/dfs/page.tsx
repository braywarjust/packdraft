import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, one, run } from "@/lib/db";
import { Contest, ceilings, ensureSolo, maybeSettle, slatePar, todaysRun } from "@/lib/dfs";
import { PACK_BY_ID } from "@/lib/packs";
import { dayLabel, etDate } from "@/lib/nba/espn";
import { ensureSchedule } from "@/lib/nba/sync";
import { startRun } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { CeilingLadder } from "./CeilingLadder";

/** Par of the instant sim slate (same player pool every time), cached so the landing page stays fast. */
function simPar() {
  const k = one<{ value: string }>("SELECT value FROM meta WHERE key = 'dfs_sim_par'");
  if (k) return Number(k.value);
  const par = slatePar({ id: 0, mode: "sim", slate_date: null });
  run("INSERT OR REPLACE INTO meta (key, value) VALUES ('dfs_sim_par', ?)", String(par));
  return par;
}

export default async function DfsPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const u = await requireUser();
  const { err } = await searchParams;
  ensureSolo();
  const today = etDate();
  await ensureSchedule(today, today);
  const games = all<{ start_ts: number; state: string }>("SELECT start_ts, state FROM games WHERE date_et = ?", today);
  const tonightOpen = games.length > 0 && games.every((g) => g.state === "pre" && g.start_ts > Date.now());
  const lock = games.length ? Math.min(...games.map((g) => g.start_ts)) : null;
  for (const c of all<Contest>("SELECT * FROM dfs_contests WHERE status = 'live' AND solo = 1 AND creator_id = ?", u.id)) maybeSettle(c);
  const current = todaysRun(u.id);
  const history = all<Contest>("SELECT * FROM dfs_contests WHERE solo = 1 AND creator_id = ? ORDER BY id DESC LIMIT 20", u.id);
  const par = simPar();

  return (
    <>
      <PageHeader eyebrow="Single player" title="Daily Fantasy"
        description="One run a day. Build an 8-player lineup (G, G, F, F, C, 3 UTIL) under a $50,000 cap. Your players' combined points are Pack Points, and the highest ceiling you reach pays out a pack, or even a Mega Case." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card space-y-4 p-5">
            <h2 className="text-lg font-bold">Today&apos;s run</h2>
            {err === "slate" && <p className="text-sm text-red-600">Tonight&apos;s slate has already tipped off. Try the instant sim slate.</p>}
            {current ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{current.name}</p>
                  <p className="text-sm text-zinc-500">
                    {current.status === "open" ? "Lineup not locked yet" : current.status === "live" ? "● Live" : current.reward_pack ? `Final · won a ${PACK_BY_ID[current.reward_pack]?.name}` : "Final · no ceiling reached"}
                  </p>
                </div>
                <Link href={`/dfs/${current.id}`} className="btn-primary">{current.status === "final" ? "See results" : "Continue"}</Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <form action={startRun.bind(null, "real")}>
                  <button disabled={!tonightOpen} className="card flex h-full w-full flex-col items-start gap-1 p-4 text-left transition hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="font-bold">Tonight&apos;s slate</span>
                    <span className="text-sm text-zinc-500">
                      {tonightOpen && lock ? `${games.length} real NBA games · locks ${new Date(lock).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET` : games.length ? "Already tipped off" : "No NBA games today"}
                    </span>
                  </button>
                </form>
                <form action={startRun.bind(null, "sim")}>
                  <button className="card flex h-full w-full flex-col items-start gap-1 p-4 text-left transition hover:border-brand/60">
                    <span className="font-bold">Instant sim slate</span>
                    <span className="text-sm text-zinc-500">Simulated games, results in about 2 minutes</span>
                  </button>
                </form>
              </div>
            )}
            <p className="text-xs text-zinc-400">You get one run per day, real or simulated. A new one unlocks at midnight ET.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">Your runs</h2>
            {history.length === 0 && <p className="card p-5 text-sm text-zinc-500">No runs yet.</p>}
            {history.length > 0 && (
              <div className="card divide-y divide-line/60">
                {history.map((c) => (
                  <Link key={c.id} href={`/dfs/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-panel2">
                    <span>
                      <span className="font-semibold">{dayLabel(etDate(c.created_at))}</span>
                      <span className="text-zinc-500"> · {c.mode === "sim" ? "Sim slate" : "Real slate"}</span>
                    </span>
                    <span className="text-right">
                      {c.status === "final" ? (
                        <>
                          <span className="font-mono font-bold">{Math.round(c.points ?? 0)} pts</span>
                          <span className={`ml-3 ${c.reward_pack ? "font-semibold text-emerald-600" : "text-zinc-400"}`}>{c.reward_pack ? PACK_BY_ID[c.reward_pack]?.name : "No reward"}</span>
                        </>
                      ) : <span className="text-zinc-500">{c.status === "live" ? "● Live" : "Building lineup"}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="card h-fit p-5">
          <h2 className="mb-1 font-bold">Pack Point ceilings</h2>
          <p className="mb-3 text-xs text-zinc-500">
            Hit a ceiling and you win that reward (only the highest one). These are for the sim slate. Each real slate
            sets its own, scaled to how strong its best possible lineup is.
          </p>
          <CeilingLadder rows={ceilings(par)} />
        </aside>
      </div>
    </>
  );
}
