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

The items marked 2026-10-14 come from that day's blind review. Its other
findings were fixed in `1efaf75`, `57616b3` and `b6606d3`.

## Bugs

- [ ] **B1: Check failures show only in v-snap's own block** (2026-10-14 B1,
  checked). Unused references and hash mismatches print after the summary
  and set the exit code, as coverage thresholds do. Vitest's summary, the
  UI, the IDE extension and the JSON and JUnit reporters show the run as
  passed. Reporting them through Vitest, as an unhandled error or a
  synthetic failed test, would fix that, but U13 (2026-10-13) moved them
  out of "Unhandled Errors" on purpose. The reporter's header and
  `docs/running-tests.md` now describe the current behaviour. Decide
  whether to keep it.

## Before publishing


## API and design

- [ ] **A1: A step for an HTML test after its view is in the page**
  (2026-10-14 A1, checked). The pose runs before the element is mounted,
  and `prepare` belongs to the kind, not the test. So a test can't pose
  `:hover`, `:focus-visible`, an open dropdown, `userEvent` or anything
  that measures layout. To decide: the option's name, and whether it runs
  before or after the kind's `prepare`. (`src/browser/visual-test.ts`,
  `html-image.ts`)
- [ ] **A2: A configurable viewport and colour scheme** (2026-10-14 A2,
  checked). The viewport (1280x800), `colorScheme: 'dark'`,
  `reducedMotion` and `testTimeout: 30_000` are fixed, and `vsnap()`
  passes no project options through, so breakpoints and light themes can't
  be tested. Either changes the environment that the calibration set
  checks, so each would join the environment fingerprint.
  (`src/node/config.ts`)
- [ ] **A3: A policy for other browser builds** (2026-10-14 F3). The peer
  range `playwright: ~1.63.0` and the exact `HeadlessChrome` build in
  `visual-environment.json` mean a project pinned to another Playwright
  can't use v-snap, and a changed build stops every run until v-snap
  ships. `VSNAP_MODE=environment` rewrites files inside the installed
  package, so it's no way out. Consider a documented mode that runs and
  reports but never writes, and state the upgrade policy.
- [ ] **One image per test** (2026-10-14 A6, a design note). No per-test
  tolerance, and no image name other than the test's, so renaming a test
  renames its reference. The two config files and the `Register`
  declaration are real learning cost. Probably keep, but worth a
  conscious decision.

## Watch mode


## Smaller items

- [ ] **S1: Compute the sources fingerprint only when v-snap's projects run**
  (2026-10-14 B9). Every config load, `vitest -p unit` included, globs and
  stats every source file in the repo (about 90 ms). Coverage reports are
  now left out. `optimizeDeps.force` must be known when the config is
  built, which is what stands in the way. (`src/node/rebundle.ts`)

## Usability

- [ ] **U1: Accept one image, not the whole file** (2026-10-14 U2). The
  suggested `npx vitest run <file> -u` accepts every changed image in the
  file, and its text snapshots too. A `-t` form needs a shell-safe pattern
  from the test's full name, which Vitest matches against `fullTestName`.
  A `file:line` filter from the declaration is another way, though `.each`
  makes several tests of one line. (`src/browser/judge.ts`)
- [ ] **U2: Headed runs** (2026-10-14 U4). `--browser.headless=false` aborts
  the whole run, so a pose can't be looked at in a browser. Allow a headed
  run that compares but writes nothing. (`src/browser/calibration.ts`)

## Documentation

- [ ] **D1: Denser paragraphs** (2026-10-14 D7). Rules packed into paragraphs,
  such as the kinds' naming rules, would scan better as lists or tables,
  and the `vsnap.config.ts` sample is repeated three times. Fold into the
  docs review under Miscellaneous.
- [ ] **D2:** Thoroughly review the docs pages that mention visual testing
- [ ] **D3:** Thoroughly review the vsnap README and docs in the vsnap package

## Miscellaneous

- [x] **M1:** Commit chunk 10 and the rounds since it in main (the user).
- [x] **M2:** Stop the docs dev server that serves the worktree, when it's no
  longer needed.
  Stopped on 2026-10-14.
- [x] **M3:** The final logo: the SVG in the repo, an icon size for npm, a
  favicon, a settled colour, and a wordmark if the README wants one.
  Settled on 2026-10-14: the Ember scheme, amber `#ffb547`, coral
  `#ff7a50` and rose `#e8456b`, top to bottom, in
  `packages/v-snap/docs/images/logo.svg`; the README's licence badge takes
  the rose. No separate wordmark: the README's centred heading is one. npm
  has no package icon, and v-snap has no site of its own, so no icon sizes
  or favicon are needed. The amber top layer is faint on white (1.8:1); a
  light-page variant through `<picture>` is possible later.
- [ ] **M4:** A trial on another project, from a packed install (see P5 and P7).
  A scratch project passed on 2026-10-12. A real project is still to try.
- [x] **M5:** Archive 042, and delete the `visual-tests` worktree.
