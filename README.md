# PackDraft

Private fantasy football for you and your friends, with a mystery-pack vending machine wired into your leagues.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Friends on the same Wi-Fi can open `http://<your-computer's-IP>:3000` (Next prints the Network URL when it starts). For friends elsewhere, use a tunnel like Tailscale or ngrok, or deploy somewhere with a persistent disk.

For a faster, production-style server: `npm run build && npm start`.

Everything is stored in `data/packdraft.db` (SQLite, built into Node 22.5+). Delete the `data/` folder to wipe everything and start fresh.

## What's in it

- **Accounts**: pick a name (and optional PIN). New accounts start with $1,000 PackBucks and a free Starter Pack. Claim $150 daily.
- **Leagues**: public or private (invite code), 4–8 teams free, 10–12 for $2,500 PackBucks. PPR / half / standard, FAAB or instant free agency, keeper rounds, pick clock, season length, and the pack rewards are all commissioner settings. Empty seats can be filled with CPU teams; a friend who joins later takes over a CPU team.
- **Drafts**: live snake draft room with pick clock, autodraft, queue, keepers auto-slotted into their round. Mock drafts against bots any time.
- **Rosters**: weekly lineups with per-game locks, one-click optimal lineup, matchup grades, add/drop, FAAB blind bids (processed at kickoff and after each week), trades with friends (CPU teams answer instantly).
- **Live scoring**: the commish kicks off a week and games play out live over a few minutes (configurable). Real-time scoreboard, stat lines, game clocks, win probability with a trend line, and a scoring feed.
- **Mystery packs**: six packs from $25 to $5,000 in the vending machine. Rip them open, flip graded, serial-numbered player cards (Common → Grail 1/1), keep them or sell back at 90%. Big pulls get announced in your league chats.
- **Weekly rewards**: every matchup win, loss, the week's top score and the champion earn packs (commish picks which).
- **Chat**: per-league chat with image uploads, GIFs, emoji and a smack talk generator. League events (trades, waivers, results, pulls) post automatically.
- **DFS**: anyone can host a contest. $50k salary cap, 9 slots, optional entry fee, bots to fill it out, live leaderboard. Top 3 win packs.

## Notes

- Player names are a mock 2025-ish pool and all stats are simulated (deterministic per league/week), so nothing depends on a paid sports data feed.
- GIF search needs a free GIPHY key. Put it in `.env.local`:
  ```
  GIPHY_API_KEY=your_key_here
  ```
  Without it you can still paste any GIF link or upload images.
