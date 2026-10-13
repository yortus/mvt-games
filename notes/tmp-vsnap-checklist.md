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


## Before publishing

- [x] **P12. The new calibration images have run only on Windows.** Push
  the branch, and let the visual CI workflow run on Linux and macOS.
  Done on 2026-10-13: the visual workflow passed on Ubuntu, Windows and
  macOS for every change to the calibration images: d991d62 (run
  38127515803), 5b7e922 (run 38231974275), and the hash marker's
  re-encoding with today's changes, at daa95b1 (run 38374158216).

## API and design

- [x] **A11. "kind" means two things.** A test's `kind: 'pixi'` matches a
  view kind's `name`, while a `CanvasViewKind`'s own `kind` field is
  `'canvas'` or `'html'`, and `defaultView` names a kind too. Someone
  writing a kind will set `kind: 'sketch'`. Consider renaming the field.
  Done: a kind's name is now its `kind` (`{ kind: 'sketch', isView, draw }`),
  the field that said `'canvas'` or `'html'` is gone (only a canvas kind
  has `draw`), and the config's `defaultView` is `defaultKind`. The kind of
  page is `PageKind` inside vsnap, and `pageKind` in each test's meta, so
  every bare `kind` names a kind of view. `'html'` is reserved, as
  `'canvas'` was.
- [x] **A12. The entry points' names.** `defineVsnapConfig` comes from
  `vsnap` and `vsnap()` from `vsnap/config`, and `vsnap()`'s `config`
  option names `vsnap.config.ts`. Users will look for `defineVsnapConfig`
  in `vsnap/config`. Consider `vsnap/vitest` for the Node side, and
  another name for the option.
  Done: the Node side is `vsnap/vitest`, named for the file it goes in, as
  unplugin's `<package>/vite` is. The option is `vsnapConfig`, beside
  `viteConfig`. Every "config" in vsnap now means `vsnap.config.ts`.

## Watch mode

- [x] **W4. The VS Code extension may not see new visual files** unless it
  runs Vitest in watch mode, since the restart needs `config.watch`
  (unverified).
  Confirmed by the user on 2026-10-13: it doesn't. The extension matches a
  new file against each project's `include` and `exclude`, as read when it
  started, and vsnap's projects list their files explicitly. The Test
  Explorer's refresh button reads the configs again and shows the file.
  The README's Watch Mode section says so. Giving the canvas project the
  real globs was considered and left out: a new HTML file would land in the
  canvas project, and a new file's libraries would be bundled mid-run.


## Smaller items


## Usability

- [ ] **U5. Check the tools around Vitest:** the VS Code Vitest extension
  (does it list and run visual tests?), the Vitest UI with browser
  projects, and coverage runs that include them.
  Checked on 2026-10-12: the HTML reporter, which uses the UI's client,
  generates its report with vsnap's projects. Still to check: the UI
  itself, coverage (no coverage package is installed in this repo), and the
  VS Code extension.
  2026-10-13: the VS Code extension lists and runs the visual tests (the
  user). Each website file showed an error at first: Vitest lists a file's
  tests in Node, and the website's Vite config gave Node no
  `@mvtjs/source` condition, so `@mvtjs/audio/headless` didn't resolve.
  Fixed in the website's config (`ssr.resolve.conditions`), with an entry
  in the README's Troubleshooting. A test declared in a loop shows as its
  name expression, such as `entry.id`, until it runs, since the listing
  reads the code without running it.
- [x] **U11. The names of the whole-entry test files.** The user finds
  `pixi-entries` and `element-entries` inconsistent, and suggests
  `pixi-entries` and `html-entries`. Both now name the entry's starter
  kind (`pixi` or `element`, as `EntryStarter` does), but that reads as a
  renderer beside an element. An element entry may draw with three.js or
  Pixi, which `html-entries` would hide; it is captured as HTML, though.
  `canvas-entries` and `html-entries` would name both by their test kind.
  Decide, and rename the files and their images.
  Done on 2026-10-13: `canvas-entries` and `html-entries`, which name both
  by their test kind, with their images renamed.
  Checked on 2026-10-13, in a scratch project from a packed install: the UI
  (`vitest --watch --ui`) lists vsnap's projects and tests, and a failed
  image shows Vitest's Visual Regression panel, with Diff, Reference, Actual
  and Slider views, and the message with its `-u` command. Coverage with
  `@vitest/coverage-v8` and with `@vitest/coverage-istanbul` both run with
  the visual tests, whose images still compare identical, and count the
  views they draw. Still to check: the VS Code extension (the user).

## Documentation


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
- [x] finalise standard paths for reference images
  Done: tests are in `visual-tests/` folders beside the views
  (`visual-tests/hud-view.test.tsx`), and each image is beside its test,
  named for the file's stem (`hud-view.HudView-at-the-start.png`). The new
  `{testFileStem}` variable keeps ownership exact from the path, and two
  files with one stem are refused. Helpers in the folder aren't test files,
  since they don't end in `.test.ts(x)`. The calibration sets moved to
  `src/browser/calibration-images/`.

