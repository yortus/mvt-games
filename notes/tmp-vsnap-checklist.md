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


## API and design


## Watch mode


## Smaller items


## Usability

- [x] **U5. Check the tools around Vitest:** the VS Code Vitest extension
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
  Done on 2026-10-13: the user confirmed the VS Code extension, the Vitest
  UI, and coverage with `@vitest/coverage-v8` in this repo. Earlier, in a
  scratch project from a packed install, the UI showed a failed image in
  its Visual Regression panel, and coverage with both v8 and istanbul ran
  with the images still identical.
- [x] **U6. Terminal output from a full run of the visual tests.** Currently
  the final output of a run (all the summary informantion of various kinds) looks disorganised and hard to parse. Improve this using colour, better organisation, clearer separation and spacing, possibly tables, etc.
  Done on 2026-10-13: the summary is laid out as Vitest's own: a `vsnap`
  badge, a table (images by outcome, each kind's count, median and 95th
  percentile in columns, the references, the duration), then a titled
  section per list, with a dim note under its title. Each test is named by
  its file and name, since the names no longer repeat the view. Outcomes
  are green or red by whether they passed, and the checks' FAIL block has
  a red badge. Colour follows Vitest's rules (`node:util`'s `styleText`, no
  new dependency), and GitHub's job summary gets the plain text.
  Paths are relative to the project's root, as Vitest shows its test files,
  and in a terminal a row's path loses folders from its middle to fit the
  terminal's width (`src/…/visual-tests/bandit-view.test.tsx`). The
  smooth images drawn smaller are listed last, as "Downsampled
  references", with no explanation in the output; the README's
  `maxPixels` explains it. The sections' notes say only what to do.

## Documentation

- [ ] **D1. Update the documentation:** Shorten the README to typical public package length and content (eg installation, usage, API, examples, contributing, license - take this list as inspiration only) and moved detailed explanations to separate docs pages. Puts separate docs pages in a `docs` folder or similar location. Ensure there is a ToC.
- [ ] **D2. More compelling docs:** We need to hook the reader not bore them to death. Start the README with the headline benefits. We need to get the "15x faster" claim back, but this time with evidence and context that make it credible and compelling. Use layout and visuals better. Put the 'Cut V' logo in. Add badges, tables, lists, etc.

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

