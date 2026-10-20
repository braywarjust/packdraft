# Making updates to PackDraft with Claude

The short version: **ask Claude in the PackDraft project, Claude builds and tests it on your Mac, Claude pushes to
GitHub, and the live site updates by itself about 2 minutes later.** You never have to touch the server.

## How a change gets to the live site

```
You ask Claude  →  Claude edits code on your Mac  →  tests it on localhost  →  commits + pushes to GitHub (main)
                                                                                  ↓
            live site restarted with the new code  ←  server backs up the database  ←  GitHub builds the app
```

- Code lives in GitHub (`braywarjust/packdraft`). The **live database lives only on the server** and is never
  overwritten by a deploy. Every deploy saves a backup of it first (the last 14 are kept).
- A deploy restarts the app for about 10 seconds. Live scores, packs and Pack Points are unaffected; avoid pushing in
  the middle of a live draft.
- Watch a deploy: github.com/braywarjust/packdraft → **Actions** tab (green check = live).

## The workflow

### Small changes (text, colours, a button, a bug)
1. Ask in the project, one thread per change: "On the Collection page, make X do Y." Screenshots help a lot.
2. Claude makes it, checks it in the browser on localhost, and tells you what changed.
3. Say "push it live" (or say it up front: "...and push it live when it works"). Done in ~2 minutes.

### Big features (new game mode, trading revamp, playoffs, etc.)
1. **Start a new thread for the feature** and describe the goal, not just the UI: who uses it, how it earns or
   spends Pack Points, what should happen in edge cases. Ask Claude for a **plan first** for anything big.
2. **Test on real data**: Claude runs `bash deploy/pull-data.sh` so localhost has a copy of the live league, then
   builds against it. Nothing done on localhost touches the live site.
3. Claude works on a **feature branch** (`feature/<name>`) so half-done work never goes live. You can look at it on
   localhost and ask for changes as many times as you like.
4. When you're happy, say "ship it": Claude runs a full production build, merges the branch into `main` and pushes.
   GitHub deploys it.
5. Check the live site once. If anything's off, tell Claude; it can fix forward or roll back.

### Database changes
New features often need new tables or columns. Claude adds them as **migrations in `src/lib/db.ts`** (the
`ALTER TABLE ... ADD COLUMN` pattern), which run automatically when the new code starts on the server. Existing
accounts, leagues and Pack Points are never wiped by a deploy. One-off data fixes on the live site ("give everyone
500 Pack Points", "fix this roster") are done by Claude directly on the server's database, after a backup.

## If something goes wrong

- **Bad deploy:** ask Claude to "roll back the last update". It reverts the commit and pushes; the old version is
  live again in ~2 minutes.
- **Bad data:** ask Claude to restore the live database from the backup taken before the last deploy
  (`/opt/packdraft/data.nosync/backups`).
- **Site down:** ask Claude to check the server logs (`journalctl -u packdraft`). It restarts on its own after a crash.

## Tips for asking

- One feature per thread keeps things clear and lets several features move at once.
- Say what "done" looks like ("works on my phone", "shows in league chat", "costs 50 Pack Points").
- Mention anything that must not change (odds, the Pack Points rate, existing slabs).
- For anything that changes money-like balances, ask Claude to test it on the local copy first and show you.
