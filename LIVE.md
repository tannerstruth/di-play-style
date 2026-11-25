# Live scoreboard (`live.html`)

A live NCAA D-I men's scoreboard that shows, for every game: status, TV, score, live spread and total,
each team's 3-point shooting (3PM-3PA, 3P%, 3P% gap) and shot volume (**FGA + FTA/2**) with the margin.

A team is **flagged** when it is trailing in a live game even though it has a shot-volume edge of at least
5 and a 3P% deficit of at least 10 points (each team has at least 5 3PA). All three thresholds are in **Settings**.

Page: https://tannerstruth.github.io/di-play-style/live.html

## Data
| What | Source | Cost |
|---|---|---|
| Scores, clock, TV, box stats | ESPN public scoreboard (`groups=50` = all of D-I), every 20 s | free |
| Live spread / total | The Odds API `basketball_ncaab`, `regions=us`, `markets=spreads,totals`, via your Worker | 2 credits per call, all games in one call |
| Pregame line fallback | ESPN scoreboard | free |

**Odds credit controls**
- Odds are requested only when at least one game on today's slate is live, and only while the tab is visible
  (a Settings checkbox lets it keep polling in a background tab).
- Default interval is 2.5 minutes, which is about **48 credits per hour that games are live**. A 12-hour Saturday is about 580.
  Change it in Settings.
- The Worker also refuses to call the Odds API more than once every 60 seconds (`MIN_SECONDS`), so extra tabs and
  devices share one call instead of each paying for it.
- The tiles show credits remaining and used (from the `x-requests-*` headers), credits this page spent today in this browser,
  and credits spent this session.

## One-time setup: Cloudflare Worker (about 5 minutes, free)

The Odds API key must not be in the public page, so a tiny Cloudflare Worker holds it and passes the odds through.

1. Sign in or sign up at https://dash.cloudflare.com (the free plan is enough).
2. Go to **Workers & Pages** → **Create** → **Create Worker** (start from "Hello World"). Name it something like `cbb-odds` and click **Deploy**.
3. Click **Edit code**, delete everything, paste in the contents of [`worker/odds-proxy.js`](worker/odds-proxy.js), and click **Deploy**.
4. Go back to the Worker → **Settings** → **Variables and Secrets** → **Add**:
   - Type **Secret**, name `ODDS_API_KEY`, value = your Odds API key. Save / deploy.
   - Optional: Type **Text**, `MIN_SECONDS` (default 60) or `ALLOWED_ORIGINS` (default `https://tannerstruth.github.io`).
5. Copy the Worker URL (e.g. `https://cbb-odds.<your-subdomain>.workers.dev`). Opening `<that URL>/usage` in a browser tab
   should show 403 "origin not allowed", which means it is running and locked to the page.
6. Open the live page, expand **Settings**, and paste the Worker URL in **Odds proxy**. It is saved in your browser.
   The "Credits remaining" tile fills in right away (the `/usage` check is free).

The origin check stops other websites from using your Worker from a browser. It does not stop someone who knows the
URL from calling it with a script. The 60-second cache limits how much that could cost, and you can rotate the key or
delete the Worker at any time.

## Notes
- Team names are matched between ESPN and The Odds API by tip time (±6 h) plus name similarity, so "Michigan State" matches
  "Michigan St". If a live game shows ESPN's "pre" line instead of a live one, the book has no in-game line for it or the names didn't match.
- "Line source" in Settings picks the median across all US books or one specific book.
- Spread is shown for the favorite (e.g. `MSU −7`), with how many books it came from and how old the line is.
