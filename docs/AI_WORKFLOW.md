# AI workflow note

## Approach: the agent as a component I had to engineer around

I treated the coding agent the way an AI engineer treats any model in a system: capable but fallible, so it needs a clear spec, grounded inputs, constrained scope and an independent way to check its output. The agent produced most of the code. I owned the decisions that shaped it (what to build, which stack, what to cut, when to ship) and the evaluation loop that decided whether its output could be trusted.

## Tools used

- **Claude Code** (Anthropic's CLI agent) for planning, implementation, test writing, debugging and first drafts of the docs.
- **Playwright**, driven through Claude Code, as the agent's eyes on the real UI: it ran the app in headless Chrome and captured screenshots that I reviewed.

## How I structured the work

**1. Spec first, using plan mode as a checkpoint.** I gave the agent the full brief and kept it in plan mode until I approved a written plan covering the stack, data model, API surface, a build order with time estimates and an explicit list of what not to build. No code was generated before approval. The "not to build" list works as a constraint on the agent: it limits scope drift, which is the main way an agent blows a 4-6 hour timebox.

**2. Interrogating the model's first suggestion.** I did not accept the first stack proposal. Before approving it I:

- asked how Google Docs itself is built (Closure-compiled JS, canvas rendering, Operational Transformation for real-time sync, Google's own storage), to separate the architecture that matters for this slice from what is out of scope;
- challenged whether the backend needed Python, and compared a TypeScript-everywhere build with a FastAPI backend: one language and toolchain versus two.

I chose **TypeScript end to end**: React + Vite with **TipTap** (ProseMirror) for the editor, **Express** for the API, **SQLite** for zero-setup persistence, and a **single Render service** for deployment. I can explain and defend every piece of it, which was the bar for accepting an AI-suggested design.

**3. Scope cuts and one deliberate safeguard.** I left out real-time co-editing, comments, version history, export and self sign-up. The one concurrency feature I kept is cheap and prevents silent data loss: optimistic versioning, where a stale save gets a 409 and a "reload" prompt instead of overwriting someone else's work.

**4. Grounding the agent against version drift.** npm installed newer major versions than the model's training data covers (Express 5, Zod 4, TipTap 3, Vite 8). Left alone, a model will write plausible code against APIs it remembers from older versions. The agent read the installed type definitions before writing editor code, so it was working from the actual APIs rather than recall.

**5. A verification gate before anything shipped.** Before pushing, I required a full re-check of the build against every requirement in the brief: type-check, the API test suite, a browser run as all three demo users in dev and production modes, and confirmation that data survives a server restart.

**6. Shipping.** I set up the GitHub repo and commit identity, made the repo public so reviewers can read the code, and deployed with a Render Blueprint.

## Where AI materially sped things up

- **Boilerplate:** Express app factory, SQLite schema, zod validation, typed fetch wrapper, CSS.
- **Tests:** a Supertest helper that logs in all three demo users, plus 20 API tests covering every role boundary. Tests are usually the first thing cut under time pressure; here they cost almost nothing.
- **Library migration:** reading installed types and adapting to the newer major versions (see above).
- **Automated UI verification:** a Playwright script that runs the whole reviewer flow and saves screenshots for review.

## Where the model's output was wrong, and what I did

The verification loop caught several failures in the agent's first-pass output. Each was fixed before shipping.

| Failure | Root cause | Fix |
|---|---|---|
| Redundant underline dependency installed | Model assumed an older TipTap; v3 bundles underline | Removed the package |
| Underline silently dropped from `.docx` imports | Default mammoth config discards `<u>` | Explicit style mapping; verified with a real Word file |
| Misleading first test file | macOS `textutil` writes fake tab-indented lists, not real list structure | Replaced with a properly generated `.docx`, committed as a fixture with an exact-match assertion |
| Sticky toolbar overlapped the page on scroll | Caught only from a screenshot, not from the code or tests | Header, toolbar and status banners restructured into one sticky block |
| Incomplete conflict handling | The first version warned the user but still let them type edits that could never be saved | Editor becomes read-only on conflict |
| Over-strict browser smoke test | It flagged the expected 401/409 responses as failures | Narrowed the filter instead of weakening the test |

The agent also reviewed the autosave hook line by line rather than trusting it. It is where data-loss bugs hide, and passing tests don't prove the absence of race conditions. It checked that there is a single in-flight request, that failed saves are re-queued, and that pending changes are flushed on unmount.

Two patterns stood out. First, several failures (the underline drop, the misleading fixture) were invisible to a "looks right" read and only appeared when tested against real inputs. Second, the layout bugs were visible only in rendered screenshots, which is why the UI check is part of the loop and not an afterthought.

## How correctness, UX and reliability were verified

| Concern | Method |
|---|---|
| API behaviour and access control | 20 Vitest/Supertest tests against a real in-memory SQLite; every role boundary asserted |
| Formatting survives save and reload | UI test reloads the page and checks that every formatting tag is still present |
| Sharing, seen from the other user's side | UI test logs in as Bob and Carol in separate browser sessions |
| Conflict detection | Carol saves, then Alice's stale tab edits; test asserts the 409 banner and that "Reload latest" shows Carol's text |
| File import | Real `.docx` fixture with exact expected HTML; `.md`, `.txt`, corrupt, oversized and wrong-type cases |
| Persistence | Server killed and restarted on the same database file; documents still present |
| Visual quality | Screenshots reviewed at each step; this caught two layout bugs |
| Types | `tsc --noEmit` on both workspaces |

## Principle

The AI wrote most of the characters; I made the product and architecture calls and built the checks that decided what could ship. Nothing shipped because it looked right, and every claim in the README is backed by a test or a screenshot.
