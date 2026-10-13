# v-snap: blind review findings (2026-10-14)

A blind review of `packages/v-snap` by a subagent that read only the
package (no notes, no git history). It covered bugs, API, user experience,
fitness to purpose, fit with Vitest workflows and the docs. Each finding is
CONFIRMED (traced or reproduced) or PLAUSIBLE (likely but not proven).
Work on these happens in the worktree `.claude/worktrees/v-snap-review`,
branch `v-snap-review`; each item's status is updated here as it goes.

Status: `[ ]` open, `[x]` done on the branch, `[-]` decided against or left
for the user (with a reason).

## Verdict

The reviewer would adopt v-snap for projects with many Pixi, three.js or
canvas views: it is fast (2-5 ms per canvas image at the median), the
determinism work is serious (pinned browser, SwiftShader, its own text
layout, a calibration check), and its error messages beat most snapshot
tools'. For HTML views it would hesitate: text is never drawn, the
viewport and colour scheme are fixed, and hover or focus can't be posed.

## Bugs

- [ ] **B1. High, CONFIRMED.** Failed run-level checks (unused references,
  hash mismatches) only print and set `process.exitCode = 1`
  (`src/node/reporter.ts` `failRun`). Vitest's summary says "passed", and
  the UI, IDE extension, JSON/JUnit reporters and `vitest.state` are all
  green. In watch mode the exit code stays 1 for the session. The file's
  header claims the opposite. Fix: report through Vitest (an unhandled
  error or a synthetic failed task), then correct the header.
- [ ] **B2. Medium, CONFIRMED.** A case-only test rename (`'a blue box'` to
  `'a Blue box'`) passes on Windows and macOS because `existsSync` finds
  the old-case file, and `-u` doesn't rename it. Linux CI then fails it as
  new. On macOS, `toFileKey` doesn't fold case, so the old file looks
  unused and `-u` deletes it. Fix: compare with the real directory entry;
  rename on a case-only mismatch under `-u`, fail clearly otherwise; fold
  case on darwin too. (`src/node/commands.ts`, `references.ts`,
  `reporter.ts`)
- [ ] **B3. Medium, CONFIRMED.** The sources fingerprint
  (`<repo>/.vitest/vsnap/<name>.sources-fingerprint`) is keyed only by the
  `vsnap()` name (default `visual`), so every config with that name shares
  it, though each has its own Vite deps cache. This repo's root config and
  v-snap's own both write `visual.sources-fingerprint`; one run can make
  the other skip a rebundle it needs. Fix: key by root, name and config
  path, or keep it in the project's cache directory. (`src/node/rebundle.ts`,
  `paths.ts`, `config.ts`)
- [ ] **B4. Medium, CONFIRMED.** `-u` never writes an image that is within
  tolerance (`src/node/commands.ts`, the within-tolerance branch comes
  before the write). References drift: a later change is judged against
  the original. The summary note "That is expected only on arm64
  processors" appeared on x64 for a real change. Fix: let `-u` write when
  any pixel differs; reword the note.
- [ ] **B5. Medium, CONFIRMED.** A reference that isn't a decodable PNG
  (such as a Git LFS pointer) fails with pngjs's "unrecognised content at
  end of stream" and frames inside v-snap. The follow-up check then
  advises "Delete them", which would destroy LFS-tracked references; a PNG
  optimiser that strips `tEXt` chunks also gets "Delete them" when `-u`
  repairs it. Fix: catch decode errors, name the file, hint at LFS; say
  `-u` repairs a reference without a hash.
- [ ] **B6. Low, PLAUSIBLE.** `claimTestFiles` keeps owners in
  `globalThis.vsnapTestFiles`, never cleared, though Vitest reloads the
  config in-process. Changing a call's `name` or `include` in watch mode or
  the IDE could throw "is a visual test file of two vsnap calls" until a
  restart. (`src/node/config.ts`)
- [ ] **B7. Low, PLAUSIBLE.** HTML capture puts the host at the document's
  (0,0) but doesn't reset scroll between tests, and `checkFitsPage` checks
  only the right and bottom edges. A pose that scrolls the page clips later
  captures. Fix: `scrollTo(0, 0)` before capture; check left and top.
  (`src/browser/html-image.ts`)
- [ ] **B8. Low, PLAUSIBLE.** Only 2D-context text calls are pinned. Pixi
  `HTMLText` (SVG `foreignObject`) and SVG `<text>` drawn to a canvas use
  system fonts, and calibration doesn't cover them. Fix: document, or
  detect and fail. (`src/browser/canvas-text.ts`)
- [ ] **B9. Low, CONFIRMED.** Every config load, even `vitest -p unit`,
  globs and stats every source file in the repo (about 90 ms here), and the
  test-file search walks the whole root. Only `node_modules`, `dist` and
  dot-folders are skipped, so `coverage/`, `build/` and `out/` churn the
  fingerprint. Fix: skip more output folders; compute lazily.
  (`src/node/rebundle.ts`, `test-files.ts`)
- [ ] **B10. Nit, CONFIRMED.** A run whose only visual file failed to load
  prints "Only the references of the 0 visual test files that ran were
  checked". (`reporter.ts`)
- [ ] **B11. Nit, CONFIRMED.** The summary's "Images" row leaves out tests
  that failed before being judged. (`reporter.ts`)
- [-] **B12. Not v-snap.** `npm run test:vsnap` from `v:\` (lower-case
  drive letter, via npm's `INIT_CWD`) fails all unit files with "Cannot
  read properties of undefined (reading 'config')". A plain Vitest config
  fails the same way: Vitest's Windows drive-letter issue.

## API quality and usability

- [ ] **A1. Medium, CONFIRMED.** For `htmlTest`, the pose runs before the
  element is in the page, and `prepare` belongs to the kind, not the test.
  No way to pose `:hover`, `:focus-visible`, an open dropdown, `userEvent`
  or measured layout. Fix: a per-test step after mounting.
  (`src/browser/visual-test.ts`, `html-image.ts`)
- [ ] **A2. Low, CONFIRMED.** Viewport (1280x800), `colorScheme: 'dark'`,
  `reducedMotion` and `testTimeout: 30_000` are fixed; `vsnap()` passes no
  project options through. Fix: expose `viewport` and `colorScheme` (and
  add them to the environment fingerprint), allow `testTimeout`.
  (`src/node/config.ts`)
- [ ] **A3. Low, CONFIRMED.** No `canvasTest.only.each` or `.skip.each`.
  The test-file regex must accept them too. (`visual-test.ts`,
  `test-files.ts`)
- [ ] **A4. Low, CONFIRMED.** A pose that forgets `return` gets "poses
  undefined, which is not a canvas ... register the view's kind", which
  misleads. Fix: special-case `undefined`. (`visual-test.ts`)
- [ ] **A5. Low, CONFIRMED.** An aliased import (`import { canvasTest as
  visual }`) is reported as "declares no canvasTest or htmlTest yet". Fix:
  mention aliases and helpers. (`test-files.ts`)
- [-] **A6. Low, design.** One image per test, no per-test tolerance, no
  image name other than the test's; renaming a test renames its reference.
  The two config files and the `Register` boilerplate are real learning
  cost.
- [ ] **A7. Nit.** `ProvidedContext` gains generic keys (`visualPageKind`,
  `visualMaxPixels`, ...) in Vitest's global type space. Prefix them.
  (`src/protocol.ts`)
- [ ] **A8. Nit.** The README API table says `htmlViews(options)`, but
  `options` is optional.

## User experience

- [ ] **U1. Low, CONFIRMED.** Paths in messages are relative to the git
  root, not the cwd, so terminal links break when Vitest runs from a
  package folder. (`commands.ts`, `paths.ts`)
- [ ] **U2. Low, CONFIRMED.** The suggested `npx vitest run <file> -u`
  accepts every changed image in the file (and text snapshots). Offer
  `-t "<test name>"` too. (`src/browser/judge.ts`)
- [ ] **U3. Low, CONFIRMED.** The diff paints changes within tolerance red
  too, and `changedRect` includes them; on arm64 a real change would be
  swamped by rounding noise. Fix: a separate colour, and a rectangle of
  real changes only. (`src/node/compare.ts`)
- [ ] **U4. Low, CONFIRMED.** A headed run (`--browser.headless=false`)
  aborts the whole run, so a pose can't be looked at interactively. Allow
  headed runs that compare and write nothing. (`src/browser/calibration.ts`)
- [ ] **U5. Nit.** "Duration 0.0 s" in small runs looks broken.

## Fitness to purpose

- [ ] **F1. Medium, CONFIRMED.** Canvas text is replaced page-wide with
  Source Sans and Source Code: brand or pixel fonts never appear, layout
  that measures text uses stand-in metrics, non-Latin scripts become hex
  boxes, RTL `direction`, `wordSpacing` and `fontStretch` are ignored.
  Documented in Limits and a sound trade; it belongs in the README.
- [ ] **F2. Medium, CONFIRMED.** HTML text is always blank, in a
  fixed-advance font: changes to text colour, weight, decoration,
  ellipsis and font loading are invisible. Say so up front in the README.
- [ ] **F3. Medium, adoption risk.** Peer `playwright: ~1.63.0` and an exact
  `HeadlessChrome` build in `visual-environment.json`: a project pinned to
  another Playwright can't install it, and a changed build stops every run
  until v-snap ships. `VSNAP_MODE=environment` rewrites files inside the
  installed package. Fix: a documented mode that runs and reports but
  never writes, and a stated upgrade policy.

## Fit with Vitest workflows

- Matches Vitest: new references written locally and refused in CI; `-u`
  rewrites changes; `-t`, `.skip`, `.only` keep references in use; partial
  runs check only the files that ran; watch restarts on added or removed
  visual files; failures are recorded for the Vitest UI.
- Stricter than Vitest: unused references fail the run (Vitest only
  reports obsolete snapshots). Defensible, but surprising with B1.
- [ ] **V1. Low.** A sharded run (`--shard`) never runs the complete check,
  so references of deleted test files are never found. Document a way.
- [ ] **V2. Low.** The UI link relies on Vitest's undocumented
  `internal:toMatchScreenshot` artifact type; noted in code, not in docs.
- Reason to exist against `toMatchScreenshot`: clear and honestly argued.

## Documentation

- [ ] **D1. Medium.** The README never says HTML text is blank, canvas text
  uses stand-in fonts, or drawing is in software. Add a short "Trade-offs"
  list near "Why v-snap", linking to Limits.
- [ ] **D2. Medium.** `CONTRIBUTING.md` says "The package isn't published
  yet, and `package.json` marks it private." Neither is true (0.1.0 is
  published).
- [ ] **D3. Low.** The README claims Windows, Linux and macOS "on x64 and
  arm64"; the docs list four checked runners (no Intel macOS, no Windows
  arm64), and the CI matrix doesn't re-check Linux arm64. The README says
  "the same images" while the docs say arm64 differs within tolerance.
- [ ] **D4. Low.** "Support for Another Renderer" in
  `docs/kinds-of-view.md` is prose only; show an example (like this repo's
  `sketchViews`).
- [ ] **D5. Nit.** `docs/configuration.md`: "call `v-snap` once for each
  package" should say `vsnap()`. `CONTRIBUTING.md`: "`v-snap/vitest`
  exports `v-snap`" likewise.
- [ ] **D6. Nit.** `docs/configuration.md` names only `vsnap.config.ts`;
  the code also accepts `.mts`, `.js`, `.mjs`.
- [ ] **D7. Low.** Readability: rules packed into paragraphs would scan
  better as bullets or tables; the `vsnap.config.ts` sample is repeated
  three times.
- Unverifiable by the reviewer: the benchmark figures, "half as long as a
  Playwright screenshot", the UI slider. Observed per-image times agree.

## Strengths to keep

- Measured speed: hashes compared in the page first, so a passing test
  sends nothing to Node; each renderer is made once and reused.
- A determinism design aimed at real causes, with a calibration set that
  stops the run with one clear error.
- Careful reference hygiene: hashes in the PNGs, only marked files ever
  deleted, partial runs know they are partial, stem twins and case
  collisions detected, long names cut with a hash.
- Guard rails at config load (inherited `include`, `exclude`,
  `setupFiles`, `browser.instances`, root mismatch, missing `Register`).
- Precise types through `Register` and `bindCanvasTest`.
- Failure messages point at the declaring line and carry an update
  command; a useful run summary.
- Honest docs about limits and benchmark method.

## Reviewer's top 10

1. B1: report check failures through Vitest.
2. B2: case-only renames.
3. B3, B9: fingerprint key, skipped folders, lazy computation.
4. B4, U3: `-u` within tolerance, the arm64 note, diff noise.
5. D1, D3: README trade-offs and platform claims.
6. F3: a read-only mode for other browser builds, an upgrade policy.
7. B5: undecodable references, "`-u` repairs".
8. A1, A2: HTML interaction after mounting; viewport and colour scheme.
9. D2, D5, D4: CONTRIBUTING's "private" claim, `vsnap()` typos, a custom
   kind example.
10. A3, A4, A5, B7, B6: smaller polish.
