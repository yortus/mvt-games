# vsnap: open items (temporary checklist)

A working list for proposal 042 (vsnap), to be worked through over several
rounds and deleted when it is empty. It holds the findings of the fresh
review of 2026-10-12 and every other open item. Paths are relative to
`packages/vsnap/` unless they start with `packages/` or `notes/`.

Each review finding says how it was checked:

- **Checked**: the code was read, and the finding holds.
- **Likely**: the reasoning holds, but a run is needed to prove it.
- **Unverified**: not yet checked.

## Bugs

- [x] **B1. The unknown-font check depends on test order** (checked).
  `src/browser/canvas-text.ts` records an unknown family only when its CSS
  font string misses the parse cache, so only the first test that uses a
  given string fails. Also, `src/browser/visual-test.ts` drains the set
  only after the blank check, so a test that throws before then leaves its
  families for the next test.
  Fix: record on every lookup, clear the set in `resetForTest`, and drain
  it in a `finally`.
- [x] **B2. The orphan scan can delete PNGs that aren't references**
  (checked). `findReferences` in `src/node/references.ts` walks the whole
  root, and treats any PNG with the hash marker as a reference, so `-u`
  can delete a copy in `docs/`, or a nested package's references that this
  run doesn't load.
  Fix: scan only the paths that the `referencePath` template can produce.
- [x] **B3. Test file paths go to Vitest as globs, unescaped** (likely).
  `src/node/config.ts` passes them to `test.include` and
  `optimizeDeps.entries`. A file such as `src/routes/[slug]/x.visual.test.tsx`
  would never run, and the complete-run checks would silently stop too.
  Fix: escape each path.
- [x] **B4. Concurrent tests would break naming and drawing** (checked:
  nothing prevents them). Image names come from the global
  `expect.getState().currentTestName` (`src/browser/judge.ts`), and the
  Pixi stage is one shared object (`src/pixi/pixi-image.ts`).
  Fix: force `sequence.concurrent: false` in vsnap's projects, and name
  images from the test's own task.
- [x] **B5. Some views are never disposed** (checked). A view that fails
  its kind's check is never disposed (`src/browser/visual-test.ts`), and
  nor is a `'canvas'` pose's canvas, on any path. In the shared page,
  leaked WebGL contexts could push out the renderers' own.
- [ ] **B6. Run-level failures only set `process.exitCode`** (checked).
  Shared references, orphans and bad hashes (`src/node/reporter.ts`) leave
  watch mode, the UI and programmatic runs showing a pass.
- [ ] **B7. Non-ASCII test names lose their letters** (checked).
  `src/browser/image-name.ts` keeps only `[A-Za-z0-9.]`, so `'日本'` gets
  the image name `''`, and `'café'` clashes with `'caf'`.
  Fix: keep Unicode letters and digits, or reject an empty name.
- [ ] **B8. An HTML view taller or wider than the viewport may be captured
  wrongly** (unverified). The viewport is 1280 by 800
  (`src/node/config.ts`), and the capture doesn't go beyond it
  (`src/node/commands.ts`).
  Fix: fail if the view's rectangle goes past the viewport.
- [ ] **B9. HTML capture waits only for `<img>` elements and fonts**
  (likely to flake). CSS background images, SVG `<image>` elements and
  video posters aren't waited for (`src/browser/html-image.ts`).
- [ ] **B10. HTML `prepare` runs before the element is in the page**
  (checked). `src/browser/visual-test.ts` calls it before
  `captureHtmlImage` mounts the element, so a `prepare` that measures
  layout sees nothing.

## Before publishing

- [ ] **P1. The Playwright promise in the README is probably false**
  (likely). `@vitest/browser-playwright` takes Playwright as a peer with
  the range `*`, so a project with another Playwright version launches
  that version's browser, and the fingerprint check stops the run.
  Fix: make `playwright` a peer of vsnap, or launch vsnap's own copy by
  its executable path. Then correct the README's Requirements.
- [ ] **P2. `@vitest/browser-playwright` is a caret dependency, but
  requires exactly Vitest 5.0.3** (checked). Make it a peer, as `vitest`
  is.
- [ ] **P3. The package works only from source, inside this repo.**
  `exports` point at `.ts` files, with no `types`, `files` list or build.
  Node-side paths resolve `.ts` siblings and `src/browser/__references__`
  from `import.meta.dirname`. `visual-environment.json` must ship.
  Fix: build with tsdown, check with publint and attw, set `files` and
  `engines` (Node 22 or later).
- [ ] **P4. Vite's dependency scan ignores `**/dist/**`** (checked in
  Vite's source by the reviewer). A setup file shipped under `dist/` would
  drop out of `optimizeDeps.entries`, and bring back mid-run reloads.
  Choose the build's output folder with this in mind.
- [ ] **P5. A packed install may load vsnap's page code twice**
  (unverified): once pre-bundled by Vite as `vsnap`, once by path as the
  setup file. That would mean two seeded randoms and two page setups.
  Check with a packed install. A possible fix is
  `optimizeDeps.exclude: ['vsnap', 'vsnap/pixi', 'vsnap/three']`.
- [ ] **P6. Shipping `.ts` source makes projects type-check vsnap's
  code**, which needs `vite/client` types and the project's own strictness
  flags. Ship `.d.ts` files.
- [ ] **P7. Verify the published types.** The declaration merging on
  `Register`, and the derived `canvasTest` types, must work from the built
  `.d.ts` files in a project that imports `vsnap/pixi`.
- [ ] **P8. The hash marker's keyword is `'mvt-pixels'`** (checked,
  `src/node/png.ts`). It's an in-house name, and changing it after
  publishing would invalidate every reference. Decide it now, perhaps
  `'vsnap'`, and rewrite every reference once.
- [ ] **P9. Some messages are for vsnap's maintainers, not its users.**
  `npm run test:visual:environment -w vsnap` in
  `src/browser/calibration.ts` and `src/node/commands.ts`, and "add the
  names to SANS_FAMILIES … in the vsnap package" in
  `src/browser/visual-test.ts`.
- [ ] **P10. The output folder is undocumented.** `.vitest/vsnap` at the
  git root (`src/node/paths.ts`) isn't mentioned in the README, which
  should say to gitignore it. `toDisplayPath` is relative to a repo root.
  On Windows, a reference on another drive makes `relative()` return an
  absolute path, which breaks the output path (`src/node/commands.ts`).
- [x] **P11. The "too big" failure gives no update command**
  (`src/browser/judge.ts`), though the README says failure messages give
  it.
- [ ] **P12. The new calibration images have run only on Windows.** Push
  the branch, and let the visual CI workflow run on Linux and macOS.

## API and design

- [x] **A1. Run-level checks are switched off silently.** One skipped or
  `todo` test turns off the complete-run checks
  (`src/node/reporter.ts`). The summary should say why they didn't run.
- [ ] **A2. `extends: true` brings in more than `include` and `exclude`.**
  It probably also brings the root's `setupFiles`, `globalSetup` and
  `retry` into the browser projects. A Node-only setup file would break
  the page. Check, then warn or strip them.
- [x] **A3. The options are not Vitest's options.** The README says they
  come first "as they do in Vitest's `test`", but they don't accept
  `timeout`, `retry` or `skip`, and there is no `.skip`, `.only` or
  `.each`. Change the wording, or add the support.
- [ ] **A4. Should `artStyle` default to `'smooth'`?** `'pixel'` suits
  games, not Pixi users generally. A decision for the user.
- [ ] **A5. A view of one solid colour can't be tested.** The blank check
  always fails it, and can't be turned off.
- [ ] **A6. `background` differs between the kinds.** It's a number for
  canvas kinds, and a CSS string for `htmlTest`.
- [ ] **A7. `CanvasViewKind`'s defaults make a bare annotation
  unusable.** With `V = never, O = never`, `CanvasViewKind` without type
  arguments gives `prepare(view: never)`.
- [ ] **A8. The caches in the shared page grow without limit.** Pixi keeps
  a render target for each distinct size (`src/pixi/pixi-image.ts`).
  three.js keeps a scene for each `scene` function
  (`src/three/three-image.ts`), so an inline arrow function leaks a scene
  and its environment map on every test. The default disposers don't free
  textures, and `disposeObject` skips lines, points and sprites.
- [ ] **A9. In-house wording in the package.** `src/pixi/pixi-image.ts`
  mentions "the games' spritesheets".
- [ ] **A10. One `Register` per TypeScript program.** A monorepo whose
  packages have configs of their own must type-check each package on its
  own. It's documented. Consider whether vsnap can do better.

## Watch mode

- [ ] **W1. A change to `vsnap.config.ts`, or to vsnap's page code, needs
  Vitest stopped and started again.** Vitest's browser mode keeps the
  setup's modules for the session, even across its own restarts, so the
  tests rerun with the old modules. Find out why a restart doesn't clear
  them, and fix it if vsnap can. The README documents the behaviour for
  now.
- [ ] **W2. Add a scheduled CI run with `--sequence.shuffle`**, to catch
  tests that depend on the ones before them in the shared canvas page.

## Smaller items

- [ ] **S1.** `src/node/config.ts` builds `includes` as a copy of the file
  list, and spreads every option into `createVisualProject`.
- [ ] **S2.** `patchPixiPools` (`src/pixi/pixi-views.ts`) patches a Pixi
  8.21 bug, but the peer range is `^8.16`. `_roundPixels`
  (`src/pixi/pixi-image.ts`) is a private Pixi field. Recheck both on each
  Pixi update.
- [ ] **S3.** `cdpSessions` (`src/node/commands.ts`) is never cleared in
  watch mode.
- [ ] **S4.** Record the earlier question about a configurable pixel
  tolerance (the answer and the decision) in 042.

## Usability

From the usability review of 2026-10-12, from a Vitest user's point of
view. A1, A2, A4, A5, B1 and P7 also came up there.

- [x] **U1. New images fail their test.** Vitest writes new snapshots
  automatically on a developer's machine, and refuses only in CI. vsnap
  fails every new image until `-u`, so a first test is red for no fault.
  Fix: write new references locally, and fail on them in CI, as Vitest
  does.
- [x] **U2. No `.skip`, `.only`, `.todo` or `.each`, and no Vitest test
  options** such as `timeout` or `retry`. Users will reach for
  `canvasTest.only(...)`. Add them, and pass Vitest's options through.
  Done on 2026-10-12, except `.each`, which is U9.
- [ ] **U3. Show the images where Vitest shows results.** A failure names a
  PNG under `.vitest/vsnap/`, which the user opens by hand. Vitest's test
  annotations can carry attachments, which the Vitest UI and HTML reporter
  show. Check that browser mode supports them, then attach the actual,
  reference and diff images.
- [ ] **U4. vsnap's summary goes to standard output,** even with
  `--reporter=json`, which could corrupt output that another tool reads.
  Print it to standard error, or only beside a human-readable reporter.
- [ ] **U5. Check the tools around Vitest:** the VS Code Vitest extension
  (does it list and run visual tests?), the Vitest UI with browser
  projects, and coverage runs that include them.
- [ ] **U6. A step-by-step setup guide in the README** for a project whose
  config is flat today: moving to projects, moving `include` and
  `exclude` into the unit project, adding `vsnap.config.ts` with
  `Register`, and including it in `tsconfig.json`.
- [ ] **U9. `canvasTest.each` and `htmlTest.each`,** with Vitest's
  table forms and name formatting (`%s`, `$name`). Until then, a test can
  declare its cases in a loop, as the website's tests do.
- [ ] **U7. Let `vitest.config.ts` name `vsnap.config.ts`:**
  `vsnap({ config: './vsnap.config.ts' })`, optional, with today's
  location as the default, so that a reader of the Vitest config sees where
  the rest lives. (Moving the page's config into `vitest.config.ts`, and
  copying it out, was considered and rejected on 2026-10-12: the page's
  parts are functions, which can't be copied out of a running config, and
  copying their source would need fragile code extraction.)
- [ ] **U8. Check `vsnap.config.ts` when the config loads, in Node,
  without running it:** that it exists when the project has canvas tests of
  kinds other than `'canvas'`, and that it calls `defineVsnapConfig`. A
  plain text check, as for test files, so a missing or misplaced file
  stops the run before any browser starts.

## The rest of 042, step 10

- [ ] Review each dependency, with P1 and P2.
- [ ] The final logo: the SVG in the repo, an icon size for npm, a
  favicon, a settled colour, and a wordmark if the README wants one.
- [ ] Publishing with changesets, as the `@mvtjs` libraries are.
- [ ] A trial on another project, from a packed install (see P5 and P7).
- [ ] Publish.
- [ ] Archive 042, and delete the `visual-tests` worktree.

## Outside vsnap

- [ ] Rerun the website's thumbnail script, which changed with the
  whole-entry tests. The user runs it, since it launches the installed
  Chrome, and each new Chrome profile risks a failed Windows logon.
- [ ] Commit chunk 10 and the rounds since it in main (the user).
- [ ] Stop the docs dev server that serves the worktree, when it's no
  longer needed.

## Miscellaneous
- [ ] Thoroughly review the docs pages that mention visual testing
- [ ] Thoroughly review the vsnap README and docs in the vsnap package
- [ ] Address concurrency in visual test runs
- [ ] finalise standard paths for reference images
- [ ] followup speed checkup - did we make it slower? Can it be faster still?

