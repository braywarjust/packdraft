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
- **Mystery packs**: six packs from $25 to $2,500. Every card is a real graded slab from your photo folder (`SLABS_DIR`, default `~/NBA_Slabs_webp`, ~9,800 PSA/BGS/SGC slabs). Each slab is unique: once pulled it leaves the vault, and selling it back (90%) returns it. Big pulls get announced in your league chats.
- **Rarity system**: each slab is scored on grade (Black Label/Pristine 10 highest), player (GOAT, legend, current star, active), autograph, memorabilia, iconic inserts, premium sets, numbered/parallel, rookie and era. Tiers are percentiles of that score: Common 55%, Rare 27%, Epic 12%, Legendary 4.5%, Grail 1.5%. Details are on the Pack Shop page.
- **Market values**: when a slab is pulled the app looks up its value on eBay, first by cert number (that exact slab listed), then by the same card in the same grade (trimmed median of current listings). Without eBay keys it uses an estimate from the rarity score (shown with *). PSA population counts show up if you add a PSA API token. See `.env.local.example`.
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
