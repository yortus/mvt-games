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
findings were fixed in `1efaf75`, `57616b3` and `b6606d3`. The items below
come from the blind review of 2026-10-15.

## Bugs

- [x] **B2: A local run deletes unused references, in watch reruns too**
  (checked, `src/node/reporter.ts` `runChecks` and `settleOrphans`).
  Comment out a test and save, and the rerun deletes its reference. If that
  reference was new and not yet committed, it is gone for good. Vitest
  deletes obsolete snapshots only with `-u`. B1's option 4b (2026-10-14)
  chose this, for renames. To decide: delete only in a run that isn't a
  watch rerun; or only references that git tracks, which can be got back;
  or move them to `.vitest/vsnap/deleted/` instead of deleting them; or
  delete only with `-u` again.
  Done (2026-10-15), as recommended: a run deletes only references that git tracks (`listTrackedFiles`, staged ones included; none if git can't say), and a watch rerun deletes none unless it updates (`u`). The summary lists kept ones under "Unused references", with the reason. Checked end to end on the fixture, the watch rerun through Vitest's Node API.
- [x] **B3: HTML captures crop anything outside the element's box**
  (checked, `src/browser/html-image.ts`: the capture is the host's
  rectangle). Box shadows, outlines, focus rings and overflow from
  transforms are cut off, which hits `act` tests that focus a control.
  Pixi gets a 4 px margin; HTML gets none, and has no option for one. To
  decide: a margin by default, as Pixi has, or a `margin` option, or
  measuring the overflow.
  Done (2026-10-15): an HTML test's `margin` option, 0 by default, so no reference changed. Still to decide: whether the default should be 4, as Pixi's is, which would change every HTML reference.
- [x] **B4: A root with `position: fixed` or `absolute`** (likely), such as
  a modal overlay, leaves the inline-block host 0x0, which probably fails
  with a confusing message. Try it; then size the host to the element, or
  say what to do.
  Done: the host is sized to an absolute or fixed root's right and bottom edges; an empty view gets its own message. Test: "a root with position: fixed".
- [x] **B5: `prepare` and `act` see the page before its rules** (checked,
  `src/browser/html-image.ts`): font sizes aren't rounded yet, and shadow
  roots still have system fonts. The docs suggest measuring layout in
  `act`, and such a measurement can differ between systems. Apply the rules
  and the rounding before `prepare` too, as well as after `act`.
  Done: the rules and the rounding come before `prepare`, and again after `act` (`quantizeFontSizes` returns a step that takes its rounding off). No reference changed.
- [x] **B6: Pixi framing depends on how many sizes a test gives** (checked,
  `src/pixi/pixi-image.ts`): with `width` alone, the image starts at the
  view's bounds less the margin; with both, at (0, 0). Writing Tests'
  `{ width: 320 }` example hits the first case. Pick one rule, and
  document it.
  Done: each axis on its own (one with a size runs from 0, one without is framed by the bounds). No existing test gave one size. Test: "at a fixed width, framed by its bounds in height".
- [x] **B7: Canvas text gaps** (checked, `src/browser/canvas-text.ts`):
  `letterSpacing: '0.5em'` is read as 0.5 px (`parseFloat`); `textAlign`'s
  `start` and `end` ignore `direction: rtl`; the generic families
  `cursive`, `fantasy`, `emoji`, `math` and `fangsong` are unknown, so a
  test that uses them fails.
  Done: letter spacing resolved by CSS (any unit), `start`/`end` by direction, the five families added. Test: "canvas text, spaced in em and aligned right to left".
- [x] **B8: `crypto.getRandomValues` and `crypto.randomUUID` aren't seeded**
  (checked: only `Math.random` is). A view that uses them draws differently
  each run. Seed them as `Math.random` is, or document the gap.
  Done: seeded from a second generator, so a `crypto` call doesn't shift `Math.random`; `Math.random`'s numbers are unchanged. Vitest's page code uses `crypto.randomUUID` only for its `cdp()` listeners' IDs.

## Before publishing


## API and design

- [ ] **A6: The pose gets no test context, and there's no `.extend`.**
  Shared setup, such as loading a spritesheet once, lives at module level
  or in `beforeAll`. Consider passing Vitest's test context to the pose,
  after a case's arguments, and supporting `.extend` for fixtures.
  Not done: a design decision. Vitest 5 still finds the fixtures that a test uses by parsing its function's source (`getUsedProps`), so `.extend` would need v-snap to rebuild each pose's destructuring. Passing the context after a case's arguments would also change what a pose passed by reference, with optional parameters, receives.
- [x] **A7: Pixi views can't reach v-snap's shared renderer.** A view that
  calls `renderer.generateTexture` has no supported way to get it. Consider
  giving it to `pixiViews()`'s `prepare`, or exporting a way to get it.
  Done: `getPixiRenderer()` from `v-snap/pixi`. It applies the test's pixel rounding, since a texture made after a pixel-art test came out rounded otherwise (reproduced).
- [x] **A8: `threeViews()` can't set defaults for `width`, `height` and
  `camera`**, so three.js tests repeat `{ kind, width, height, camera }`.
  Let the kind's registration set them, as `pixiViews()` sets `pixelArt`.
  Done: `threeViews({ width, height, camera, scene })`; the tests' types make the given ones optional (`ThreeTestOptions`).
- [ ] **A9: A way past the text scan for declarations.** Kinds are found by
  reading each file's text for `canvasTest(` and `htmlTest(`, which rules
  out helpers and aliases. A file name or glob for each kind, such as
  `*.html.test.tsx`, would be an escape hatch. Low priority.
  Not done: a config design choice, low priority.

## Watch mode


## Smaller items

- [x] **S2: `content: url()` images aren't preloaded** (checked:
  `IMAGE_PROPERTIES` in `src/browser/html-image.ts` leaves out `content`).
  Done.
- [x] **S3: An orphan doc comment in `src/browser/visual-test.ts`**, above
  `AnyPose` ("Vitest's `test`, or one of its modifiers ..."), which belongs
  to nothing.
  Done.
- [x] **S4: Old fingerprint files pile up in `.vitest/vsnap/`.** Since
  2026-10-14 each is named for the call's name and root, so the old
  `<name>.sources-fingerprint` files stay. Delete the old one when writing
  the new one.
  Done: `recordFingerprint` deletes the call's old-style file. Files for other roots stay, since another config may use them.
- [ ] **S5: HTML test files run one at a time** (`fileParallelism: false`
  in `src/node/config.ts`), though each has a page of its own. Find out
  whether the HTML project can run files in parallel (DevTools sessions,
  calibration once per run, the reporter's state), for suites with many
  HTML tests.
  Investigated (2026-10-15): with `fileParallelism: isHtml`, the site's 3 HTML files passed 3 runs, 4.4 s to 3.9 s, since each page calibrates itself. But Vitest then refuses projects with different `maxWorkers` and one `sequence.groupOrder`, so v-snap's two projects would need group orders of their own, which changes the order of a whole run. Reverted; not worth it for now.

## Usability

- [x] **U3: The environment message names Chrome builds, not Playwright
  versions** (`src/browser/calibration.ts`). It should say which Playwright
  v-snap needs (its peer range), which one this run resolved and from
  where, and how to fix it, such as "v-snap 0.3.0 needs Playwright 1.64.x;
  this run resolved 1.63.0 from <path>; reinstall."
  Done: `src/node/playwright-advice.ts`. Seen against a real mismatch: the main checkout still had Playwright 1.63.0 installed after the 1.64 bump (now reinstalled).

## Documentation

- [x] **D4: "Each letter keeps its width" is wrong** (README "What It Gives
  Up", How It Works). Every glyph of the blank font is 0.625 em wide, so
  wrapping, truncation with an ellipsis and widths that fit text differ
  from the real page. Say so plainly, in Limits and Rules too.
  Done: README, How It Works, and a new bullet in Limits and Rules.
- [x] **D5: Small inconsistencies.** The unit project's `exclude` glob
  differs between Getting Started (`'**/visual-tests/*.test.{ts,tsx}'`) and
  Configuration (`'**/visual-tests/**'`). Writing Tests' definition of a
  file's stem leaves out `.spec`. Limits and Rules says "generic families
  ... and the like"; list them (with B7).
  Done.
- [x] **D6: The README's licence line points at `src/browser/fonts/`**, but
  the published package has the fonts in `lib/browser/fonts/`, and only
  their licences in `src/browser/fonts/`.
  Done.
- [x] **D7: Missing guidance.** An example for Views That Change Over Time
  (three sentences today); fixtures and asset loading (module level,
  `beforeAll`); `vi.useFakeTimers`; `crypto` (with B8); that a flat
  config's `globalSetup` stays at the root, where Vitest runs it once, not
  in each project; and how Pixi framing works with one size (with B6).
  Done: an update-function example and a fake-timers example (tested: "a view on real time, held still with fake timers"), Shared Setup and Assets, `crypto`, `globalSetup` in Configuration, and one-size framing (with B6).
- [ ] **D3:** Thoroughly review the vsnap README and docs in the vsnap package.
  From the 2026-10-15 review, for it: some sentences read stilted and dense
  ("17 times less than ..."), and Image Names and Where Files Go are long
  for options most people won't touch, so they could move lower.
  - Apply docs skills to improve clarity and accessibility throughout.
  - Make the README shorter, punchier, with clear opening motivation.
  - First pass done (2026-10-15), for review: the README rewritten, with
    the problem and v-snap's answer first and the example earlier; Image
    Names and Where Files Go moved to the ends of their pages; Kinds of
    View's kinds as subsections; dense paragraphs split on every page;
    code samples within 80 columns; two broken anchors fixed.
    CONTRIBUTING.md too: brought up to date (`withVsnap`, `getPixiRenderer`,
    the Playwright advice) and its upgrade steps completed (docs' version,
    changeset, the website's visual tests).

## Miscellaneous
