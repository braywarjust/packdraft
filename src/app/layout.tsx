import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { unopenedPacks } from "@/lib/packs-server";
import { fmtCoins } from "@/lib/packs";
import { logout } from "./actions";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/Sidebar";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PackDraft", template: "%s · PackDraft" },
  description: "Fantasy NBA with your friends, plus mystery packs to rip.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  if (!user) {
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>{children}</body>
      </html>
    );
  }
  const packs = unopenedPacks(user.id).length;
  const leagues = all<{ id: number; name: string; live: number }>(
    `SELECT l.id, l.name, (l.week_started_at IS NOT NULL OR l.draft_status = 'live') live
     FROM leagues l JOIN teams t ON t.league_id = l.id WHERE t.user_id = ? ORDER BY l.id DESC`, user.id);
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Sidebar
          user={{ name: user.name, color: user.color, coins: user.is_tester ? "Unlimited" : fmtCoins(user.coins) }}
          packs={packs}
          leagues={leagues.map((l) => ({ id: l.id, name: l.name, live: !!l.live }))}
          logout={logout}
        />
        <div className="flex min-h-screen flex-col lg:pl-64">
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</main>
          <footer className="border-t border-line bg-zinc-50">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-zinc-500 sm:px-8">
              <Logo height={30} />
              <nav className="flex flex-wrap gap-4">
                <Link href="/leagues" className="hover:text-brand">Leagues</Link>
                <Link href="/packs" className="hover:text-brand">Packs</Link>
                <Link href="/dfs" className="hover:text-brand">Daily Fantasy</Link>
                <Link href="/collection" className="hover:text-brand">Collection</Link>
              </nav>
              <p className="text-xs">Private league site · Live stats via ESPN</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
