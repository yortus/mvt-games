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
- [x] **B9. Missing glyphs pass when they change** (reproduced). The test
  fonts lack ★ ☆, emoji, CJK and, in the sans font, █. Each draws the same
  empty box (glyph 0), so three filled stars and three empty ones give the
  same image. Fix: fail a test whose canvas text maps a character to
  glyph 0, as unpinned font families fail, naming the characters.
  Done on 2026-10-13, without failing such tests, which would lock out
  views with symbols or emoji: each missing character is drawn as a box
  with its code point in hex digits, from the mono test font, as a system's
  fallback font does. â˜… and â˜† now draw differently (a test checks that),
  and a visual test shows the boxes.
- [x] **B10. HTML captures of CSS animations are flaky** (reproduced: 3
  of 4 runs failed). Nothing freezes animations or transitions
  (`src/browser/html-image.ts`); `reducedMotion: 'reduce'` only affects CSS
  that asks for it. Fix: as Playwright's `animations: 'disabled'` does,
  finish finite animations and cancel infinite ones, turn transitions off,
  and wait a frame.
  Done on 2026-10-13: before an HTML capture, `settleAnimations` finishes
  each animation and transition that ends, cancels each that never ends,
  and waits two frames; a text field's caret is hidden. A visual test of a
  spinner and a fade repeats three times against one reference.
- [x] **B11. Text in shadow DOM isn't blanked** (reproduced). The blank
  font rule (`src/browser/html-rules.ts`) and the steps that quantize font
  sizes, pixelate rotated images and load style images don't reach into
  shadow roots, so web components draw real text in the system's fonts.
  Fix: add the rules to each open shadow root (`adoptedStyleSheets`), and
  walk shadow roots in those steps.
  Done on 2026-10-13: each open shadow root adopts the page's rules, and
  the steps that round font sizes, pixelate rotated images, load style
  images, decode images and settle animations walk into open shadow roots.
  A closed shadow root can't be reached; the README says so. Tested with a
  visual test and a check of the computed font.
- [x] **B12. One malformed visual test file breaks every run** (reproduced),
  `-p unit` and the VS Code extension's discovery included, because
  `findVisualTestFiles` throws at config load. Fix: report it from vsnap's
  projects instead, so other projects still run.
  Done on 2026-10-13: such a file is left out of the projects, with a
  warning when the config loads. A run of the visual tests fails over it,
  after running the others; `-p unit` only warns. Checked with an empty file
  in the website.
- [x] **B13. A root `test.browser` leaks into vsnap's projects**
  (reproduced). With `extends: true`, a root `browser.instances` adds
  instances, so each visual file runs again in another browser, uncounted,
  and races vsnap's instance when writing new references. Fix: set
  vsnap's own instances so nothing is added, or stop the run, as for
  inherited `include` and `setupFiles`.
  Done on 2026-10-13: the reporter stops the run when a project that no
  vsnap() call made runs vsnap's setup file, and says to move the browser
  settings. Checked in the packed trial with a root browser.instances. A
  named extra instance is stopped by Vitest itself first, since its name
  repeats across vsnap's two projects.
- [x] **B14. A long test name fails with a raw ENOENT** (reproduced at 300
  characters; a name over 255 bytes would fail on Linux). Fix: cap image
  names, with a short hash of the full name, and a clear message.
  Done on 2026-10-13: a name over 100 bytes (UTF-8) is cut between
  characters, and an 8-digit hash of the whole name is added. Unit tests,
  and a 300-character name in the packed trial.
- [x] **B15. Image names that differ only in case collide on macOS**
  (checked). `toFileKey` folds case only on Windows. Fix: compare names
  case-insensitively on every platform when looking for shared references.
  Done on 2026-10-13: used references are grouped case-insensitively on
  every system, so 'Red' and 'red' fail as sharing a reference, with a note
  about case; both paths still count as used. Checked in the packed trial.
- [x] **B16. Smaller bugs** (each checked by reading, or reproduced):
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
  Done on 2026-10-13, all five: the font fetch names the URL and status,
  and points at server.fs.allow; `export { config as default }` passes the
  check; engines is `>=22.17`, where Node's release notes list fs.glob as
  stable; a default root that differs from Vitest's stops the run and asks
  for `root` (checked with `--root`); and the README says to make a Pixi
  texture in the pose if pixel art and smooth tests share it. Also, the
  repository's root shows as '.' in messages.

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
- [x] **A17. Playwright `~1.63.0` makes upgrades lockstep** for projects
  that use Playwright for other tests. A deliberate trade-off: say so
  plainly in the README's Requirements.
  Done on 2026-10-13, with D2: Requirements says a project that uses
  Playwright for other tests upgrades it when vsnap does.

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
- [x] **U10. A failed image's error points into vsnap.** In the UI and the
  terminal, its stack names `node_modules/vsnap/lib/browser/visual-test.js`,
  not the `canvasTest` line in the test file, as Vitest's own assertions
  do. vsnap could keep the declaration's stack and give it to the error.
  Done on 2026-10-13: each declaration keeps its stack (the call in the
  test file), and an error that vsnap threw, such as a changed or blank
  image or a view of the wrong kind, takes that stack, without vsnap's
  frames or the runner's (`src/browser/declaration.ts`). So Vitest's code
  frame shows the `canvasTest` line, in the terminal and the UI. An error
  that the pose or a library threw keeps its own stack. Checked in the
  website (a changed image, a pose that throws) and from a packed install.
- [ ] **U11. The UI's Test Meta panel shows vsnap's internal record** of
  each test (`visual`: kind, outcome, size, timings), which the reporter
  reads. Harmless, but noise to a user. Consider a less prominent place, or
  a shorter record.
- [x] **U12. The reference checks rarely run in real CI.** They never run
  under `--shard`, and one lasting `.skip` turns them off for good. The
  hash check doesn't depend on which tests ran, so it could always run;
  skipped tests' references could count as used, by their names.
  Done on 2026-10-13: every run checks references. A test that recorded no
  image (skipped by .skip, .only, .todo or -t, or failed early) uses the
  reference its full name gives, computed in Node by `toImageName`, which
  moved to `src/image-name.ts` so both sides import it. A run of every file
  checks every reference; a partial run (a shard, one file, a watch rerun)
  checks those of the files that ran, leaving out images that a file that
  didn't run could own. Checked with -t, one file, another file, two
  shards, and -u on one file.
- [x] **U13. Check failures look like crashes:** unused and shared
  references print under Vitest's "Unhandled Errors". Give them a heading
  of their own, or fail them in a test module.
  Done on 2026-10-13: as Vitest's coverage thresholds do, a failed check
  prints its own block (' FAIL  vsnap's checks ...') after the summary, sets
  the exit code, and, in GitHub Actions, adds an error annotation. No more
  "Unhandled Errors". The checks now run in onTestRunEnd, which also fixed
  them never running under --shard.
- [x] **U14. An error in `vsnap.config.ts`** fails each file, as "Failed to
  import test file .../setup.ts", where the README says it stops the run.
  Done on 2026-10-13, in the README: such an error fails every visual
  test file, under "Failed to import test file", and the other projects
  still run. Stopping the run instead would need vsnap to run the file in
  Node, which it avoids, since the file belongs to the page.
- [x] **U15. The summary:** "1 differ" should read "1 differs"; "in X s"
  counts from the run's start, unit tests included; it's long, repeats on
  every watch rerun, and can't be quietened.
  Done on 2026-10-13: "1 differs"; the time counts from the first visual
  file's start; a partial run, such as a watch rerun, gets a short summary,
  without the slowest tests and the largest references. No option to quiet
  it further.
- [x] **U16. Speed at scale:** every complete run decodes every reference
  (4.7 ms each, about 2.3 s per 500), and globs the root three times; every
  Vitest start, `-p unit` included, fingerprints the repository and reads
  every visual test file (120 ms here). Cache the checks by size and time.
  Done on 2026-10-13: checks that passed are cached by size and time in
  `.vitest/vsnap/reference-checks.json`, and the run finds its references
  once, for the checks and the summary. The config-load cost (fingerprint,
  reading test files) stays.
- [x] **U17. The browser install check costs 0.4 s each run,** and prints
  to standard output during a download. Check for the executable first.
  Done on 2026-10-13: the step looks for Playwright's install marker
  (`chromium_headless_shell-<revision>/INSTALLATION_COMPLETE`, the revision
  from playwright-core's browsers.json) and runs the installer only when it
  is missing, or when unsure; 42 ms instead of 0.4 s. The installer's output
  goes to standard error.
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
- [x] **D2. "Nothing needs installing beyond `npm ci`"** leaves out the
  browser download on the first run (about 100 MB), Linux's system
  libraries (`playwright install-deps`), and caching it in CI.
  Done on 2026-10-13: the intro and Requirements say the first run
  downloads Chrome Headless Shell (about 100 MB) into Playwright's cache,
  that a bare Linux system needs `npx playwright install-deps chromium`,
  and that Playwright upgrades go with vsnap's (A17). A new "In CI"
  section gives a GitHub Actions recipe, taken from this repo's workflow.
- [x] **D3. Smaller disagreements:** the `canvas` kind takes no
  `background`; `readCanvas` doesn't read a canvas drawn smaller; the font
  list rule is stricter than the code, and missing glyphs (B9) aren't
  mentioned; the Configuration example's unit project lacks
  `extends: true`; kind errors fail each file, not the run; the dark colour
  scheme and reduced motion that HTML views get aren't mentioned; "up to
  15x faster" has no benchmark behind it.
  Done on 2026-10-13, each one: background is for Pixi, three.js and HTML
  views; readCanvas reads at full resolution; the font rule says what the
  code knows; missing glyphs (with B9); the Configuration example has
  `extends: true`; kind errors fail each file (with U14); the dark colour
  scheme and reduced motion are mentioned; "up to 15x" is gone.
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

