# PackDraft

Private fantasy NBA for you and your friends, running on real live NBA stats, with a mystery-pack vending machine wired into your leagues.

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

- **Accounts**: pick a name (and optional PIN). New accounts start with $1,000 PackBucks and a free Starter Pack. Claim $150 daily.
- **Real NBA data**: rosters, headshots, injuries, schedules and live box scores come from ESPN's free public endpoints (no key). The app refreshes rosters twice a day and live scores every ~30 seconds while it's running. Projections are last season's averages, blended toward this season as games are played.
- **Leagues**: public or private (invite code), 4–8 teams free, 10–12 for $2,500 PackBucks. ESPN-style or DraftKings-style points, FAAB or instant free agency, keepers, pick clock, season length and pack rewards are commissioner settings. Empty seats can be filled with CPU teams; a friend who joins later takes over a CPU team.
- **Real vs simulated**: real leagues follow the NBA calendar (week 1 starts the day after the draft, then Monday–Sunday weeks; only regular-season and playoff games count). Simulated leagues are for testing or the offseason: the commish tips off each week and every team plays 3–4 sim games.
- **Drafts**: live snake draft room with pick clock, autodraft, queue, keepers auto-slotted into their round. Mock drafts against bots any time.
- **Rosters**: G, G, F, F, C, 3 UTIL + 5 bench. Daily lineups: each player locks at his own tip-off, and points count for the slot he was in when his game started. Add/drop, nightly FAAB waivers, trades (CPU teams answer instantly).
- **Live scoring**: real-time matchup page with box-score lines, games played/left this week, win probability with a trend line, and a scoring feed.
- **Mystery packs**: six packs from $25 to $5,000. Cards are graded slabs with the player's photo and team colors, Common → Grail 1/1. Keep them or sell back at 90%. Big pulls get announced in your league chats.
- **Weekly rewards**: every matchup win, loss, the week's top score and the champion earn packs.
- **Chat**: per-league chat with image uploads, GIFs, emoji and a smack talk generator.
- **DFS**: host a contest on any upcoming night of real NBA games ($50k cap, G/G/F/F/C/3 UTIL). It locks at the first tip-off and settles when every game is final. Simulated slates are available too.

## Notes

- ESPN's endpoints are unofficial. If ESPN changes them, live data stops until the code is updated; simulated mode keeps working.
- Live scoring only advances while the app is running on your computer. If it was off during games, it catches up on box scores the next time it starts.
- Player card values are made up (no free real-world card pricing source).
- GIF search needs a free GIPHY key. Put it in `.env.local`:
  ```
  GIPHY_API_KEY=your_key_here
  ```
  Without it you can still paste any GIF link or upload images.
