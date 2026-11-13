# Input follow-ons

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-11-13 |
| Updated  | 2026-11-13 |

## Description

What [095](../../archive/095-input-across-the-sites.md) left open, now that
its steps are done. Its section 10 has the reasoning for each.

### Pixi 8 never reports a cancelled pointer

Pixi 8.21's event system adds no listener for the DOM's `pointercancel`
(`EventSystem.mjs`). After a cancel, the browser sends no `pointerup`
either. So the site kit's Pixi helpers that follow one pointer go on
following a pointer that has gone. They are `listenToPointer`,
`listenToPress` and the touch controls. Each then ignores new presses on its
target until that pointer's id comes back, which on a touch screen it never
does. Their own `pointercancel` handling never runs.

The canvas sets `touch-action: none`, so the browser's own gestures can't
cancel a touch. But the system can, as when a notification is pulled down.

Two ways to fix it:

- The entry host listens for `pointercancel` on its canvas, and passes it
  on to Pixi as a `pointerupoutside`. Every Pixi helper is then fixed at
  once. Check that Pixi's own tracking of the pointer is cleared too.
- Each helper forgets the pointer it follows when a new press arrives and
  the old pointer has sent nothing for a while. This is less exact.

### Playtests

On a phone, over `npm run dev:https`, and on a desktop:

- The touch controls: two buttons held at once, a joystick thumb slid off
  its area, the buttons' new held look, and a finger lifted while paused.
- Burrow Bust and Fenceline: the axis pressed last wins, and letting go
  falls back to the other.
- Astrovoid's thrust from Up and Shift together, and Deep Dive's rise.
- Every button that now fires on a tap: the arcade's Restart overlay,
  Boids' checkbox, and Double Pendulum's and Sudoku Digger's buttons.
- Falling Sand's pour and brush ring, Coral's double tap after a drag,
  Boids' slider dragged off its strip.
- Turning the Fruit Machine's cabinet, and dragging the Perfmon's panel.
- Sudoku's keypad with two fingers.
- Panning, pinching, twisting and double tapping in Penrose Tiling and
  Fractalscope.

### Questions still open

- **Event timestamps for taps.** `listenToPanZoom` times taps and double
  taps with `event.timeStamp`. A replay driven by ticks alone could not
  reproduce them. Decide, and say so in Appendix A, or move tap timing into
  game time, as `createPressGesturesViewModel` does.
- **Controls held through a restart.** A new session's game view reports
  nothing as it is made. So a player holding Right through a restart must
  press it again. The arcade controls could report the axes and holds
  already held, from a microtask, once the new view listens. Presses must
  not be reported, or a held Space would fire a shot.
- **A check for relays during a frame.** A development-only check could
  warn when a model action is called inside the page's frame. It would need
  a way to tell actions from queries. Task 093 may cover it.
- **`shared/`'s name**, now that input has left it. It holds only the
  overlay and the pixel text view.
- **A Gamepad API, and keys the visitor chooses.** Both read the arcade
  controls' table.

## Acceptance Criteria

- [x] The Pixi cancel gap is fixed. Not through Pixi's event boundary, which
      has no mapping for `pointercancel` at all, so the test dispatches the
      DOM's own events on the window (see the progress log).
- [ ] Each playtest above is done, and anything it finds is fixed or
      logged.
- [ ] Each open question is decided, or moved to its own task.

## Progress Log

- 2026-11-13: created from 095's open questions and its playtests.
- 2026-11-13: the cancel gap fixed, by neither of the two ways above.
  Passing the cancel on to Pixi as a `pointerupoutside` would make it a
  release, so a cancelled drag would act (Rosette's would swap), and Pixi's
  `EventBoundary` has no mapping for `pointercancel` to pass it on as one.
  Instead, `listenToPointerLoss` (site kit, `input/pixi/`) listens on the
  window for the DOM's `pointercancel`, for the pointer a helper follows,
  and for `blur` while one is down, which 095's rule asked of every helper
  ("handles a cancel and a lost focus") and neither Pixi helper did.
  `listenToPointer` reports a loss as a cancel, and `listenToPress` drops
  the press without firing. The touch controls, `DragInputView` and
  `SwipeInputView` are built on `listenToPointer`, so they have it too. Both
  helpers keep Rosette's backstop for any release still missing: a press by
  the primary pointer of the kind followed ends the one followed. The
  helpers' own Pixi `pointercancel` listeners, which could never fire, are
  gone, and so are the tests that emitted one. Pixi's own tracking of a
  cancelled pointer isn't cleared: a later press overwrites it, so nothing
  visible goes wrong. `@mvtjs/pixi`'s JSX still offers `onPointerCancel`,
  which Pixi 8 never fires.
