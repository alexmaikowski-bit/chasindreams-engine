# Chasin' Dreams Farm — Content Engine

Single-file React engine (`index.html`) + two Vercel serverless functions:
- `api/panel.js` — live Snack Panel (4 personas react to a brief)
- `api/studio.js` — The Strategist (streaming chat)

## Deploy
1. Push this folder to a GitHub repo.
2. Import the repo in Vercel (framework preset: **Other**; no build command).
3. Set env var `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables.
4. Add domain `chasindreams.obsoleteai.co` in Vercel → Settings → Domains.

Optional env: `PANEL_MODEL`, `STUDIO_MODEL` (default `claude-sonnet-5`).

**Never** add the strategy docs (BRAND_THESIS, CLAUDE.md, research, ONE_PAGER) to this repo — Vercel serves every file publicly.
