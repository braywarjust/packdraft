import { requireUser } from "@/lib/auth";
import { favoritePresetId, userPresets } from "@/lib/branding";
import { PageHeader } from "@/components/PageHeader";
import { TeamStudio } from "./TeamStudio";

export const metadata = { title: "Team Studio" };

export default async function TeamsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const u = await requireUser();
  const { welcome } = await searchParams;
  const presets = userPresets(u.id);
  return (
    <>
      <PageHeader icon="studio" eyebrow={welcome ? `Welcome to PackDraft, ${u.name}` : "Your teams"} title="Team Studio"
        description="Make your team look once, then use it in any league." />
      {welcome && presets.length === 0 && (
        <p className="card mb-6 border-l-4 border-l-brand p-4 text-sm text-zinc-700">
          First things first: build your team. Give it a name and colours, and upload a logo or photo if you have one. You can make more later.
        </p>
      )}
      <TeamStudio presets={presets.map((p) => ({ id: p.id, name: p.name, abbr: p.abbr, color: p.color, alt_color: p.alt_color, logo_url: p.logo_url }))} startNew={presets.length === 0} favorite={favoritePresetId(u.id)} />
    </>
  );
}
