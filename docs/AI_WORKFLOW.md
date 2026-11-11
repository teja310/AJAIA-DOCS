# AI workflow note

## How I split the work

I treated the AI as a fast, capable implementer and kept the decisions for myself. I owned the **direction**: what to build, which stack, what to cut, and when it was good enough to ship. The AI did the **volume**: scaffolding, implementation, test writing, debugging and first drafts of the docs.

## Tools used

- **Claude Code** (Anthropic's CLI agent) for planning, implementation, testing and documentation drafts.
- **Playwright** (driven through Claude Code) to exercise the real UI in headless Chrome and capture screenshots.

## Decisions I made

**1. Plan before code.** I gave the agent the full brief and had it work in plan mode first: a written plan covering stack, data model, API surface, a build order with time estimates, and an explicit list of what *not* to build. Nothing was implemented until I had reviewed and approved that plan. This is what kept the build inside the timebox.

**2. Choosing the stack.** I didn't accept the first stack suggestion as given. Before approving it I:
- asked how Google Docs itself is built (Closure-compiled JS, canvas rendering, Operational Transformation for real-time sync, Google's own storage), so I could see which parts of the real architecture matter for this slice and which are out of scope;
- questioned whether Python was needed on the backend, and weighed a TypeScript-everywhere build against a FastAPI backend: one language and one toolchain across the codebase versus two.

I chose **TypeScript end to end**: React + Vite with **TipTap** (ProseMirror) for the editor, **Express** for the API, **SQLite** for zero-setup persistence, and a **single Render service** for deployment. It's the stack that let me go deep on editing, sharing and import within 4–6 hours, and every piece of it is something I can explain and defend.

**3. Scope cuts.** I deliberately left out real-time co-editing, comments, version history, export and self sign-up, and put the remaining effort into a coherent core instead. The one concurrency feature I kept is cheap and prevents silent data loss: optimistic versioning, where a stale save gets a 409 and a "reload" prompt instead of overwriting someone else's work.

**4. A verification gate before shipping.** Before anything was pushed, I required a full re-check of the build against every requirement in the brief: type-check, the API test suite, a full browser run as all three users, dev and production modes, and confirmation that data survives a server restart.

**5. Shipping.** I set up the GitHub repo and the commit identity, chose public visibility so reviewers can browse the code, and deployed with a Render Blueprint.

## Where AI materially sped things up

- **Boilerplate at speed:** Express app factory, SQLite schema, zod validation, typed fetch wrapper, CSS.
- **Tests:** a Supertest helper that logs in all three demo users, plus 20 API tests covering every role boundary. Under time pressure this is usually the first thing to get skipped; here it cost almost nothing.
- **Handling library version changes:** npm installed newer major versions than the AI's training data covers (Express 5, Zod 4, TipTap 3, Vite 8). The agent read the installed type definitions before writing editor code instead of guessing at APIs.
- **Automated UI verification:** a Playwright script runs the whole reviewer flow and saves screenshots, which were then reviewed for layout problems.

## AI output that was changed or rejected

The verification loop found several problems in the AI's first-pass output. Each was fixed before shipping:

- **Redundant dependency:** a separate underline package was installed, but TipTap 3 already includes underline. Removed.
- **Underline silently dropped from `.docx` imports:** the first mammoth setup lost `<u>` tags. Testing with a real Word file exposed it, and an explicit style mapping fixed it. The first "real" test file was itself misleading (macOS `textutil` writes fake tab-indented lists), so it was replaced with a properly generated `.docx` and committed as a test fixture with an exact-match assertion.
- **Sticky toolbar overlapped the page when scrolling:** caught from a screenshot. Header, toolbar and status banners were restructured into one sticky block.
- **Incomplete conflict handling:** the first version showed a warning but let the user keep typing edits that could never be saved. The editor now becomes read-only on conflict.
- **Over-strict smoke test:** the browser test flagged the *expected* 401/409 responses as failures. The filter was narrowed rather than the test weakened.
- **Autosave hook reviewed line by line:** this is where data-loss bugs hide, so its logic (single in-flight request, re-queueing on failure, flush on unmount) was reviewed deliberately rather than trusted.

## How correctness, UX and reliability were verified

| Concern | How |
|---|---|
| API behaviour and access control | 20 Vitest/Supertest tests on a real in-memory SQLite; every role boundary asserted |
| Formatting survives save and reload | UI test reloads the page and checks every formatting tag is still present |
| Sharing from the other user's side | UI test logs in as Bob and Carol in separate browser sessions |
| Conflict detection | Carol saves, then Alice's stale tab edits; the test asserts the 409 banner and that "Reload latest" shows Carol's text |
| File import | Real `.docx` fixture with exact expected HTML; `.md`, `.txt`, corrupt, oversized and wrong-type cases |
| Persistence | Server killed and restarted on the same database file; documents still there |
| Visual quality | Screenshots at each step reviewed; this caught two layout bugs |
| Types | `tsc --noEmit` on both workspaces |

**The rule I worked by:** the AI wrote most of the characters, but I made the product and architecture calls, and nothing shipped because it "looked right". Every claim in the README is backed by a test or a screenshot.
