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
2. The transition (`views/transition-view-model.ts`) holds its polaroid
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

- [ ] The model times the way in, and nothing in the views calls the model
      to move it on
- [ ] `'ready'`, `isHeld`, `startPlaying`, `letGo`, `onHandOver` and
      `onShown` are gone
- [ ] Going into an entry looks as it does now, on both paths, and from a
      link straight to an entry
- [ ] The model's tests step through a launch with `advanceTime` and no
      views; the transition view model's tests drive it from fixed phase,
      `elapsedMs` and `progress` bindings
- [ ] The Arcade's README, section 5 and "In the Guide", describe the new
      design, and the reference images are unchanged or looked at
- [ ] Lint, type checks, unit tests and visual tests pass

## Progress Log

- 2026-10-18: Created, after a review of the guide's section on handing
  over between a view and the model found that it taught a pattern that
  bends MVT. That section was rewritten to teach the model owning the
  timing, and the owner chose that design for the Arcade too.
