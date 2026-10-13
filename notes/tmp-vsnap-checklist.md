# vsnap: open items (temporary checklist)

A working list for proposal 042 (vsnap), to be worked through over several
rounds and deleted when it is empty. It holds the findings of the fresh
reviews of 2026-10-12 and 2026-10-13 and every other open item. Paths are relative to
`packages/vsnap/` unless they start with `packages/` or `notes/`.

Each review finding says how it was checked:

- **Checked**: the code was read, and the finding holds.
- **Likely**: the reasoning holds, but a run is needed to prove it.
- **Unverified**: not yet checked.
- **Reproduced**: the 2026-10-13 review made it happen, in a scratch
  project or a run.

## Bugs

From the blind review of 2026-10-13.

- [x] **B7. Two `vsnap()` calls with one root delete each other's
  references** (reproduced). Each call's reporter counts every hashed PNG
  under its root as its own (`src/node/references.ts` `findReferences`,
  `src/node/reporter.ts` `settleOrphans`), and `registerRoot` only skips
  roots nested inside another. Two calls split by `include`, with the
  default root, each report the other's references as unused, and `-u`
  deletes them all. Fix: refuse two calls whose roots are the same or
  overlap, or limit each call's references to its own test files.
  Done on 2026-10-13: an image belongs to a call only if the reference
  path, read backwards, gives a test file that the call's `include` globs
  match (so a deleted file still owns its images, which are then unused), or,
  for a template without the file's name, a folder that holds one of its
  test files. Two calls whose globs match one file stop the run. Checked in
  the packed trial: two calls with one root keep both images through `-u`.
- [x] **B8. With a non-default `referencePath`, `-u` deletes copies of
  references elsewhere** (reproduced). `toReferenceGlob` turns
  `{testFileDir}` into `**`, so with `{testFileDir}/{imageName}.png` any
  hashed PNG under the root, such as a copy in `docs/`, counts as a
  reference, is reported as unused, and `-u` deletes it. The comment at
  `references.ts` and the README say copies are safe. Fix: limit the
  folders to those that hold a test file of the call.
  Done on 2026-10-13, with B7: a copy in `docs/` is no longer a reference.
- [ ] **B9. Missing glyphs pass when they change** (reproduced). The test
  fonts lack ★ ☆, emoji, CJK and, in the sans font, █. Each draws the same
  empty box (glyph 0), so three filled stars and three empty ones give the
  same image. Fix: fail a test whose canvas text maps a character to
  glyph 0, as unpinned font families fail, naming the characters.
- [ ] **B10. HTML captures of CSS animations are flaky** (reproduced: 3
  of 4 runs failed). Nothing freezes animations or transitions
  (`src/browser/html-image.ts`); `reducedMotion: 'reduce'` only affects CSS
  that asks for it. Fix: as Playwright's `animations: 'disabled'` does,
  finish finite animations and cancel infinite ones, turn transitions off,
  and wait a frame.
- [ ] **B11. Text in shadow DOM isn't blanked** (reproduced). The blank
  font rule (`src/browser/html-rules.ts`) and the steps that quantize font
  sizes, pixelate rotated images and load style images don't reach into
  shadow roots, so web components draw real text in the system's fonts.
  Fix: add the rules to each open shadow root (`adoptedStyleSheets`), and
  walk shadow roots in those steps.
- [x] **B12. One malformed visual test file breaks every run** (reproduced),
  `-p unit` and the VS Code extension's discovery included, because
  `findVisualTestFiles` throws at config load. Fix: report it from vsnap's
  projects instead, so other projects still run.
  Done on 2026-10-13: such a file is left out of the projects, with a
  warning when the config loads. A run of the visual tests fails over it,
  after running the others; `-p unit` only warns. Checked with an empty file
  in the website.
- [ ] **B13. A root `test.browser` leaks into vsnap's projects**
  (reproduced). With `extends: true`, a root `browser.instances` adds
  instances, so each visual file runs again in another browser, uncounted,
  and races vsnap's instance when writing new references. Fix: set
  vsnap's own instances so nothing is added, or stop the run, as for
  inherited `include` and `setupFiles`.
- [ ] **B14. A long test name fails with a raw ENOENT** (reproduced at 300
  characters; a name over 255 bytes would fail on Linux). Fix: cap image
  names, with a short hash of the full name, and a clear message.
- [ ] **B15. Image names that differ only in case collide on macOS**
  (checked). `toFileKey` folds case only on Windows. Fix: compare names
  case-insensitively on every platform when looking for shared references.
- [ ] **B16. Smaller bugs** (each checked by reading, or reproduced):
  - A font fetch that fails shows as fontkit's "Unknown font format"
    (`src/browser/page-setup.ts`): check `response.ok` and name the URL.
  - `checkViewConfig` rejects `export { config as default }`.
  - `engines` says `>=22`, but `fs.globSync` with `withFileTypes` needs
    22.2, and stops being experimental in 22.17 (likely).
  - The default `root` is the working folder, not the config's folder, so
    `vitest --root` or `--config` elsewhere scans the wrong tree (likely).
  - Pixi textures cached by an earlier test keep that test's sampling
    (`TextureSource.defaultOptions.scaleMode`), so images could depend on
    test order (likely). Document it, or detect it.

## Before publishing

- [ ] **P12. The new calibration images have run only on Windows.** Push
  the branch, and let the visual CI workflow run on Linux and macOS.

## API and design

- [x] **A4. Should `artStyle` default to `'smooth'`?** `'pixel'` suits
  games, not Pixi users generally. A decision for the user. The 2026-10-13
  review agrees, and adds project-wide defaults (A13).
  On 2026-10-13, `pixiViews({ artStyle })` became the project's default, so
  the built-in default matters less. Also open: the name. "Art style" reads
  as an aesthetic, and `'pixel'` and `'smooth'` aren't parallel. Suggested:
  `pixelArt: boolean` (default `false`, which also settles this item), or
  `rendering: 'pixelated' | 'smooth'`, after CSS's `image-rendering`.
  Decided and done on 2026-10-13: `artStyle` became `pixelArt: boolean`,
  default `false`. The website and the fixture set `pixiViews({ pixelArt:
  true })`, and every reference image stayed identical.
- [ ] **A11. "kind" means two things.** A test's `kind: 'pixi'` matches a
  view kind's `name`, while a `CanvasViewKind`'s own `kind` field is
  `'canvas'` or `'html'`, and `defaultView` names a kind too. Someone
  writing a kind will set `kind: 'sketch'`. Consider renaming the field.
- [ ] **A12. The entry points' names.** `defineVsnapConfig` comes from
  `vsnap` and `vsnap()` from `vsnap/config`, and `vsnap()`'s `config`
  option names `vsnap.config.ts`. Users will look for `defineVsnapConfig`
  in `vsnap/config`. Consider `vsnap/vitest` for the Node side, and
  another name for the option.
- [ ] **A13. No project-wide defaults for a kind's options,** such as
  `pixiViews({ artStyle, background })`. With A4.
  The art style done on 2026-10-13, now `pixiViews({ pixelArt })`, and a
  test's own overrides it. `background` is still to do, for every kind.
- [ ] **A14. The three.js peer range covers one minor version**
  (`^0.186.1`), and three releases one a month, so a project on 0.187
  likely gets a conflict. Widen it.
- [ ] **A15. `CanvasTestOptions` knows only the registered config,** so a
  project using `bindCanvasTest` can't name its options' type. Add a
  config parameter.
- [ ] **A16. Smaller gaps:** no `skipIf` or `runIf`; `.todo` takes no
  options; a kind's `dispose` is required; no `exclude` option; the fixed
  `groupOrder: 1` can clash with a project's own group 1; the viewport
  and tolerance are fixed.
- [ ] **A17. Playwright `~1.63.0` makes upgrades lockstep** for projects
  that use Playwright for other tests. A deliberate trade-off: say so
  plainly in the README's Requirements.

## Watch mode

- [x] **W3. Watch mode crashes when a new visual test file is empty**
  (reproduced). VS Code's "New File" makes one. The watcher re-reads every
  test file on an add or delete (`src/node/config.ts`), and the error that
  `findVisualTestFiles` throws becomes an unhandled rejection, which ends
  Vitest. Fix: catch it, say what is wrong, and keep watching; restart
  once the files are valid again. With B12.
  Done on 2026-10-13: the watcher no longer throws (and catches anything
  else), warns about the new file, and re-reads the lists when a known or
  problem file changes, so the file's first test restarts Vitest. Checked:
  an empty file, then a test written into it, in a watch run.
- [ ] **W4. The VS Code extension may not see new visual files** unless it
  runs Vitest in watch mode, since the restart needs `config.watch`
  (unverified).


## Smaller items


## Usability

- [ ] **U5. Check the tools around Vitest:** the VS Code Vitest extension
  (does it list and run visual tests?), the Vitest UI with browser
  projects, and coverage runs that include them.
  Checked on 2026-10-12: the HTML reporter, which uses the UI's client,
  generates its report with vsnap's projects. Still to check: the UI
  itself, coverage (no coverage package is installed in this repo), and the
  VS Code extension.
  Checked on 2026-10-13, in a scratch project from a packed install: the UI
  (`vitest --watch --ui`) lists vsnap's projects and tests, and a failed
  image shows Vitest's Visual Regression panel, with Diff, Reference, Actual
  and Slider views, and the message with its `-u` command. Coverage with
  `@vitest/coverage-v8` and with `@vitest/coverage-istanbul` both run with
  the visual tests, whose images still compare identical, and count the
  views they draw. Still to check: the VS Code extension (the user).
- [ ] **U10. A failed image's error points into vsnap.** In the UI and the
  terminal, its stack names `node_modules/vsnap/lib/browser/visual-test.js`,
  not the `canvasTest` line in the test file, as Vitest's own assertions
  do. vsnap could keep the declaration's stack and give it to the error.
- [ ] **U11. The UI's Test Meta panel shows vsnap's internal record** of
  each test (`visual`: kind, outcome, size, timings), which the reporter
  reads. Harmless, but noise to a user. Consider a less prominent place, or
  a shorter record.
- [ ] **U12. The reference checks rarely run in real CI.** They never run
  under `--shard`, and one lasting `.skip` turns them off for good. The
  hash check doesn't depend on which tests ran, so it could always run;
  skipped tests' references could count as used, by their names.
- [ ] **U13. Check failures look like crashes:** unused and shared
  references print under Vitest's "Unhandled Errors". Give them a heading
  of their own, or fail them in a test module.
- [ ] **U14. An error in `vsnap.config.ts`** fails each file, as "Failed to
  import test file .../setup.ts", where the README says it stops the run.
- [ ] **U15. The summary:** "1 differ" should read "1 differs"; "in X s"
  counts from the run's start, unit tests included; it's long, repeats on
  every watch rerun, and can't be quietened.
- [ ] **U16. Speed at scale:** every complete run decodes every reference
  (4.7 ms each, about 2.3 s per 500), and globs the root three times; every
  Vitest start, `-p unit` included, fingerprints the repository and reads
  every visual test file (120 ms here). Cache the checks by size and time.
- [ ] **U17. The browser install check costs 0.4 s each run,** and prints
  to standard output during a download. Check for the executable first.
- [ ] **U18. Smaller:** a headed browser (`--browser.headless=false`) gets
  a message that blames Playwright's version (likely); old actual and diff
  images in `.vitest/vsnap/` are never cleaned; `recordArtifact` uses
  Vitest's `'internal:toMatchScreenshot'` type, an internal contract.

## Documentation

From the 2026-10-13 review, where the README disagrees with the code.

- [x] **D1. "Copies of references are never deleted"** is false for
  non-default layouts (B8), in the README and in `references.ts`.
  Done on 2026-10-13, with B7 and B8. The README also says now that
  after a change of layout the old files are left, to delete by hand: the
  run no longer finds them, as it did only because its globs were too wide.
- [ ] **D2. "Nothing needs installing beyond `npm ci`"** leaves out the
  browser download on the first run (about 100 MB), Linux's system
  libraries (`playwright install-deps`), and caching it in CI.
- [ ] **D3. Smaller disagreements:** the `canvas` kind takes no
  `background`; `readCanvas` doesn't read a canvas drawn smaller; the font
  list rule is stricter than the code, and missing glyphs (B9) aren't
  mentioned; the Configuration example's unit project lacks
  `extends: true`; kind errors fail each file, not the run; the dark colour
  scheme and reduced motion that HTML views get aren't mentioned; "up to
  15x faster" has no benchmark behind it.
- [ ] **D4. Presentation:** about a quarter of the README is for vsnap's
  maintainers (its own config, its layout, the build); move it to a
  CONTRIBUTING file. Missing: the options of each kind in one place, a CI
  recipe, troubleshooting, and how to review a diff in the Vitest UI.
  Lines 93, 257, 269 and 507 aren't wrapped, and "html views" should read
  "HTML views".
  Partly done on 2026-10-13: the maintainers' material is in a new
  `CONTRIBUTING.md` (vsnap's own tests, the layout, the environment and
  upgrading Playwright, the blank font, building and publishing), and the
  README links to it; the lines are wrapped. Still to write: the options of
  each kind in one place, a CI recipe, troubleshooting, and reviewing a
  diff in the Vitest UI.

## The rest of 042, step 10

- [ ] The final logo: the SVG in the repo, an icon size for npm, a
  favicon, a settled colour, and a wordmark if the README wants one.
- [ ] Publishing with changesets, as the `@mvtjs` libraries are.
- [ ] A trial on another project, from a packed install (see P5 and P7).
  A scratch project passed on 2026-10-12. A real project is still to try.
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
- [ ] finalise standard paths for reference images

