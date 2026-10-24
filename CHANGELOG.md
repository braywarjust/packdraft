# Changelog

Every PackDraft update is listed here, newest first. Version numbers follow the naming rules in
[docs/WORKFLOW.md](docs/WORKFLOW.md#naming-conventions): `3.1` is an update, `3.1.1` is a fix on top of it.

## 3.4 — League Settings and League Manager (2026-10-24)

- League Manager: whoever creates a league is its League Manager (LM), shown with an LM tag under Teams. The LM can change every league setting and can hand the job to another manager with "Make LM". "Commish" is now "League Manager" everywhere.
- One Settings tab for everyone: every manager can read the league's settings, and only the LM can change them. Sections follow ESPN: Basic, Draft, Scoring, Acquisitions and waivers, Trades, Season and playoffs, Pack rewards.
- Custom scoring: set points for PTS, 3PM, 3PA, FGM, FGA, FTM, FTA, REB, AST, STL, BLK, TO, double-doubles and triple-doubles, or start from ESPN Points or DraftKings Style. League chat says when the scoring changes. With custom points, Pack Points are still paid on ESPN points.
- Acquisition limits: a cap on adds per matchup and per season (free agent adds and waiver claims count, trades don't). Players shows how many you've used.
- Trade limit: a cap on trades per team per season, shown on Trades. The LM review period and trade deadline moved into the same Trades section.
- Playoff teams can be set before the draft.

## 3.3 — My Team fits your phone (2026-10-22)

- Lineup swaps stick: tap a player's slot, then a green slot to swap him there. Tapping a bench player's slot swaps him in for the starter you picked. A manual swap turns Auto Manager off, so it no longer undoes your move.
- No more jumping: picking a player keeps the page still, and Bench, Drop and Slab sit on one slim line above the table.
- Auto Manager is one slim switch at the top of the My Team card on phone and computer.
- My Team on iPhone shows Opp, game time, PTS, REB, AST and fantasy points, all on screen with no sideways scrolling.
- Matchup drops the live scoring feed, so both box scores use the full width and show every stat on bigger screens.

## 3.2.1 — Pull to refresh (2026-10-22)

- Pull to refresh on iPhone: in the home-screen app, pull down from the top of any page to reload it. The PackDraft logo turns as you pull and plays while the page reloads.
- You keep your place: tapping a filter (week buttons on Matchups, positions and views on Players, rarity and sort on Collection, pack pool tiers) no longer jumps you back to the top of the page.

## 3.2 — Snappy app and fair trades (2026-10-22)

- Slab Trades: Pack Points you offer leave your balance as soon as you send the offer, go to the other manager if they accept, and come back if it's declined, cancelled or called off.
- Re-rolls only land on players rostered in your league (the same pool League Packs use), so every slab you can get is a player on a league roster right now.
- Snappier app: tapping a link shows the animated PackDraft logo right away while the next page loads behind it, and only where things change: the whole page for a nav bar switch, the area under the league header and tabs for a league tab, and just the results for a filter like the week picker (it always plays for 0.7s so it looks the same everywhere), tabs light up the moment you tap them, and busy buttons play a small logo instead of "…".
- Upcoming weeks on Matchups open right away: the app keeps the rest of the season's NBA schedule loaded in the background instead of fetching it from ESPN, one day at a time, the first time someone opens that week.
- Bigger tap targets on phones: buttons, tabs, the slot pills on My Team, close buttons and player names are easier to hit.
- Repo cleanup: removed unused components, old pack and slab-back images, Next.js starter files and the Blender art scripts.
- Project organisation: changelog, naming conventions, pull request template, `DEPLOY.md` moved to `docs/`.

## 3.1 — League hub (2026-10-22)

- Recent activity on League home: adds, drops, waiver claims, trades and vetoes, filterable by team.
- Full standings expand in place: GB, PA, streak, moves, playoff odds, clinch tags and season team stats.
- Matchup cards show each team's top 3 scorers.
- Commish trade review (veto or approve) and a trade deadline setting. Trade review starts off; the commish turns it on in settings.
- Player News from ESPN in the player card and as a News view on Players.

## 3.0 — Slab Trades (2026-10-21)

- Slab Trades: swap slabs with friends, add Pack Points to either side, or gift one. Offers can be accepted, declined or
  cancelled, and are voided if a slab moves.
- Slabs no longer show a Pack Points value anywhere; Net worth ranks by Pack Points.
- My Team cleanup: box score only (court view removed), no Quick lineup button or matchup boxes, smaller team banner.
- Test accounts are hidden from Collection tabs.

## 2.2 — Auto Manager (2026-10-21)

- Auto Manager toggle on My Team starts the best players with a game today and benches the rest.
- Trade-ups removed from the Collection; slabs already traded up stay as they are.
- League Packs shows an animated pack pool banner instead of a row of slabs.

## 2.1 — League Packs (2026-10-21)

- League Packs: each league has its own pack shop and pack pool.
- Stat boost slabs, iPhone-sized pack rips and reveals, pack repricing.
- Team and league logos accept any photo; plain backgrounds are knocked out.
- iPhone layout: bottom tab bar, home-screen app mode, ESPN-style roster and matchup pages.

## 2.0 and earlier

The original app: accounts, leagues, live drafts, live scoring, slabs and rarities, the Pack Shop, chat, Sportsbook,
Casino and the deploy kit. No version tags before 2.1.
