# Automations scheduler (GitHub Actions)

`operate-tick.yml` runs due automations in production every 15 minutes: it wakes the free Render
instance, then POSTs `https://kaivaryn.onrender.com/api/operate/tick` with the `OPERATE_TICK_TOKEN`
repository secret (already set) and an idempotency key, retrying on cold starts.

It lives here because the deploy token used by automation cannot create files under
`.github/workflows/` (GitHub requires the `workflow` scope). To switch it on, once:

1. On GitHub, open this file → copy its contents.
2. Add file → Create new file → name it `.github/workflows/operate-tick.yml` → paste → Commit to `main`.
3. Actions tab → "Kaivaryn automations tick" → Run workflow (optional first run).

Or from a terminal with a token that has the `workflow` scope:
`git mv ops/github-actions/operate-tick.yml .github/workflows/operate-tick.yml && git commit -m "Enable automations tick" && git push`

Any other scheduler works the same way (e.g. a free cron service calling the URL every 15 minutes
with header `Authorization: Bearer <OPERATE_TICK_TOKEN>`). Ticks are idempotent and each due
automation is claimed once, so running two schedulers side by side never double-runs anything.
