import { ConfirmHost } from "@/components/Confirm";
import { NoTooltips } from "@/components/NoTooltips";
import { PlayerInspectorHost } from "@/components/PlayerInspector";
import { ensureBranding, leagueBrand } from "@/lib/branding";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { logout } from "./actions";
import { Logo } from "@/components/Logo";
import { Sidebar } from "@/components/Sidebar";
import { Wallet } from "@/components/Currencies";
import { NavShell } from "@/components/NavShell";
import { PullToRefresh } from "@/components/PullToRefresh";
import { avatarOf } from "@/lib/profile";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PackDraft", template: "%s · PackDraft" },
  description: "Fantasy NBA with your friends. Earn Fantasy Coins, spend them in the League Shop and the Sportsbook.",
  // "Add to Home Screen" on iPhone opens PackDraft full screen like an app, with the icon from app/apple-icon.tsx.
  appleWebApp: { capable: true, title: "PackDraft", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Older iPhones only go full screen with Apple's original tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1b2130",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  if (!user) {
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>{children}<ConfirmHost /><NoTooltips /></body>
      </html>
    );
  }
  ensureBranding();
  const leagues = all<{ id: number; name: string; live: number; color: string | null; alt_color: string | null; abbr: string | null; logo_url: string | null }>(
    `SELECT l.id, l.name, l.color, l.alt_color, l.abbr, l.logo_url, (l.week_started_at IS NOT NULL OR l.draft_status = 'live') live
     FROM leagues l JOIN teams t ON t.league_id = l.id WHERE t.user_id = ? ORDER BY l.id DESC`, user.id);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved sidebar width before first paint so the page doesn't jump. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("pd-sidebar")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ConfirmHost />
        <NoTooltips />
        <PlayerInspectorHost />
        <PullToRefresh />
        <Sidebar
          user={{ name: user.name, color: user.color, coins: user.coins, tester: !!user.is_tester, avatar: avatarOf(user.id) }}
          leagues={leagues.map((l) => ({ id: l.id, name: l.name, live: !!l.live, brand: leagueBrand(l) }))}
          logout={logout}
        />
        <div className="tabbar-pad flex min-h-screen flex-col transition-[padding] duration-200 lg:pl-[var(--sb)]">
          {/* Fantasy Coins on every page (desktop; the mobile top bar shows them too). */}
          <div className="pointer-events-none sticky top-0 z-30 hidden lg:block">
            <div className="mx-auto flex max-w-6xl justify-end px-8 pt-4 pr-20 2xl:pr-8">
              <Wallet coins={user.coins} />
            </div>
          </div>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-8 sm:py-8 lg:pt-2"><NavShell>{children}</NavShell></main>
          <footer className="hidden border-t border-line bg-zinc-50 lg:block">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-zinc-500 sm:px-8">
              <Logo height={30} />
              <nav className="flex flex-wrap gap-4">
                <Link href="/leagues" className="hover:text-brand">Leagues</Link>
                <Link href="/bets" className="hover:text-brand">Sportsbook</Link>
              </nav>
              <p className="text-xs">Private league site · Live stats via ESPN</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
