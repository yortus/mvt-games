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

- [ ] **P12. The new calibration images have run only on Windows.** Push
  the branch, and let the visual CI workflow run on Linux and macOS.

## API and design

- [ ] **A11. "kind" means two things.** A test's `kind: 'pixi'` matches a
  view kind's `name`, while a `CanvasViewKind`'s own `kind` field is
  `'canvas'` or `'html'`, and `defaultView` names a kind too. Someone
  writing a kind will set `kind: 'sketch'`. Consider renaming the field.
- [ ] **A12. The entry points' names.** `defineVsnapConfig` comes from
  `vsnap` and `vsnap()` from `vsnap/config`, and `vsnap()`'s `config`
  option names `vsnap.config.ts`. Users will look for `defineVsnapConfig`
  in `vsnap/config`. Consider `vsnap/vitest` for the Node side, and
  another name for the option.

## Watch mode

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
- [ ] finalise standard paths for reference images

