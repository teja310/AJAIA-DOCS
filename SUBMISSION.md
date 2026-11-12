# Submission: Ajaia Docs

## Links

- **Live app:** https://ajaia-docs-74n2.onrender.com (free tier: the first visit after ~15 min idle takes 30–60 s to wake up)
- **Source repo:** https://github.com/teja310/AJAIA-DOCS
- **Walkthrough video:** https://www.loom.com/share/4b8a53bddec2481783d4ff4812d1f27d (also in `VIDEO_URL.txt`)

## Test accounts

Password for all: `demo1234`

| User | Email | Seeded state |
|---|---|---|
| Alice Chen | alice@ajaia.test | Owns "Welcome to Ajaia Docs" |
| Bob Okafor | bob@ajaia.test | Has *editor* access to Alice's welcome doc |
| Carol Singh | carol@ajaia.test | Nothing shared yet — good target for a sharing demo |

Suggested 2-minute review: sign in as Alice → open the welcome doc → Share → add Carol as *View only* → sign out → sign in as Carol → doc appears under *Shared with me* with a "View only" badge and a read-only editor.

## What's in this folder

| Item | Path |
|---|---|
| Source code | `AJAIA/` (this folder; `node_modules` excluded) |
| Setup & run instructions | `README.md` |
| Architecture note | `docs/ARCHITECTURE.md` |
| AI workflow note | `docs/AI_WORKFLOW.md` |
| Walkthrough video URL | `VIDEO_URL.txt` |
| Screenshots | `docs/screenshots/*.png` |
| Automated tests | `server/test/*.test.ts` (20 API tests), `e2e/ui-smoke.mjs` (browser flow) |
| Deployment config | `render.yaml` |

## Status

**Working end to end:** document create / rename / edit / delete; rich text (bold, italic, underline, strikethrough, H1–H3, bulleted & numbered lists, quotes, undo/redo); autosave with status; `.txt` / `.md` / `.docx` upload as a new document or appended to an existing one; sharing with viewer/editor roles, role change and revoke; owned vs shared dashboard; persistence across refresh; stale-write conflict detection; validation and error handling; 20 passing API tests + a browser smoke test; single-service deployment.

**Incomplete / known limitations:**
- Render free tier has an ephemeral disk, so hosted data resets when the service redeploys or wakes from sleep (seed data is recreated). Local runs persist normally.
- No real-time co-editing: concurrent edits are detected (409 + reload prompt), not merged.
- Users are seeded; there is no sign-up.

**Next 2–4 hours:** Yjs live collaboration, version history, `.docx`/PDF export, Postgres for durable hosting.
