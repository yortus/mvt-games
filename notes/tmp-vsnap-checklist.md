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

- [x] **D1. Update the documentation:** Shorten the README to typical public package length and content (eg installation, usage, API, examples, contributing, license - take this list as inspiration only) and moved detailed explanations to separate docs pages. Puts separate docs pages in a `docs` folder or similar location. Ensure there is a ToC.
  Done on 2026-10-13: the README is 228 lines (from 848): benefits, the
  speed table, a taste, a changed image, a quick start, a Documentation
  section that lists every guide and what it covers, an API table,
  requirements, contributing and licence. The rest moved, mostly
  unchanged, into eight guides in `docs/`, each with its own contents
  list: getting started, writing tests, kinds of view, configuration,
  running the tests, how it works, limits and rules, troubleshooting.
  `package.json` gained `repository`, `homepage`, `bugs` and `keywords`, as
  the `@mvtjs` libraries have, so that npm can resolve the README's
  relative links and images.
- [x] **D2. More compelling docs:** We need to hook the reader not bore them to death. Start the README with the headline benefits. We need to get the "15x faster" claim back, but this time with evidence and context that make it credible and compelling. Use layout and visuals better. Put the 'Cut V' logo in. Add badges, tables, lists, etc.
  Done on 2026-10-13: the logo (as drawn in 042, `#7c5cff`), a tagline,
  badges, six headline benefits, and a real failed test's reference,
  actual image and diff side by side. The speed claim comes from a new
  benchmark, `npm run bench -w vsnap` (`bench/`), with the same 1000 Pixi
  images in 100 files checked by vsnap and by Vitest's `toMatchScreenshot`,
  in the same browser. Medians of 3 runs on this laptop: vsnap 7.8 s
  (4.0 ms an image); `toMatchScreenshot` in one page 89.9 s (67 ms, so
  11.5x for the run and 17x an image); with Vitest's defaults, 13 pages at
  once, 18.0 s (131 ms, 2.3x and 33x). So the README says 17x an image and
  11.5x like for like, and gives the 2.3x too, with the reason, rather
  than "15x". The 4-core CI case is reasoned, not measured. Still open: an
  npm version badge once it's published, and the logo's colour.

## The rest of 042, step 10

- [ ] The final logo: the SVG in the repo, an icon size for npm, a
  favicon, a settled colour, and a wordmark if the README wants one.
- [x] Publishing with changesets, as the `@mvtjs` libraries are.
  Done on 2026-10-13: `.changeset/v-snap-first-release.md` bumps v-snap
  from 0.0.0 to 0.1.0, on a version of its own, outside the `@mvtjs` fixed
  group. The release workflow also runs v-snap's unit tests, and
  `changeset publish` runs its prepack (the build, the published
  package.json, publint and attw). `.changeset/README.md` says so.
- [ ] A trial on another project, from a packed install (see P5 and P7).
  A scratch project passed on 2026-10-12. A real project is still to try.
- [ ] Publish.
  UPDATE 2026-10-13: tried and failed to publish. Error: npm error 403 403 Forbidden - PUT https://registry.npmjs.org/vsnap - Package name too similar to existing packages asap,gsap,soap; try renaming your package to '@yortus/vsnap' and publishing with 'npm publish --access=public' instead
  The user published `v-snap` instead (0.0.0-stage and 0.0.0), as a
  placeholder: its code still named itself `vsnap`, so it doesn't work
  installed. The package is now `v-snap` everywhere a person reads or types
  it (folder `packages/v-snap`, imports, messages, docs); the code's names
  stay `vsnap` (`vsnap()`, `defineVsnapConfig`, `vsnap.config.ts`,
  `.vitest/vsnap/`, the PNG keyword). A packed install that imports
  `v-snap`, `v-snap/vitest` and `v-snap/pixi` passed on 2026-10-13.
  Left for the user: set trusted publishing for `v-snap` on npmjs.com
  (repository `yortus/mvt-games`, workflow `release.yml`); run
  `npm run release`, commit, push to `main`; then
  `npm deprecate v-snap@"<0.1.0" "A placeholder. Use 0.1.0 or later."`
- [ ] Archive 042, and delete the `visual-tests` worktree.

## Outside vsnap

- [x] Rerun the website's thumbnail script, which changed with the
  whole-entry tests. The user runs it, since it launches the installed
  Chrome, and each new Chrome profile risks a failed Windows logon.
- [ ] Commit chunk 10 and the rounds since it in main (the user).
- [ ] Stop the docs dev server that serves the worktree, when it's no
  longer needed.

## Miscellaneous
- [ ] Thoroughly review the docs pages that mention visual testing
- [ ] Thoroughly review the vsnap README and docs in the vsnap package

