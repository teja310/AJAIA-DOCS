# AI workflow note

## Tools used

- **Claude Code** (Anthropic's CLI agent) as the primary pair-programmer for the whole build, run in plan mode first and then execution mode.
- **Playwright** driven by Claude to exercise the real UI in headless Chrome and capture screenshots.

No other AI tools were used.

## Where AI materially sped things up

1. **Scope and plan first.** I pasted the brief and had Claude produce a written plan (stack, data model, API table, cut list, build order) before any code. I reviewed and approved it, and asked about the stack choice before committing. The plan is what kept the build inside the timebox.
2. **Boilerplate at speed:** Express app factory, SQLite schema, zod schemas, the typed fetch wrapper, CSS. These are things I know how to write; AI just typed them faster.
3. **Test scaffolding:** the Supertest helper that logs in three users once and hands back agents, then the 20 test cases. Writing these by hand is the part most people skip under time pressure.
4. **Version-drift checks:** npm installed newer majors than Claude's training data (Express 5, Zod 4, TipTap 3, Vite 8). Claude grepped the installed type definitions (`node_modules/@tiptap/core/dist/index.d.ts`, StarterKit's exports) before writing editor code, instead of guessing, which avoided a class of "works in the blog post, not in this version" bugs.
5. **UI verification without a human in the loop:** Claude wrote a Playwright script that runs the entire reviewer flow and takes screenshots, then *read the screenshots* to spot layout problems.

## What AI output I changed or rejected

- **Separate `@tiptap/extension-underline` package:** Claude initially installed it; in TipTap 3 underline ships in StarterKit. Removed the redundant dependency.
- **`.docx` underline was silently dropped.** The first mammoth integration lost `<u>`; testing with a real generated Word file exposed it and we added a `styleMap`. The first "real" test file was also wrong (macOS `textutil` produces fake lists as tab-indented paragraphs), so we generated a proper one with the `docx` library and committed it as a fixture with an exact-match test.
- **Sticky toolbar overlapped the page.** Visible only in the scrolled screenshot. Restructured header + toolbar + banners into one sticky block.
- **Conflict handling was incomplete.** The first version showed a banner but let the user keep typing edits that could never be saved. Added freezing the editor on 409.
- **Browser console "errors" in the smoke test** for expected 401/409 responses were initially treated as failures; narrowed the filter rather than loosening the test entirely.
- Kept the first draft of the autosave hook but reviewed its state machine line by line (single in-flight request, re-queueing on failure, flush on unmount), since that's where subtle data-loss bugs live.

## How correctness, UX and reliability were verified

| Concern | How |
|---|---|
| API behaviour and access control | 20 Vitest/Supertest tests on a real in-memory SQLite; every role boundary asserted |
| Formatting survives save → reload | UI test reloads the page and checks the exact HTML tags are still present |
| Sharing works from the other user's perspective | UI test logs in as Bob and Carol in separate browser contexts |
| Conflict detection | UI test has Carol save, then Alice's stale tab types; asserts the 409 banner and that "Reload latest" shows Carol's text |
| File import | Real `.docx` fixture with an exact expected-HTML assertion; `.md`, `.txt`, corrupt, oversized and wrong-type cases |
| Visual quality | Screenshots at each step reviewed by eye (and by Claude) — this is how two layout bugs were caught |
| Types | `tsc --noEmit` on both workspaces |

The guiding rule: AI wrote most of the characters, but every design decision in `ARCHITECTURE.md` was made deliberately, and nothing shipped on the basis of "it looks right" without a test or screenshot confirming it.
