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

- **Accounts**: pick a name (and optional PIN). New accounts start with $1,000 Pack Points and a free Starter Pack. Claim $150 daily.
- **Real NBA data**: rosters, headshots, injuries, schedules and live box scores come from ESPN's free public endpoints (no key). The app refreshes rosters twice a day and live scores every ~30 seconds while it's running. Projections are last season's averages, blended toward this season as games are played.
- **Leagues**: public or private (invite code), 4–8 teams free, 10–12 for $2,500 Pack Points. ESPN-style or DraftKings-style points, FAAB or instant free agency, keepers, pick clock, season length and pack rewards are commissioner settings. Empty seats can be filled with CPU teams; a friend who joins later takes over a CPU team.
- **Real vs simulated**: real leagues follow the NBA calendar (week 1 starts the day after the draft, then Monday–Sunday weeks; only regular-season and playoff games count). Simulated leagues are for testing or the offseason: the commish tips off each week and every team plays 3–4 sim games.
- **Drafts**: live snake draft room with pick clock, autodraft, queue, keepers auto-slotted into their round. Mock drafts against bots any time.
- **Rosters**: G, G, F, F, C, 3 UTIL + 5 bench. Daily lineups: each player locks at his own tip-off, and points count for the slot he was in when his game started. Add/drop, nightly FAAB waivers, trades (CPU teams answer instantly).
- **Live scoring**: real-time matchup page with box-score lines, games played/left this week, win probability with a trend line, and a scoring feed.
- **Mystery packs**: six packs from $25 to $2,500, plus the 5-slab Mega Pack. Every pack holds Slabs: tarot-style cards of NBA starters (the top 5 per team by projection) with the player's photo, team logo and team colours. Sell any slab back for 90% of its value. Big pulls get announced in your league chats. Browse every slab at `/packs/pool`.
- **Slab multipliers**: every slab rolls its own exact multiplier inside its tier's range (Common 1.10-1.99X, Rare 2.00-2.99X, Epic 3.00-4.49X, Mythic 4.50-7.49X, Grail 7.50-10X), leaning toward the low end, so the same player comes in many versions worth chasing. The bigger the tier the more the draw leans toward role players. Generic slabs work on anyone but only 1.01-1.50X. Any slab can drop **Immortal**: it glows, gets vibrant colours and is worth 5x as much (same multiplier). Packs return about 90% of their price on average.
- **Slab boosts**: each night, every player on your fantasy team with a game can carry one of your slabs (his own player slab, or a generic). His fantasy points for that game, and the Pack Points they pay, are multiplied. Each slab works once a night across all your leagues. Graded slabs from before the redesign stay in your collection and can still be sold, but no longer boost.
- **Weekly rewards**: every matchup win, loss, the week's top score and the champion earn packs.
- **Chat**: per-league chat with image uploads, GIFs, emoji and a smack talk generator.
- **DFS**: host a contest on any upcoming night of real NBA games ($50k cap, G/G/F/F/C/3 UTIL). It locks at the first tip-off and settles when every game is final. Simulated slates are available too.

## Notes

- ESPN's endpoints are unofficial. If ESPN changes them, live data stops until the code is updated; simulated mode keeps working.
- Live scoring only advances while the app is running on your computer. If it was off during games, it catches up on box scores the next time it starts.
- PSA's website, 130point and SportsCardsPro block automated lookups, and PSA's free API has no prices, so eBay's free API is the market source. eBay values are current asking prices, not sold prices.
- GIF search needs a free GIPHY key. Put it in `.env.local`:
  ```
  GIPHY_API_KEY=your_key_here
  ```
  Without it you can still paste any GIF link or upload images.
