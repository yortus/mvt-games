# The Arcade's Way Into an Entry, Timed by the Model

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-18 |
| Updated  | 2026-10-18 |

## Description

The way into an entry hands control back and forth between the
transition's view model and the Arcade's model:

1. The model loads the entry, then waits in `'ready'`.
2. The transition (`views/entry-transition-view-model.ts`) holds its polaroid
   until `isReady`, recedes it, then calls `onHandOver`, which is
   `model.startPlaying`. The model goes `'playing'`, and `main.ts` starts
   the entry's session.
3. The model holds the entry still (`isHeld`, part of `isEntryFrozen`, which
   pauses the host) until the transition calls `onShown`, which is
   `model.letGo`, after the first frame has shown still for `SHOW_STILL_MS`.

That bends MVT twice. The model depends on its presentation: without views,
it never leaves `'ready'`, and its API has `startPlaying` and `letGo` only
for the transition. And the view gives the model orders through relay
bindings, which are meant to report what the user did.

The owner chose to fix it by letting the model own the timing (option A of
a review on 2026-10-18). The transition decides when the entry starts and
when it may run, which is domain timing, like a "Get ready!" pause. So the
model times it, and the views follow, as the guide's phase-based
transitions do. The guide now teaches this, in Open-Ended Phases, "When a
Transition Decides When Play Starts", and the Arcade's README points there
in place of the hand-over.

### The design, to refine while doing it

- **The model's phases** become `'browsing'`, `'launching'`, `'revealing'`
  and `'playing'`, with `elapsedMs` and, for `'revealing'`, `progress`.
  - `'launching'` is open-ended. It ends when the entry has loaded, and
    the way in's first part (the burn and the float, about
    `FLOAT_DELAY_MS + FLOAT_MS`) has had its time, so a cached entry can't
    cut it short.
  - `'revealing'` is timed, covering the recede, the power-on and the still
    first frame (`RECEDE_MS + POWER_ON_MS + SHOW_STILL_MS` today). The
    session starts as it begins, and the entry is frozen through it.
  - `'playing'`: the entry runs.
- **Gone:** `'ready'`, `isHeld`, `startPlaying`, `letGo`, and the
  transition's `onHandOver` and `onShown`. `isEntryFrozen` covers
  `'revealing'` instead of `isHeld`.
- **The durations move** from the view model into data the model and the
  views share. The transition draws each part from the model's phase,
  `elapsedMs` and `progress`, and holds the polaroid floating, as now, if
  the load outlasts the float.
- **The frame the transition waits for** (`'starting'`, until `isPlaying`
  shows the entry has drawn) stays in the view: it's the view waiting on its
  renderer, and the model's clock doesn't wait for it.
- **The way out stays presentation.** Leaving changes nothing the model
  waits for: the model goes `'browsing'` at once, and the power-off and the
  float back play from the entry's last frame, as now.
- **A link straight to an entry** (`holdGrown`) starts in `'launching'`
  with no wall to burn. Check it still lands as it does now.

### To decide

- **Reduced motion.** The quiet path's fades (`QUIET_FADE_MS`, 250 ms
  each) are shorter than the full path's parts. With the model's
  durations fixed, the quiet path either fades within each phase and holds,
  or stretches its fades to fill it. Either way, both paths start play at
  the same moment.
- **Names.** `'launching'` and `'revealing'` are placeholders.

## Acceptance Criteria

- [x] The model times the way in, and nothing in the views calls the model
      to move it on
- [x] `'ready'`, `isHeld`, `startPlaying`, `letGo`, `onHandOver` and
      `onShown` are gone
- [x] Going into an entry looks as it does now from the wall. The quiet
      path is slower, as decided. A link straight to an entry now looks
      right (it showed a small picture in the top-left before)
- [x] The model's tests step through a launch with `advanceTime` and no
      views; the transition view model's tests drive it from fixed phase
      and `elapsedMs` bindings (it needs no `progress`, so the model has none)
- [x] The Arcade's README, sections 1 to 6, 8 and "In the Guide", describe
      the new design, and the reference images are unchanged
- [x] Lint, type checks, unit tests and visual tests pass

## Progress Log

- 2026-10-18: Created, after a review of the guide's section on handing
  over between a view and the model found that it taught a pattern that
  bends MVT. That section was rewritten to teach the model owning the
  timing, and the owner chose that design for the Arcade too.
- 2026-10-18: Done, in the `mvt-alignment` worktree. Decided with the owner:
  - **Names:** `'launching'` and `'revealing'`.
  - **Reduced motion:** the quiet path fades over the same parts of the
    model's time as the full one. The page fades over all of `LAUNCH_MS`,
    rather than only the backdrop's part of it, so a click is answered at
    once. The quiet way in takes as long as the full one, about a second
    longer than before.
  - **Links straight to an entry:** `launch(id, { isDirect: true })` from
    `followUrl` waits for the load alone. The small picture in the
    top-left came from the host's area being empty before the page laid
    the runner out: fitting to nothing gave the entry's own size at the
    corner. `playRectFor` now gives an empty rectangle until there is an
    area, and the picture held at the play area follows it. It eases,
    because the play area also shrinks once a loaded entry says it scales
    by whole numbers. Moving `integerScale` into the catalogue would
    size it right from the start, for seven entries.
  - **Escape during the reveal** leaves, as it does while loading.
    Pausing is allowed from `'revealing'` on, so the runner's (i) panel can
    still pause an entry as it shows, as before.
  - **The session starts as `'revealing'` begins**, under the receding
    picture. The loop starts it before the views draw, so the view's old
    `'starting'` wait for a first frame had nothing left to wait for, and
    went. The runner and the resume offer show from the end of the recede
    (`isEntryShown` in `arcade-view.tsx`), as before.
  - Also found while checking the search: `chooseChipAt` cleared the
    typed words, which is the search box's behaviour. The wiring in
    `arcade-head-view.tsx` clears them now, and the model's action only
    chooses the tag.
- 2026-10-18: Archived, after review. The view model was renamed
  `EntryTransitionViewModel` (and its view `EntryTransitionView`), after the
  Arcade's term for the entries it goes into and out of.
