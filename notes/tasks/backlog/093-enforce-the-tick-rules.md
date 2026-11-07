# Enforce the Tick Rules

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-11-07 |
| Updated  | 2026-11-07 |

## Description

[092](../../archive/092-update-and-refresh-or-update-alone/decision.md) closed
the gaps in what `update` and `refresh` may do, and Appendix A now states the
rules. Nothing checks them yet, so they depend on review. The code follows them
today, as far as the audits could see.

Each of these was tried as a throwaway, so the first step for any of them is to
decide whether it's worth keeping. A rule that needs many `eslint-disable`
comments isn't.

- **A refresh step doesn't build on its own state.** Flag `x += ...`, `x++` and
  `x = x + ...` on a variable from outside the step. A prototype with the type
  checker found 4 hits in 232 files, none a fault: `painter ??=` (lazy set-up, so
  skip logical assignment), `s` in `asteroid-view.ts` (local to the draw, so
  scope the rule to the whole step), and two lines of Fuel Run's ring in
  `terrain-view.ts`, which remember what was drawn and would need a disable
  comment. A plain `shownFuel = bindings.fuel()` looks the same as remembering, so
  it can't be caught.
- **A view's update step writes no output.** Flag writes to display objects and
  chips, using types. The prototype's one finding, Tune Tracker's `AudioView`, is
  fixed. The list of display types was written by hand.
- **No relay or model action from a view's steps.** Flag `bindings.on*()` and
  actions on `model`. It sees only one file, so it misses a helper
  (`setUpdate(view, gestures.update)`). A book-wide pass found nothing, but that
  check was never tried on a seeded mistake.
- **No wall clock in views.** `@mvtjs/no-wall-clock` covers model files only,
  which is how Burrow Bust's rock came to read `Ticker.shared.lastTime`. Survey
  what views use first: a view may have good reasons for a timer outside its
  steps.
- **`createRepeater` and `metronome` beat once as they're turned on, even at 0.**
  Check whether any view depends on that, and whether either should be flagged in
  views.
- **A catalogue check for `update(0)`.** For each entry, snapshot the output and
  count random draws at checkpoints, run `update(0)` twice and compare. It sees
  only the paths that run, and only output and random draws.

## Todo

- [ ] Decide which of these are worth keeping
- [ ] Build each one kept, with tests that a seeded mistake fails

## Progress Log

- 2026-11-07: Created from 092. Each check above was tried as a throwaway first.
