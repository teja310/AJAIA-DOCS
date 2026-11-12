# Architecture note

## Summary

One Node/TypeScript service. Express serves a JSON API under `/api` and, in production, the built React SPA. All state lives in a single SQLite file. The editor is TipTap (ProseMirror). Documents are stored as sanitized HTML with an integer version used for optimistic concurrency. Authorization is one function, `assertRole`, called by every document route.

```
Browser (React + TipTap) ──/api──▶ Express ──▶ SQLite
         ▲                           │
         └── built SPA served by ────┘  (one Render web service)
```

The design goal was to keep the number of moving parts low enough that every one of them can be tested, and to spend the saved time on the places where documents editors actually lose data: autosave, concurrent writes and access control.

## Invariants

These are the properties the rest of the design protects.

1. **Authorization lives in one place.** Role checks are in `server/src/access.ts`. The UI hides controls for viewers, but that is a convenience, not a control. The API is the gate.
2. **A stale write never overwrites newer content.** Every save carries the version the client last saw. The server runs `UPDATE … WHERE version = ?`. Zero rows updated means 409.
3. **Stored HTML is always loadable by the editor.** Every write, whether from the editor or from an import, passes through one sanitizer whose whitelist matches the editor's schema.
4. **The client never drops edits made while a save is in flight.**

## Priorities

- **A coherent editing loop over feature count.** Create, rename, format, autosave, reload, and the content is still there. The autosave hook got the most scrutiny: it is debounced, allows a single in-flight request, retries on failure and queues edits made mid-save. Data-loss bugs concentrate in this code.
- **Sharing that is enforced, not decorated.** Tests assert that a viewer gets 403 on PATCH and that an outsider gets 404.
- **No silent corruption of other people's work.** Without live collaboration, two people can still open the same document. On a version mismatch the server returns 409. The client freezes the editor and offers "Reload latest". It is the cheapest mechanism that rules out silent overwrites.
- **Low friction for reviewers.** Seeded accounts, one-click demo login, no database to provision and one deployable service.

## Decisions and trade-offs

| Decision | Rationale | Cost, and how it is contained |
|---|---|---|
| **HTML as the storage format** (TipTap `getHTML()`) | Round-trips through the editor losslessly for the supported features. Imported `.docx` and `.md` become HTML naturally. Easy to inspect in the database. | ProseMirror JSON is stricter and easier to diff and merge. The whitelist sanitizer (invariant 3) keeps stored HTML within what the editor can load. |
| **Optimistic version check, not real-time sync** | Live collaboration (Yjs or OT) is the largest Google Docs feature and would have consumed most of the timebox. Versioning gives data safety in about 30 lines. | Users don't see each other's edits live, and a conflict requires a reload. |
| **SQLite via better-sqlite3** | Synchronous API keeps route code simple. No service to provision. WAL mode is ample for this load. | Storage is ephemeral on Render's free tier (documented). The schema is plain SQL, so a Postgres migration is confined to `db.ts`. |
| **Signed cookie session, seeded users** | Enough to demonstrate ownership and sharing properly (bcrypt hashes, httpOnly, signed cookie) without building registration. | No sign-up and no password reset. |
| **404 for "no access"** | Doesn't reveal whether a document id exists. | A less specific error for legitimate users. |
| **`createApp(db)` factory** | Each test gets a fresh in-memory DB and a real app instance. No mocks, so tests exercise the real stack. | None worth noting. |
| **Sanitize on every write** | Imports and editor payloads share one whitelist. `<script>`, inline handlers and `style` are dropped. | Content outside the whitelist, such as images and tables, is stripped from imports. |
| **Import appends** | Simplest mental model, and it never destroys existing content. | The user can't choose an insertion position. |

## Error handling and validation

- `zod` validates every JSON body. A central error handler maps `ZodError`, `HttpError`, multer size and type errors and malformed JSON to a consistent `{ error }` response shape.
- The client mirrors the upload rules (`.txt`, `.md`, `.docx`; 2 MB) for immediate feedback. The server enforces them independently.
- Save failures show "Couldn't save – Retry". The page warns before unload if changes are pending.

## Testing

- **20 API tests** (Vitest + Supertest) against a real in-memory SQLite. They cover auth, CRUD, sanitization, validation, the 409 conflict path, every role boundary (owner, editor, viewer, outsider) for read, write, share and delete, and imports of `.md`, `.txt`, a real `.docx` fixture, corrupt files, unsupported types and oversized files.
- **A Playwright smoke test** drives the real UI in Chrome through the full reviewer flow: three users, formatting, reload, import, share, read-only enforcement and the conflict banner. It also produces the screenshots in `docs/screenshots/`.

The split is deliberate. The API tests carry the correctness guarantees, since access control and concurrency are server concerns. The browser test covers what only a browser can show: persistence of formatting across reload and the client's behavior on conflict.

## Known limitations

- Conflicts are detected, not merged. The loser must reload and redo their edit.
- No live presence or cursors.
- Hosted data is ephemeral on the free tier.
- Imports that contain unsupported structures (images, tables) lose them.
- No sign-up, password reset or rate limiting.

## Next steps (about 2–4 hours)

1. **Live collaboration:** `@tiptap/extension-collaboration`, Yjs and a `y-websocket` endpoint on the same Express server. The version column then becomes unnecessary for content but still guards titles.
2. **Version history:** insert a `document_versions` row on each successful PATCH, with a side panel to preview and restore.
3. **Export** to `.docx` (via the `docx` package) and PDF.
4. **Postgres (Neon)** for durable hosted storage.
