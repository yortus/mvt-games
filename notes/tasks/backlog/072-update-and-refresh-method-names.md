# Update and Refresh Method Names

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-15 |
| Updated  | 2026-10-21 |

## Description

A view's update method should be called `update` (or `update*` where one
file needs to tell several apart), and its refresh method `refresh` (or
`refresh*`), so the tick's two verbs mean one thing everywhere. Found while
drafting the CQS principle page ([070](../../archive/070-principles-docs.md)):
the page links to the fruit machine's lever view, whose update method is
called `advance`.

Most views already comply: 24 named update methods are `update`. The rest,
as of 2026-10-19 (paths under `packages/sites/`):

- **Update methods with another verb.** Rename each to `update`:
  - `advance` in `arcade/src/entries/fruit-machine/views/three/lever-view.tsx`
  - `slide` in `arcade/src/entries/neon-monsoon/views/boss-health-view.tsx`
  - `countUp` in `arcade/src/entries/fruit-machine/views/pixi/win-banner-view.tsx`
  - `recordTrail` in `arcade/src/entries/double-pendulum/views/pendulum-view.tsx`
  - `startOnFirstTab` in `arcade/src/arcade/views/entry-info-view.tsx`
- **Refresh methods named `update*`,** which say the opposite of what they
  are. All in `arcade/src/entries/kwazy-cactii/views/board-view/`:
  `updateFirework`, `updateFlash`, `updateEffects`, `updateShake` and
  `updateBanner`. The docs copy one: `setRefresh(view, updateEffects)` in
  `docs/building-with-mvt/animating-transitions/complex-sequences.md`.
- **Optional: refresh methods with other verbs.** About 40, mostly on child
  elements in JSX views, many in the Arcade's own views and the playground:
  `draw*` and `redraw*`, `place`, `repaint`, `focus*`, `noteOpening`,
  `settle`, `showFill`, `scrollToEnd`, `keepNewestInView`, `writeTheme`,
  `uploadIfChanged`, and more. Each could take a `refresh` prefix, as
  `refreshCursor` and the other `refresh*` names already do, or be kept
  with a reason.
- ~~**The CQS page's lever example** calls a helper `advanceSwing(deltaMs)`;
  make it `updateSwing(deltaMs)`.~~ Done 2026-10-15.

Inline arrow functions passed as update or refresh methods have no name, and
are out of scope.

Find them again by searching `packages/sites` for `onUpdate={name}`,
`onRefresh={name}`, `setUpdate(x, name)` and `setRefresh(x, name)`.

## Acceptance Criteria

- [ ] Every named update method is `update` or `update*`
- [ ] No refresh method is named `update*`, in code or docs
- [ ] Refresh methods with other verbs each renamed to `refresh*`, or kept with a reason
- [x] The CQS page's `advanceSwing` is `updateSwing`
- [ ] `npm run lint`, `npm run build` and `npm test` pass

## Progress Log

- 2026-10-15: Created from a survey of update and refresh method names,
  prompted by the lever view's `advance`.
- 2026-10-15: Renamed the CQS page's `advanceSwing` to `updateSwing`.
- 2026-10-19: Moved onto `main` as 070 (was 049 on the `tick-lite-api`
  branch), and surveyed again: main's Arcade and playground add more names.
- 2026-10-21: Renumbered 072 (was 070) on reaching `vnext`, where 069 was
  taken.
