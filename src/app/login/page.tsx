import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { login } from "../actions";
import { Logo } from "@/components/Logo";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const users = all<{ name: string; color: string; pin_hash: string | null }>("SELECT name, color, pin_hash FROM users ORDER BY name");
  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-8 md:grid-cols-2">
      <div className="flex flex-col justify-center">
        <Logo height={110} className="mb-4 -ml-1" />
        <h1 className="sr-only">PackDraft</h1>
        <p className="mt-3 text-zinc-700">Fantasy NBA for the group chat, powered by real live stats. Draft, trash talk, win your matchup, and rip mystery packs from the vending machine.</p>
        <ul className="mt-6 space-y-2 text-sm text-zinc-500">
          <li>🏀 Live drafts, keepers, FAAB waivers and trades</li>
          <li>📈 Live scoring with win probability</li>
          <li>🎰 Weekly wins earn mystery packs to rip</li>
          <li>💬 League chat with GIFs and smack talk</li>
        </ul>
      </div>
      <div className="card p-6">
        <h2 className="text-lg font-bold">Jump in</h2>
        <p className="mb-4 text-sm text-zinc-500">New name = new account. Add a PIN so your friends can&apos;t log in as you.</p>
        <ActionForm action={login} submit="Let's go">
          <div>
            <label className="label">Name</label>
            <input name="name" className="input" placeholder="e.g. Brayden" list="names" required autoFocus />
            <datalist id="names">{users.map((u) => <option key={u.name} value={u.name} />)}</datalist>
          </div>
          <div>
            <label className="label">PIN (optional)</label>
            <input name="pin" className="input" placeholder="4 digits" inputMode="numeric" maxLength={8} type="password" />
          </div>
        </ActionForm>
        {users.length > 0 && (
          <div className="mt-6">
            <p className="label">Who&apos;s here</p>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <span key={u.name} className="flex items-center gap-1.5 rounded-full bg-panel2 px-2.5 py-1 text-xs">
                  <span className="h-3 w-3 rounded-full" style={{ background: u.color }} />{u.name}{u.pin_hash ? " 🔒" : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
