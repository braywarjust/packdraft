import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { unopenedPacks } from "@/lib/packs-server";
import { leaguePool } from "@/lib/slab-cards";
import { ensureBranding, leagueBrand } from "@/lib/branding";
import type { League } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { TeamBadge } from "@/components/TeamBadge";
import { Coins } from "@/components/Coins";

export const metadata = { title: "League Packs" };

/**
 * Packs live inside leagues now (League Packs). This page sends you to your league's pack shop, or lets you pick one
 * when you're in more than one.
 */
export default async function PacksHub() {
  const u = await requireUser();
  ensureBranding();
  const leagues = all<League>(
    "SELECT l.* FROM leagues l JOIN teams t ON t.league_id = l.id WHERE t.user_id = ? ORDER BY l.champion_team_id IS NOT NULL, l.id DESC", u.id);
  const active = leagues.filter((l) => !l.champion_team_id);
  if (active.length === 1) redirect(`/league/${active[0].id}/packs`);
  const packs = unopenedPacks(u.id);
  const anywhere = packs.filter((p) => p.league_id == null).length;

  return (
    <div className="space-y-5">
      <PageHeader icon="packs" eyebrow="League Packs" title="Pick a league"
        description="Packs live inside your leagues now. Each league's packs only drop players on that league's rosters, so pick where you want to rip.">
        <span className="rounded-full bg-panel2 px-3 py-1.5 text-sm font-bold text-emerald-600"><Coins n={u.coins} live /></span>
      </PageHeader>
      {anywhere > 0 && (
        <p className="card border-l-4 border-l-amber-400 p-4 text-sm">You have <b>{anywhere}</b> pack{anywhere > 1 ? "s" : ""} from before League Packs. {anywhere > 1 ? "They open" : "It opens"} in whichever league you rip {anywhere > 1 ? "them" : "it"} in.</p>
      )}
      {leagues.length === 0 ? (
        <div className="card p-8 text-center text-sm text-zinc-500">Join or create a league to get League Packs. <Link href="/leagues" className="text-brand underline">Find a league</Link></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((l) => {
            const b = leagueBrand(l);
            const here = packs.filter((p) => p.league_id === l.id).length;
            const pool = leaguePool(l.id).length;
            return (
              <Link key={l.id} href={`/league/${l.id}/packs`} className="card overflow-hidden transition hover:-translate-y-0.5 hover:brightness-110">
                <div className="flex items-center gap-3 p-4" style={{ background: `linear-gradient(115deg, ${b.color} 0%, ${b.color} 55%, ${b.alt} 140%)` }}>
                  <TeamBadge brand={b} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-white">{l.name}</p>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">{l.champion_team_id ? "Offseason" : "League Pack Shop"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-line/60 text-center">
                  <div className="bg-panel px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Unopened</p><p className="font-mono font-black">{here}</p></div>
                  <div className="bg-panel px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pool</p><p className="font-mono font-black">{pool ? `${pool} players` : "After draft"}</p></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
