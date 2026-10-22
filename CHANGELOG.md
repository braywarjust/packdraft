# Changelog

Every PackDraft update is listed here, newest first. Version numbers follow the naming rules in
[docs/WORKFLOW.md](docs/WORKFLOW.md#naming-conventions): `3.1` is an update, `3.1.1` is a fix on top of it.

## Unreleased

- Slab Trades: Pack Points you offer leave your balance as soon as you send the offer, go to the other manager if they accept, and come back if it's declined, cancelled or called off.
- Re-rolls only land on players rostered in your league (the same pool League Packs use), so every slab you can get is a player on a league roster right now.
- Snappier app: tapping a link swaps the page for the animated PackDraft logo right away while the next page loads behind it, tabs light up the moment you tap them, and busy buttons play a small logo instead of "…".
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
