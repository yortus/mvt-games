# Arcade Code Review

| Field    | Value      |
| -------- | ---------- |
| Priority | high       |
| Created  | 2026-10-05 |
| Updated  | 2026-10-05 |

## Description

A review of everything uncommitted after 036's implementation (steps 1-8)
and its many rounds of layout and transition feedback: the Arcade
(`packages/website/src/arcade/`), the entry types, starters and catalogue
(`entries/`, `catalogue/`, every `<id>-entry.ts` and `<id>-starter.ts`), the
entry host (`runner/`), and the build scripts (`scripts/`). The old cabinet
and demos pages were only adapted to the new entries, and go in 036's step
9, so they were not reviewed. Reviewed against the
[code review skill](../../packages/docs/ai-agents/skill-code-review.md),
the [architecture rules](../../packages/docs/architecture/rules.md) and the
[style guide](../../packages/docs/reference/style-guide.md).

### Summary

The architecture holds. The arcade's model owns the search and the running
entry, and advances nothing with time. The views keep only presentation
state (the wall's layout, the selection, the transition, the search box's
highlight), the complex parts in view models with tests. The page's loop
runs the MVT order, and the entry host runs entries of any renderer in it.
Nothing allocates per frame where it matters. The debt is what quick rounds
leave: three bugs where features met (C1-C3); state held twice, contracts
wider than their users, and views that know each other's markup (S1-S6);
three files that grew past where they read easily (S7, S8, and the
transition's view model, S3); copies of the same code (S9-S11); and names
and comments still describing the zoom the transition replaced, and title
colours that are now card colours (T1, T2).

## Findings

Each is a checklist item: fixed when ticked. Paths are under
`packages/website/src/arcade/` unless given in full.

### Critical

- [x] **C1. The wall's burn canvas draws over the whole window every frame
  while an entry plays.** *Where:* `views/transition-view-model.ts`
  (`wallEffect`), `views/wall-effect-view.ts`. The way in sets the effect to
  `'burn'` and leaves it there until the way out, so the WebGL pass runs,
  under the runner, for as long as the entry does; a link straight to an
  entry (`holdGrown`) starts it too, with no cards. *Why:* hot-path cost
  (H-cost) spent on nothing visible, beside a game's own rendering.
  *How:* the effect goes to `'none'` once the page is blacked out (the end
  of `'entering'`), and `holdGrown` starts with `'none'`; the canvas then
  hides and stops drawing until the cards develop.
- [x] **C2. `/` focuses the search box while an entry plays.** *Where:*
  `views/search-bar-view.tsx` (`onPageKeyDown`). The box is hidden under the
  runner but takes the focus; the keys a game is played with then type into
  it, changing the search and the URL. *Why:* correctness; the wall's own
  keys already check `isActive`. *How:* a fixed-shape `isActive` binding
  (browsing, no info panel, no transition), as the wall's, gating `/`.
- [x] **C3. A refused launch leaves its card's picture behind.** *Where:*
  `views/arcade-view.tsx` (`launchedFrom`). The picture is kept before
  `model.launch`, and used at the next change of phase; if the model refuses
  the launch (it is not browsing), it stays, and a later launch from the URL
  starts from that stale card. *Why:* correctness, hidden coupling between a
  relay and a later update. *How:* forget it unless the launch began.

### Structural

- [x] **S1. The arcade model keeps the chosen tags twice, and writes
  through readonly types.** *Where:* `models/arcade-model.ts` (`active` and
  `chosen`), `models/arcade-query.ts`. `active` (sets by group) and `chosen`
  (chip indices, in order) must agree, and six `as Set<string>` casts write
  into `ActiveTags`, a readonly type. *Why:* one fact, one place;
  explicit dependencies. *How:* `chosen` is the state; the active tags are
  derived from it as the search changes. `noActiveTags` returns mutable
  sets, so nothing casts.
- [x] **S2. The arcade model's contract is wider than its users, and partly
  undocumented.** *Where:* `ArcadeModel`. `isShownAt` and `isChipActiveAt`
  have no users but a test; `entries`, `chips`, `phase`, `removeChipAt`,
  `restart`, `dismissLoadFailure`, `openInfo`, `closeInfo` have no JSDoc;
  `ArcadePhase`, `startPlaying` and `searchText` still describe the zoom and
  a search by name and tags only. *Why:* narrow, documented contracts (Hyrum's
  Law). *How:* remove the two, document the rest, correct the stale ones.
- [x] **S3. The transition's view model is 700 lines, and its drawn state is
  30 flat getters.** *Where:* `views/transition-view-model.ts`. The state is
  three things: the picture (window, frame, tilt, border, opacity, scale,
  brightness), the stage (scale, brightness) and the tube's glow (opacity,
  size). *Why:* file length; a reader should see the shape at a glance.
  *How:* three readonly records, `picture`, `stage` and `glow`, updated in
  place (no allocation per frame), which the view reads as
  `transition.picture.x`. Its getters, about 90 lines, go.
- [x] **S4. The zoom's names outlived it.** *Where:* `ZoomRect`,
  `ZoomPicture`, the `.zoom-*` classes, and comments in a dozen places
  ("zooms into it here", "for the zoom to start from"). The rectangle type
  also lives in the transition's module, though the card's geometry uses it.
  *Why:* names that mislead cost every reader. *How:* `Rect` in a module of
  its own (`views/rect.ts`); `PhotoPose` (where a card's photo is drawn) in
  `card-photo.ts`, beside the card's other geometry; `ZoomPicture` becomes
  `PicturePose` (a photo's pose, and the whole picture behind it); the
  classes become `.transition-*`; the comments say what happens now.
- [x] **S5. A launch is reported as three loose values.** *Where:*
  `CardViewBindings.onLaunchPressed(from, tilt, border)`, passed on by
  `CardWallView`. Two of them are numbers that would swap without a type
  error. *Why:* the style guide's case against ordered parameter lists.
  *How:* report one `PhotoPose`.
- [x] **S6. Views know each other's markup.** *Where:* `ArcadeView` finds a
  card with `wall.querySelector('.card[data-entry=…]')`; `CardWallView` finds
  and tests `.card-link`, `.card-polaroid` and `.card-info`. A card's
  height, `columnWidth + 2 * CARD_BAND_HEIGHT`, is written out twice in
  `ArcadeView`. *Why:* contract-driven coupling; a class renamed in one file
  breaks another silently. *How:* `card-view.tsx` exports the few questions
  others ask of a card (`linkOf`, `isOnPolaroid`, `isOnInfoButton`,
  `photoPoseOf`), `card-wall-view.tsx` exports `photoPoseIn(wall, entryId)`,
  and `card-photo.ts` exports `cardHeightFor(columnWidth)`.
- [x] **S7. `ArcadeView` does too much.** *Where:* `views/arcade-view.tsx`,
  270 lines: the header (marquee, about, search, and measuring when the
  search wraps) beside the wall, transition, runner and keys. *Why:* single
  responsibility; the top view should read as the page's outline. *How:* an
  `ArcadeHeadView` takes the header, its `ResizeObserver` and its stacked
  state.
- [x] **S8. The wall effect's view is mostly WebGL plumbing.** *Where:*
  `views/wall-effect-view.ts`, 314 lines, of which the view is 40: the rest
  is the painter, its 2D fallback and the shaders. *Why:* file length;
  isolate the part that is not MVT. *How:* `views/wall-painter.ts` takes the
  painters and shaders; the view keeps visibility, size and the refresh.
- [x] **S9. Focusing a panel as it opens is written twice.** *Where:*
  `EntryInfoView.focusOnOpen`, `PauseMenuView.focusOnOpen`: the same pending
  focus, retried each frame until the panel shows. *Why:* one fix, one place
  (the fault this works round was fixed in both, separately). *How:*
  `views/focus-on-open.ts`, a refresh step made by
  `focusOnOpen({ isOpen, target })`.
- [x] **S10. The two pixel letterings share their machinery by copy.**
  *Where:* `wordmark-view.ts` and `pixel-text-view.ts` each have an
  `svgElement` and a builder of runs of cells from rows of `#`. *How:*
  `views/svg-cells.ts` with both.
- [x] **S11. The search box works out its suggestions many times a frame.**
  *Where:* `views/search-bar-view.tsx`. Each chip's visibility, each group's
  (scanning every chip again), the highlight and the list's open state call
  `isSuggested`; and its `wordsOf` copies the model's `searchWordsOf`.
  *Why:* hot paths (repeated traversals); one source for a rule. *How:*
  `settle`, which runs before the children (parents first), fills
  preallocated `suggested` and `groupSuggested` flags once a frame; the
  children read them. The words come from the model's `searchWordsOf`.
- [x] **S12. The wall's refresh step does three jobs, and `observeSizes`
  does two.** *Where:* `views/card-wall-view.tsx`. *Why:* a step either
  orchestrates or does details. *How:* `refresh` calls `drawHeight`,
  `followActivity` and `giveFocus`; `observeSizes` becomes `attach`.

### Style

- [x] **T1. Card colours are named for titles.** *Where:* `TitleColor`,
  `TITLE_COLORS`, `TITLE_COLOR_VALUES`, `ArcadeEntry.titleColor` (eleven
  entries), `CardLook.titleColor`. The colour has been the card's since the
  swap. *How:* `CardColor`, `CARD_COLORS`, `CARD_COLOR_VALUES`,
  `cardColor`, `CardLook.color`.
- [x] **T2. Stale comments.** `ArcadeEntry.summary` ("for the entry's card";
  the info panel shows it), `sizeLabel` ("as its card reads it"), the card
  view's header (the polaroid "under the pointer", "a plain click zooms"),
  `estimatedHeightAt` ("a typical caption's"), `LIFT_INSET` ("under the
  pointer"), the runner view's and the stylesheet's "zoom".
- [x] **T3. A comment cites a proposal.** `scripts/measure-load.ts`: "The
  method of proposal 036's measurements". Say what the method is instead.
- [x] **T4. Exports without JSDoc.** `TAG_GROUPS`; `ENTRY_KINDS`, `ERAS`,
  `GENRES`, `RENDERER_KINDS`, `CARD_COLORS`; `CardWallLayout.columnCount`;
  `WallEffectViewBindings.effect` and `cardCount`; the search bar's relays;
  the transition's `update`.
- [x] **T5. Small things.** Casts a `ref` does not need (`e as HTMLElement`
  in the card view); `TagChip['group']` for `TagGroup`; the thumbnail
  script works out its capture scale twice.
- [x] **T6. The reduced-motion rule sits in the stylesheet's transition
  section**, though it is about the cards and the search box. Move it to
  the page's section.

### Observations (no change)

- **O1.** The card textures are on trial (`?texture=`, `CardTextureKind`,
  `CARD_TEXTURES`); once the author chooses, the switch and the others go.
  Since done: the author chose an etched grid (036 section 11.15).
- **O2.** Whether the transition's picture is pixel art, and whether an
  entry takes controls, are inferred from `kind === 'game'`. True of every
  entry today; if a demo needs either, say it in the entry.
- **O3.** The wall still refreshes under a running entry: thirteen cards'
  refresh steps a frame, which cost little. If it ever shows in a profile,
  skip the wall's descendants while an entry plays.
- **O4.** Going back or forward in history to `#<entry>` from the wall
  enters without burning the wall (`holdGrown`): there is no card picture
  to start from. By design.
- **O5.** The stylesheet is 670 lines in sections. It could be split by
  view if it grows.

## Acceptance Criteria

- [x] Every finding above ticked, or marked as left with a reason
- [x] `npm run lint`, `npx tsc -b` and `npm test` pass
- [x] The Arcade behaves as before in a browser: search, keys, launching,
  the way in and out (and the quiet one), the pause menu

## Progress Log

- **2026-10-05:** Reviewed. Everything uncommitted staged, as reviewed;
  the fixes follow, unstaged.
- **2026-10-05:** Every finding fixed, unstaged for review. New modules:
  `views/rect.ts` (S4), `views/arcade-head-view.tsx` (S7),
  `views/wall-painter.ts` (S8), `views/focus-on-open.ts` (S9),
  `views/svg-cells.ts` (S10). Two follow-on details: the search box settles
  its suggestions again as a key is pressed, since the text may have changed
  since the frame's settling (S11); and a launch from the info panel reads
  the card's pose only if the card is on the wall (C3, S6). New tests: the
  burn ends once the page is black (C1); the chips keep their order with
  `activeChipAt` in place of the removed `isChipActiveAt` (S2). Checked in
  headless Chrome: the burn canvas hidden while an entry plays (C1); `/`
  and `d` while playing leave the search alone, and `/` on the wall still
  jumps to it (C2); the polaroid lands within a pixel of its card's photo;
  the pause menu's keys; the quiet way in and out. Lint, `tsc -b` and 1526
  tests pass.
