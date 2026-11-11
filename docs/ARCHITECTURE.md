# Architecture note

## The one-paragraph version

A single Node/TypeScript service: Express serves a JSON API under `/api` and, in production, the built React SPA. State lives in one SQLite file. The editor is TipTap (ProseMirror). Documents are stored as sanitized HTML with an integer version used for optimistic concurrency. Access control is a single function, `assertRole`, that every document route calls.

```
Browser (React + TipTap) ──/api──▶ Express ──▶ SQLite
         ▲                           │
         └── built SPA served by ────┘  (one Render web service)
```

## What I prioritised, and why

1. **A coherent editing loop over feature count.** Create → rename → format → autosave → reload → still there. The autosave hook was the most carefully built piece: debounced, single in-flight request, retries on failure, and it never drops edits made while a save is in progress.
2. **Sharing that is actually enforced.** Role checks live on the server in one place (`server/src/access.ts`). The UI hides buttons for viewers, but the API is the real gate; tests prove a viewer gets 403 on PATCH and an outsider gets 404.
3. **Not corrupting other people's work.** Even without live collaboration, two editors can open the same doc. Each save carries the version the client last saw; the server's `UPDATE … WHERE version = ?` rejects stale writes with 409 and the client freezes the editor and offers "Reload latest". This is the cheapest thing that prevents silent data loss.
4. **Zero-friction review.** Seeded accounts, one-click demo login, SQLite with no setup, a single deployable service.

## Key decisions

| Decision | Why | Trade-off |
|---|---|---|
| **HTML as the storage format** (TipTap `getHTML()`) | Round-trips through the editor losslessly for the supported features, imported `.docx`/`.md` naturally become HTML, easy to inspect in the DB | ProseMirror JSON would be stricter and easier to diff/merge. Mitigated by a server-side sanitizer whose whitelist matches the editor's schema, so stored HTML is always something the editor can load |
| **Optimistic version check instead of real-time sync** | Live collaboration (Yjs/OT) is the single biggest Google Docs feature and would have eaten most of the timebox. Versioning gives safety in ~30 lines | Users don't see each other's edits live; a conflict requires a reload |
| **SQLite via better-sqlite3** | Synchronous API keeps route code simple, no service to provision, WAL mode is plenty for this load | Ephemeral on Render's free tier (documented). Schema is plain SQL so a Postgres swap is contained to `db.ts` |
| **Signed cookie session, seeded users** | Realistic enough to demonstrate ownership and sharing (bcrypt hashes, httpOnly, signed) without building registration | No sign-up, no password reset |
| **404 for "no access"** | Doesn't leak whether a document id exists | Slightly less specific error for the user |
| **Express app factory `createApp(db)`** | Tests spin up a fresh in-memory DB + app per test; no mocks, the real stack runs | — |
| **Sanitize on every write** | Imported files and editor payloads both go through the same whitelist; `<script>`, inline handlers, `style` are dropped | Features outside the whitelist (images, tables) are stripped from imports |
| **Import appends** | Simpler mental model than merge/replace and never destroys existing content | No position choice |

## Error handling & validation

- `zod` schemas validate every JSON body; a central error handler maps `ZodError`, `HttpError`, multer size/type errors and malformed JSON to consistent `{ error }` responses.
- Client mirrors upload rules (`.txt/.md/.docx`, 2 MB) for instant feedback; the server enforces them regardless.
- Save failures surface as "Couldn't save – Retry"; the page warns before unload if changes are pending.

## Testing strategy

- **20 API tests** (Vitest + Supertest) cover auth, CRUD, sanitization, validation, the 409 conflict path, every role boundary (owner/editor/viewer/outsider) for read/write/share/delete, and import of `.md`, `.txt`, a real `.docx` fixture, corrupt files, unsupported types and oversized files.
- **A Playwright smoke test** drives the real UI in Chrome through the entire reviewer flow (three users, formatting, reload, import, share, read-only enforcement, conflict banner). It's what produced the screenshots in `docs/screenshots/`.

## What I would build next (2–4 h)

1. **Live collaboration:** `@tiptap/extension-collaboration` + Yjs + a `y-websocket` endpoint on the same Express server. The version column becomes unnecessary for content but stays for titles.
2. **Version history:** insert a `document_versions` row on each successful PATCH; a side panel to preview/restore.
3. **Export** to `.docx` (via the `docx` package) and PDF.
4. Postgres (Neon) for durable hosted storage.
