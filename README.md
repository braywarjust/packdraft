# PackDraft

Private fantasy NBA for you and your friends, running on real live NBA stats. Every fantasy point pays Fantasy Coins, which buy extra adds and trades in each league's shop.

**Current version: 3.1 (League hub).** See [CHANGELOG.md](CHANGELOG.md) for every update.

## Run it

Double-click **Start PackDraft.command** in this folder, or:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Friends on the same Wi-Fi can open `http://<your-computer's-IP>:3000` (Next prints the Network URL when it starts). For friends elsewhere, use a tunnel like Tailscale or ngrok, or deploy somewhere with a persistent disk.

For a faster, production-style server: `npm run build && npm start`.

Everything is stored in `data/packdraft-nba.db` (SQLite, built into Node 22.5+). Delete the `data/` folder to wipe everything and start fresh.

## What's in it

- **Accounts**: pick a name (and optional PIN). New accounts start with 1,000 Fantasy Coins. Claim 150 daily.
- **Real NBA data**: rosters, headshots, injuries, schedules and live box scores come from ESPN's free public endpoints (no key). The app refreshes rosters twice a day and live scores every ~30 seconds while it's running. Projections are last season's averages, blended toward this season as games are played.
- **Leagues**: public or private (invite code), 4–8 teams free, 10–12 for 2,500 Fantasy Coins. ESPN-style or DraftKings-style points, FAAB or instant free agency, keepers, pick clock, season length, free adds and trades, and League Shop prices are League Manager settings. Empty seats can be filled with CPU teams; a friend who joins later takes over a CPU team.
- **Real vs simulated**: real leagues follow the NBA calendar (week 1 starts the day after the draft, then Monday–Sunday weeks; only regular-season and playoff games count). Simulated leagues are for testing or the offseason: the commish tips off each week and every team plays 3–4 sim games.
- **Drafts**: live snake draft room with pick clock, autodraft, queue, keepers auto-slotted into their round. Mock drafts against bots any time.
- **Rosters**: G, G, F, F, C, 3 UTIL + 5 bench. Daily lineups: each player locks at his own tip-off, and points count for the slot he was in when his game started. Add/drop, nightly FAAB waivers, trades (CPU teams answer instantly).
- **Live scoring**: real-time matchup page with box-score lines, games played/left this week, win probability with a trend line, and a scoring feed.
- **Fantasy Coins**: every fantasy point a starter scores pays 0.5 Fantasy Coins when his game goes final. Coins work everywhere: the League Shop in each league and the Sportsbook.
- **League Shop**: each league's Shop tab sells **Acquisitions** (one add past your free adds) and **Trades** (one trade past your free trades) for Fantasy Coins, at prices the League Manager sets (3,000 and 5,000 by default, about two and three weeks of saving). The free adds per matchup/season and free trades per season are the league's limits in Settings; past them, adds and trades use up your Acquisitions and Trades automatically. Your coins, Acquisitions and Trades show at the top right of every page.
- **League hub**: recent activity (adds, drops, waivers, trades), full standings with playoff odds and clinch tags, top scorers on matchup cards, ESPN player news, and optional commish trade review with a trade deadline.
- **Auto Manager**: one toggle on My Team starts the best players with a game today and benches the rest.
- **Chat**: per-league chat with image uploads, GIFs, emoji and a smack talk generator.
- **Sportsbook**: bet Fantasy Coins on real NBA games.

## Project layout

```
src/app/         pages and API routes (Next.js App Router)
src/components/  shared UI (lineups, standings, shop items, ...)
src/lib/         game logic: leagues, scoring, League Shop, economy, database (db.ts)
src/lib/nba/     ESPN data sync, season calendar
public/          logos and icons
deploy/          server setup, deploy and data copy scripts
docs/            DEPLOY.md (putting it online), WORKFLOW.md (shipping updates, naming conventions)
```

## Notes

- ESPN's endpoints are unofficial. If ESPN changes them, live data stops until the code is updated; simulated mode keeps working.
- Live scoring only advances while the app is running on your computer. If it was off during games, it catches up on box scores the next time it starts.
- GIF search needs a free GIPHY key. Put it in `.env.local`:
  ```
  GIPHY_API_KEY=your_key_here
  ```
  Without it you can still paste any GIF link or upload images.
