# Proposal: Input across the sites

> 094 split drags on a grid into three layers: following a pointer,
> recognising a gesture, and saying what it means. This proposal surveys
> every other way the sites take input, the keyboard and the arcade's touch
> controls included, and extends the same split to all of it. The arcade
> games get one set of arcade controls, with their keys in a table that can change, and
> their wiring moves into each game's top-level view beside its gestures.
> The repeated gestures (buttons, holds, strokes, pan and zoom) each get one
> shared helper. And the site kit's input moves into one folder, with
> renderer-specific pieces in a subpath named for the renderer.

**Status:** being implemented, a step at a time (section 11). Step 1, the
site kit's layout, is done.

**Written:** 2026-11-07, against `main` at `dd3c1794` plus 094's changes,
from a survey of every entry and the site kit. Line numbers are from that
day.

**Related:**
[094](../archive/094-drags-on-a-grid.md) (the layers this extends),
[`listenToKeys`](../../packages/sites/site-kit/src/input/listen-to-keys.ts),
[`listenToKeyboard`](../../packages/sites/site-kit/src/input/keyboard-input.ts),
[the Pixi stage](../../packages/sites/site-kit/src/runner/pixi-stage.ts) and
[the entry host](../../packages/sites/site-kit/src/runner/entry-host.ts),
[`EntryInputConfig`](../../packages/sites/site-kit/src/entry-types/entry-starter.ts),
[Adding an Entry: input](../../packages/sites/arcade/src/entries/README.md),
[Chapter 8](../../packages/sites/docs/chapters/08-bindings.md#relay-bindings-and-input-handling)
and [Chapter 13](../../packages/sites/docs/chapters/13-composing-views.md)
(the book wires a `KeyboardInputView` in the top-level view),
[Chapter 18](../../packages/sites/docs/chapters/18-growing-a-complex-view.md#example-a-press-that-turns-into-a-hold)
(a press that turns into a hold),
[the home page budget](../../packages/internal/checks/README.md) (the page
loads no renderer before its first paint).

| # | Recommendation | Section |
| --- | --- | --- |
| 1 | The arcade controls (a d-pad, two buttons and Restart) stay, as the one thing every input device reports to | 4.1 |
| 2 | Its keys become a table, read by `listenToKeys`. `listenToKeyboard` and `KeyboardInputView` go, and with them five keyboard bugs | 4.2 |
| 3 | Each game wires the arcade controls in its top-level view, beside its gestures and its Restart overlay, not in its starter | 4.3 |
| 4 | How to play, and "Press Enter", name the arcade controls, so the keys shown are the keys in the table | 4.4 |
| 5 | Two small helpers for meanings games repeat: several controls holding one thing, and two axes making one way | 5 |
| 6 | One shared press behaviour for Pixi buttons: fires on a tap, shows a hold, follows one pointer | 6.2 |
| 7 | `listenToPointer` for every single-pointer drag on a Pixi object, and a DOM twin for elements | 6.1, 6.5 |
| 8 | One press-and-hold view model, and one pan-and-zoom tracker in place of two near-copies | 6.3, 6.4 |
| 9 | All input in `src/input/`: renderer-free at `@mvtjs/site-kit/input`, Pixi at `@mvtjs/site-kit/input/pixi` | 7 |
| 10 | Dojo Duel's move table stays in its model | 9 |
| 11 | Every shared helper reports between frames, from an event or a microtask, never as a session starts, stops or pauses, or as a view is made or destroyed | 3.1 |

## 1. The layers

094 named three layers for a drag on a grid. They fit every input here:

1. **Following a device.** Which key or pointer, where it is, when it is
   let go, cancelled, or lost when the window loses focus. Shared, and the
   only layer that touches the browser's or Pixi's events.
2. **Recognising a gesture.** A tap from a drag, a hold from a tap, a step
   from cell to cell, a pinch, the last of two keys pressed. Shared, with
   no renderer, and timed in game time where it needs time.
3. **What it means.** Wired in the top-level view, where it can be seen and
   changed, and turned into a model's actions and state. Never in the model,
   and never in a shared helper.

Most of what follows is a place where two layers are mixed, a layer is
written again by hand, or the third layer sits somewhere other than the
top-level view.

## 2. What there is

### 2.1 Four ways to listen to the keyboard

| | What it is | Used by |
| --- | --- | --- |
| `EntryInputConfig` | A starter's callbacks for the arcade's controls: `onXDirectionChanged`, `onYDirectionChanged`, `onPrimaryButtonChanged`, `onSecondaryButtonChanged`, `onRestartButtonChanged`, and the touch layout (`showDpad`, labels) | All 11 arcade games and the Tune Tracker |
| `listenToKeyboard` | A fixed key table turned into those five callbacks | The entry host (for element entries, `entry-host.ts:177-186`) and `KeyboardInputView` |
| `KeyboardInputView` | A Pixi container around `listenToKeyboard` that stops listening when destroyed | The Pixi stage only (`pixi-stage.ts:159-170`) |
| `listenToKeys` | A general listener: keys pressed once, keys that repeat, keys held as named holds | Penrose Tiling and Fractalscope, in their top-level views |

The fixed key table (`keyboard-input.ts:42-51`, `:124`):

| Keys | Control |
| --- | --- |
| ←, `a` / →, `d` | X direction, the last pressed winning |
| ↑, `w` / ↓, `s` | Y direction, the same |
| Space | Primary button |
| Shift | Secondary button |
| Enter | Restart |

`listenToKeys` is the better of the two listeners. It lower-cases letters,
skips keys pressed with Ctrl, Alt or Meta, leaves keys to a focused text
field, slider or button, releases every hold when the window loses focus,
and calls `preventDefault` only for the keys it uses. `listenToKeyboard`
does none of these (section 2.4).

The host's element-entry path is dead code. No element entry gives an
`inputConfig`, so the entry host's `listenToKeyboard` never reports. But it
is installed whenever an entry takes input, so a Pixi game has two listeners
on `window`, one of them always inactive.

### 2.2 The arcade games' wiring

Every game turns the arcade controls' callbacks into its model's state and
actions in `start/load.ts`. Its touch gestures and its Restart overlay are
wired in `views/game-view.tsx`. So each game's controls are split across
two files, and the starter half is not in a view at all, though the book
(Chapter 13) and the repo's own rule put the wiring in the top-level view.

| Game | Arcade controls, in its starter | In its game view |
| --- | --- | --- |
| Astrovoid | X → `turning`; Up and Shift → `isThrusting`; Space → `fire()`; `isAutoFiring` set by device | Overlay |
| Burrow Bust | X and Y through a hand-written "latest axis wins" (`load.ts:34-71`) → `direction`; Space held → `isHarpoonOut`, pressed → `pump()` | Swipes, writing `direction` directly, past the starter's state |
| Crumb Chase | X and Y → `direction`, ignoring `'none'` | Swipes |
| Deep Dive | Space and Up → `isBlowingTanks` | A drag view used as a hold |
| Dojo Duel | X → `horizontalLean`, Y → `verticalLean`, Space → `isAttacking` | Overlay |
| Fenceline | X and Y through a different "latest axis wins" (`load.ts:36-47`, `:68-77`) → `steer()`, `stop()` | Swipes, calling `steer` directly |
| Fuel Run | X → `thrustX`, Y → `thrustY`; Space → `fire()`; Shift → `dropBomb()` | Drag → `targetScreenCol`, `targetRow`; auto-fire while touching |
| Galaxy Raiders | X → `direction`; Space → `fire()` | Drag → `targetX`; auto-fire while touching |
| Garden Snake | X and Y → `direction`, ignoring `'none'` (as Crumb Chase) | Swipes |
| Kwazy Cactii | Restart only | 094's grid gestures |
| Neon Monsoon | X → `headingX`, Y → `headingY`; Space → `dropBomb()`; Shift held → `isFocusing`, let go → `releaseVolley()` | Drag, with a gain |

Every game also has the same Restart line,
`onRestartButtonChanged: (isDown) => { if (isDown) gameModel.startNewRun(); }`,
and an `OverlayView` wired to `startNewRun`. No model reads raw input or
has a member named for a control. The models are clean. What is repeated or
fragile is the wiring.

Patterns that repeat:

- **Press once:** `if (isDown) model.fire()` in six places.
- **Two controls holding one thing:** Astrovoid (Up and Shift → thrust) and
  Deep Dive (Space and Up → rise). Letting go of one lets go of the thing,
  though the other is still held.
- **Two axes making one way:** Burrow Bust and Fenceline, written twice,
  differently, and `listenToKeyboard` has a third version for one axis.
  Each game's swipes skip its starter's state.
- **Swipe and drag areas:** the same hit area
  (`x={-W*2} y={-H} width={W*5} height={H*4}`) in eight game views, and
  `SWIPE_DISTANCE = 14` in four.
- **Keys named in text:** "Press Enter to restart" in eleven views, and each
  game's How to play lists its keys again (`ControlKey`), with no link to
  the table. Astrovoid's lists no Shift for Thrust, and says its touch
  turning is a joystick, though it draws a left-right d-pad. Neon
  Monsoon's lists no Restart.

Names differ too. A held way is `turning`, `direction`, `horizontalLean`,
`thrustX`, `headingX`, or `steer()`. The direction types are written again
in each game (`Direction` with and without `'none'`, three copies of
`XDirection`). That is the models' business, and this proposal leaves it
alone (section 9).

### 2.3 Pointer gestures

Beyond 094's three entries and the shared drag and swipe views:

| Gesture | Where | Follows one pointer? | Cancel? | Moves off the object? |
| --- | --- | --- | --- | --- |
| Slider drag | Boids `SliderView` | No: a second finger takes over | No | No: `pointermove` on a 22-pixel strip |
| Paint stroke, double tap | Coral `DemoView` | No: a second finger paints too | No | Full-screen sprite |
| Pour stroke, hover | Falling Sand `TankView` | No: any pointer steers the pour | Yes | Yes |
| Joystick | `TouchInputView` | Yes | Yes | No: `pointermove` on its area |
| D-pad | `TouchInputView` | Yes | Yes | Yes |
| Held buttons | `TouchInputView` | No: the first lift lets go | Yes | n/a |
| Press and hold | Sudoku `KeypadView` | No: a second key takes over | Yes | n/a |
| Cabinet turn | Fruit Machine `BanditView` (DOM) | No: a second finger takes over | Yes | Pointer capture |
| Panel drag | `PerfmonFloatView` (DOM) | Yes | Yes | Pointer capture |
| Pan, pinch, twist, wheel, taps | Penrose `gesture-tracker.ts` (DOM, 275 lines) | Two fingers | Yes | Pointer capture |
| Pan, pinch, wheel, double tap | Fractalscope `pinch-tracker.ts` (DOM, 261 lines) | Two fingers | Yes | Pointer capture |
| Tap, hover | `@mvtjs/three`'s pointer picker | No pointer id | No | n/a |

Button-like views, each with its own handlers:

| Fires on press | Fires on tap |
| --- | --- |
| Boids `CheckboxView`, Double Pendulum's button, Sudoku Digger's `ButtonView`, the site kit's `OverlayView` (Restart in all 11 games), `TouchInputView`'s buttons | The puzzles' `ButtonView` and `DayView`, Falling Sand's three toolbar buttons, Fruit Machine's `SpinButtonView`, Reordering Lists' `CardView`, the Tune Tracker's play button and list |

Three of them show a hold (Falling Sand's action button, Fruit Machine's
spin button, the touch buttons). Only one of those handles a cancel, and the
touch buttons' hold shows nothing (`touch-input-view.ts:440-447` sets the
same alpha on press and release).

The two DOM trackers are one design written twice. They share their eight
constants' names, their seven listeners, the third finger promoted when one
lifts, the double-tap test and the wheel's notches. Penrose adds a twist and
a tap. Fractalscope adds a begin and an end. Two constants differ (zoom per
wheel notch, 1.2 and 1.25; per double tap, 1.8 and 2.5).

Three page views (`runner-view.tsx`, `about-view.tsx`,
`nav-theme-view.tsx`) close on a press outside them, with the same code.

### 2.4 Bugs found

Read from the code. The ones marked *inferred* were not reproduced.

1. **A key held with Shift sticks.** The table has lower-case letters only,
   and Shift makes `e.key` a capital. Hold W, press Shift, let go of W: the
   release is `'W'`, so `w` stays held. Shift is Thrust, Bomb and Focus, and
   Neon Monsoon's Focus is meant to be held while moving. Caps Lock turns
   WASD off altogether.
2. **Keys stay held when the window loses focus.** `listenToKeyboard` has no
   `blur` listener. Switch tabs while holding a key, and the ship keeps
   turning until the next key event.
3. **`preventDefault` on every key**, used or not, but Enter and Shift.
4. **Two controls holding one thing let go together** (section 2.2).
5. **A pause can release Neon Monsoon's volley** *(inferred)*. A key pressed
   while paused releases every held key, so Shift held into a pause sends
   `releaseVolley()`, which the model applies on resuming.
6. **A second finger takes over** the Boids slider, Coral's painting, Falling
   Sand's pour, Sudoku's keypad, the touch buttons and the Fruit Machine's
   cabinet.
7. **A cancelled touch leaves a drag or a hold** in the Boids slider, Coral,
   Fruit Machine's spin button, and the three.js picker.
8. **A drag lost as it leaves a small object:** the Boids slider, the
   joystick.
9. **Allocations on every move:** the Boids slider, Coral, `TouchInputView`
   (`getLocalPosition` with no point to fill).
10. **Coral's double tap counts the start of a drag** as a tap.
11. **Burrow Bust's "LEVEL CLEAR!" overlay takes a tap and does nothing**
    *(inferred)*: its model restarts only after game over.
12. **Stopping `listenToKeys` reports during a frame.** Its stop lets go of
    every hold at once (`listen-to-keys.ts:49`), which calls `onHeldChanged`.
    Penrose Tiling and Fractalscope stop it as their top-level views are
    destroyed (`onDestroyed={stopListening}`), and their `onHeldChanged`
    writes to the model (`scope.travelX`, `model.travelRe`). The views are
    destroyed as the page stops the session, inside its frame (`followModel`,
    `start-site-page.ts:289`). It does no harm today, since the model goes
    too, but it breaks the rule that relays fire between frames, and the
    arcade controls in section 4 would hit it at the end of every session.

## 3. Principles

- **Report, recognise, mean**, as in section 1.
- **The top-level view says what every control means**, keys, touch controls
  and gestures alike, in one place.
- **One shared helper for each kind of gesture**, with no renderer where it
  can manage without one, and one way to follow a pointer for each renderer.
- **A helper follows one pointer, handles a cancel and a lost focus, and
  allocates nothing per move.** These are the bugs that recur, so they are
  fixed once, in the helper.
- **Every relay fires between frames.** A report reaches a model only from
  an event the browser delivers, or from a microtask for something noticed
  during a tick ([B-outside](../../packages/sites/docs/appendices/a-mvt-on-one-page.md#binding-rules),
  [Chapter 8](../../packages/sites/docs/chapters/08-bindings.md#relay-bindings-and-input-handling)).
  The shared helpers keep to this themselves, so an entry that uses them
  gets it without thinking about it. Section 3.1 says how each one does.
- **What the page loads stays free of renderers.** A subpath the page
  imports never imports Pixi or three.js (the home page budget checks this).

### 3.1 Where each report comes from

The page runs one frame for itself and the entry it is running
(`start-site-page.ts:282-306`). It follows its model (`followModel`, which
starts, stops, restarts and pauses sessions), ticks the host, then updates
and refreshes its own views. Everything that code calls is inside the frame.
So a helper in this proposal reports from one of four places, and no other:

| Where the report comes from | Why it is between frames | Used by |
| --- | --- | --- |
| A browser event: a key, a pointer, the window's `blur` | The browser delivers events between frames | `listenToKeys`, `listenToPointer`, `listenToElementPointer`, `listenToPress`, the pan-and-zoom tracker, the page's close-on-press-outside |
| Pixi's own `pointermove`, which it sends for a mouse that stands still while the scene moves under it | Pixi sends it as a DOM event from its own animation frame callback (`Ticker.system`, `EventTicker.mjs:39`, `:67`), not from the page's frame | `listenToPointer`'s `onMoved` and `onHovered` |
| A microtask, for something noticed in an update or refresh step, or as a session starts or stops | It runs once the frame's code has finished | The press-and-hold view model's hold (6.3), `TouchInputView`'s let go as it rebuilds (as now), `listenToKeys` letting go as it stops (4.2) |
| The caller's report, passed straight on | It is between frames whenever its caller's is | `createArcadeControls`, `ArcadeControlsInputView`, `createHold`, `createLatestWay`, 094's grid gestures view model |

These happen inside the frame, so nothing reports from them:

- **Starting, stopping, restarting or pausing a session.** The page does all
  four from `followModel` (`start-site-page.ts:289`, `:318`, `:324`, `:328`,
  `:335`).
- **Making or destroying a view.** A refresh can do either: a `<Show>` or a
  `<List>` making a child, or a view rebuilding its display objects. So a
  helper reports nothing as it starts listening. As it stops, it reports
  nothing, or, where a model must hear a let go, reports it from a
  microtask.
- **An event that our own code causes,** such as `.focus()` in a refresh
  (the page's menus do this), or `releasePointerCapture`.
- **A headless step.** `advanceHeadless` (`headless.ts:107`) runs every
  step at once, so a microtask queued in a step runs only after the last
  one. A starter's `thumbnailInput` plays its controls between steps, never
  inside an update or a refresh, which counts as between frames. No
  thumbnail needs a report from a microtask today. One that does needs
  `advanceHeadless` to wait for a microtask between steps, as v-snap's
  `advanceTime` does (`advance-time.ts:46`).

Each helper that can be stopped or ticked has a test that does so and checks
that nothing reaches its relays until a microtask has run
(`await Promise.resolve()`), as Sudoku's keypad tests do now.

## 4. The arcade controls

### 4.1 Keep the arcade controls

The host gives every arcade game a set of arcade controls: a d-pad, two
buttons and Restart, like the stick and buttons on an arcade cabinet. They
are virtual. The keyboard and the host's on-screen d-pad and buttons both
report to them, and a game says what each control means. This is a good
split, and it is the one a player knows from a cabinet or a console: keys
to controls belong to the host (and one day the visitor, and a gamepad),
and controls to meanings belong to the game. A game that needs more keys
than the arcade controls have listens with `listenToKeys` itself, as
Penrose Tiling does.

The alternative, each game listening to its own keys with `listenToKeys`,
would put every key in the game's own table. But the touch controls the host
draws beside the game would still need a host-side contract, pausing would
need every game to ask the host, and remapping keys for the visitor, or
adding a gamepad, would mean changing eleven games. So no.

### 4.2 Its keys, as a table

The host's keys become a table read by `listenToKeys`, in the site kit's
input folder:

```ts
/** The keys for the arcade controls. Several keys can hold one control. */
export const ARCADE_CONTROL_KEYS: ArcadeControlKeys = {
    left: ['ArrowLeft', 'a'],
    right: ['ArrowRight', 'd'],
    up: ['ArrowUp', 'w'],
    down: ['ArrowDown', 's'],
    primary: [' '],
    secondary: ['Shift'],
    restart: ['Enter'],
};
```

A small `createArcadeControls` (no renderer) turns the holds `listenToKeys`
reports into the arcade controls' reports: an axis's last way pressed wins,
and a button reports only as it changes. The host makes one set per session,
and makes it listen while the entry plays.

This fixes bugs 1 to 3 for free: `listenToKeys` lower-cases letters,
releases everything on `blur`, and calls `preventDefault` only for its keys.
Then `listenToKeyboard`, `KeyboardInputView`, the entry host's dead
listener, and the three copies of the relay lambdas go.

Bug 5 goes too, and the arcade controls do nothing as the host pauses to fix
it. `listenToKeys` ignores a key pressed while it is inactive, where
`listenToKeyboard` let go of everything, and it still reports a key let go,
from its `keyup` (`listen-to-keys.ts:76-79`, which reads no `isActive`). So
Shift held across a pause stays held, and Shift let go during a pause is a
real let go, reported from the event as it happens. The arcade controls
must not let go of what is held as the host pauses, though that looks tidy. The
page pauses the host from inside its frame
(`host.isPaused = model.isEntryFrozen`, in `followModel`,
`start-site-page.ts:335`), so a let go reported there would change the
game's model during a tick.

The touch controls hide while the host is paused
(`pixi-stage.ts:133`, in a refresh). A finger on one as it hides must still
be let go. If Pixi delivers the finger's `pointerupoutside` to a hidden
object, that event does it. If not, the touch controls let go from a
microtask as they hide, as their rebuild does now
(`touch-input-view.ts:107-114`). Step 6 checks which.

The arcade controls' listener starts as the session starts, and stops as it
ends, both inside the page's frame. Starting reports nothing, since nothing
is held yet. Stopping lets go of every hold, and `listenToKeys`' stop
changes to do that from a microtask (bug 12), so it is safe wherever it is
called. Penrose Tiling and Fractalscope get the same fix.

Later, and not part of this proposal: keys the visitor chooses, kept with
their other settings, and the Gamepad API, both by changing the table the
arcade controls read.

### 4.3 Wired in the top-level view

The starter keeps what the host needs before the game starts, the touch
layout: whether to draw a d-pad, which kind, and which buttons with which
labels. It stops wiring meanings. Instead, the host passes the session's
arcade controls to the game, and the top-level view wires it, as Chapter 13's
`KeyboardInputView` is wired:

```tsx
<ArcadeControlsInputView
    controls={controls}
    onXDirectionChanged={(way) => { model.turning = way; }}
    onPrimaryPressed={model.fire}
    onRestartPressed={model.startNewRun}
/>
<OverlayView ... onPressed={model.startNewRun} />
<SwipeInputView ... onSwiped={(way) => { model.direction = way; }} />
```

`ArcadeControlsInputView` (Pixi, in `input/pixi/`) listens to the arcade
controls while it exists. It reports each button both ways, `onPrimaryButtonChanged`
for a game that holds it and `onPrimaryPressed` for one that presses it, so
the six `if (isDown)` wrappers go. Every control a game takes is now in one
file. `thumbnailInput` drives the same arcade controls, between headless steps,
so thumbnails keep working.

`ArcadeControlsInputView` has no update or refresh step. It passes on what
the arcade controls report, as they report it, so each relay fires from
the key or touch event behind it. Making it reports nothing, even when a
control is already held, because the game view is made as the session
starts, inside the page's frame. Destroying it reports nothing either. The
arcade controls are the host's, and last as long as the session does.

### 4.4 Keys named once

How to play names the arcade controls rather than keys:
`{ action: 'Thrust', inputs: [{ control: 'up' }, { control: 'secondary' }] }`.
The page shows the keys the table has for them, and the touch button's label
on a touch screen. "Press Enter to restart" becomes a function of the table
too (`describeControl('restart')`). The details can no longer disagree with
the wiring, as Astrovoid's and Neon Monsoon's do.

## 5. Helpers for meanings games repeat

Both are renderer-free, in `input/`, and both report what they work out. A
game still says what it means.

- **`createHold`**: several controls holding one thing. Each reports its
  hold under its own name, and the hold is held while any of them is.
  Astrovoid's thrust (Up, Shift) and Deep Dive's rise (Space, Up, a finger
  held) use it, which fixes bug 4.
- **`createLatestWay`**: two axes making one way, up, down, left or right,
  the latest axis pressed winning, and falling back to the other as it is
  let go. Burrow Bust and Fenceline use it, and their swipes go through it
  too, so a swipe and a key can't disagree. Their two versions differ, so
  playtest both (section 10).

Neither has an update step, and neither reports as it is made. Each
reports from inside the relay that fed it, so its reports fire between
frames whenever its callers' do. A helper of this kind that ever needs time,
such as a hold that must last a moment before it counts, is a view model
instead, and reports from a microtask (6.3).

Crumb Chase's and Garden Snake's "ignore `'none'`" is one line, and stays
in their wiring. So does auto-fire while a finger is down (Fuel Run, Galaxy
Raiders).

`SwipeInputView` gets a default `swipeDistance`, 14, and the games' shared
hit area becomes a named helper or a default, so the eight copies go.

## 6. Pointer gestures

### 6.1 `listenToPointer` for single-pointer drags on Pixi objects

Adopt it in the Boids slider, Coral's painting, Falling Sand's pour, and
the joystick and d-pad of `TouchInputView`. This fixes bugs 6 to 9 there.
Falling Sand also follows a hovering mouse for its brush ring, so
`listenToPointer` gains an optional `onHovered(x, y)` for moves while
nothing is pressed.

Every report `listenToPointer` makes comes from a Pixi pointer event, so it
needs no microtask. That includes the `pointermove` Pixi sends itself for a
still mouse (section 3.1). It reports nothing as its target is destroyed in
the middle of a press. A view that rebuilds its targets in a refresh, and
whose model must hear the let go, reports it from a microtask, as
`TouchInputView` does now.

### 6.2 One press behaviour for Pixi buttons

`listenToPress({ target, isEnabled, onPressed })`, in `input/pixi/`: it
follows one pointer, reports a press as a tap (let go over the target), and
lets go on a cancel. It returns `{ readonly isHeld: boolean }`, which the
button's refresh reads to show the hold. So nothing is called during a
frame to show a hold, and the one report, `onPressed`, comes from the
`pointerup`. It reads `isEnabled` as the pointer lifts, so a button disabled
while it is held fires nothing. Each site keeps its own look. Only the
behaviour is shared.

The rule: **a button fires on a tap**, so a finger that lands on it by
mistake can slide off. That changes the five buttons that fire on press,
`OverlayView` among them. The exceptions are controls that are held, such
as the touch controls' buttons and the keypad, which report as they go
down.

### 6.3 One press-and-hold view model

Sudoku's keypad gestures view model becomes the site kit's
`createPressGesturesViewModel`: a tap, or a hold after a time in game time.
The hold is noticed in an update step, so it is reported from a microtask,
as Chapter 18 teaches (`keypad-gestures-view-model.ts:77` does this now). A
tap is reported from the `pointerup` itself. Its tests wait for a microtask
after each tick, or use `advanceTime`, which does. It follows one pointer,
which fixes the keypad's second finger. The puzzles' walkthrough already
shows holds, so other puzzles will want it.

### 6.4 One pan-and-zoom tracker

Penrose's and Fractalscope's trackers become one, `createPanZoomTracker`
(DOM, no renderer), with the twist, the tap and the begin and end as
optional reports, and the two differing constants as options. Their tests
merge too. About 250 lines go.

Both measure taps with the events' `timeStamp`. That is input data, as a
position is, rather than a clock a view reads, but it is a question for the
rules (section 10). Either way, every report comes from a DOM event: a tap
and a double tap are recognised as the finger lifts
(`gesture-tracker.ts:200-229`). If tap timing moves into game time, the
tracker counts time in an update step but still recognises a tap on the
lift, so it still reports from the event, with no microtask.

### 6.5 A DOM twin of `listenToPointer`

`listenToElementPointer`, for one pointer over an element, with pointer
capture and `lostpointercapture`. It is used by the Fruit Machine's cabinet,
which fixes its second finger, and by the Perfmon's panel.

A capture can be lost because of our own code, as when a refresh removes
the element. So the helper's stop reports nothing, and the view stops it as
its element is destroyed, which removes the `lostpointercapture` listener
before the browser can send the event.

### 6.6 Outside the sites

- **`@mvtjs/three`'s pointer picker** needs `pointercancel` and a pointer
  id. It is a published library, so this goes in its own task, with a
  changeset.
- **The page's close-on-press-outside** becomes one helper in `arcade/`,
  for its three views.

## 7. The site kit's organisation

### 7.1 Why it is the way it is

`input/` says "input that needs no renderer", and `shared/` holds the
Pixi views entries share. So the folders are split by renderer, not by what
the code is for: `listenToKeys` needs no renderer, and `listenToPointer`
needs Pixi. The split has a reason. The page imports from `input/` (the
entry host's keyboard), and must load no renderer before its first paint.
But by that rule, the touch controls, the swipe and drag views, and now
`listenToPointer` all sit with the overlay and the pixel text rather than
with the rest of input.

Other things that blur it:

- `shared/` and `runner/` both re-export `isTouchDevice` from `device/`,
  and no entry imports `@mvtjs/site-kit/device`.
- `shared/` holds the sound chips' types, `MusicChip` and `SfxChip`, which
  have nothing to do with Pixi, and which the starter types, the page and
  about 40 files import.
- `KeyboardInputView` is in `shared/` for one importer, the host.

### 7.2 The layout proposed

Organise by area. Inside an area, put what needs a renderer in a subpath
named for it:

```
src/
├── input/       @mvtjs/site-kit/input        No renderer: listenToKeys, the arcade controls and their keys, createHold,
│                                             createLatestWay, the grid, press and pan-and-zoom view models,
│                                             listenToElementPointer (the DOM is not a renderer here)
│   └── pixi/    @mvtjs/site-kit/input/pixi   Pixi: listenToPointer, listenToPress, ArcadeControlsInputView,
│                                             TouchInputView, SwipeInputView, DragInputView
├── sound/       @mvtjs/site-kit/sound        The chips' types views play on: MusicChip, SfxChip
├── shared/      @mvtjs/site-kit/shared       The Pixi views entries share: OverlayView, PixelTextView
├── device/      @mvtjs/site-kit/device       Unchanged, now imported directly
└── ...          the rest unchanged
```

Rules that keep it so:

- `input/index.ts` never re-exports `./pixi`. `input/pixi/` imports what it
  needs from its parent folder's files directly, as the barrel rule says.
- A folder re-exports nothing from another folder, so each export has one
  address. `isTouchDevice` comes from `device`.
- A subpath the page imports (`input`, `sound`, `device`) imports no
  renderer. The home page budget check enforces it.

`shared/` could be renamed for what is left in it (`views/`). This proposal
leaves the name, since 56 files import it, and the moves above already
touch most of them. An open question (section 10).

### 7.3 What moves

| From | To | Importers to change |
| --- | --- | --- |
| `shared/` `listenToPointer`, `TouchInputView`, `SwipeInputView`, `DragInputView` | `input/pixi/` | 3 Pixi entries' views, 094's three entries, the Pixi stage |
| `shared/` `KeyboardInputView`, `input/` `listenToKeyboard` | gone (section 4.2) | the Pixi stage, the entry host |
| `shared/` `MusicChip`, `SfxChip` | `sound/` | about 40 files, by find and replace |
| `shared/`, `runner/` `isTouchDevice` | `device/` only | about 15 files |

## 8. Each entry

| Entry | Changes |
| --- | --- |
| The 11 arcade games | Arcade controls wired in the game view (4.3); How to play names controls (4.4); Overlay fires on a tap (6.2) |
| Astrovoid, Deep Dive | `createHold` (5) |
| Burrow Bust, Fenceline | `createLatestWay`, their swipes through it (5) |
| The 4 swipe and 4 drag games | Shared swipe distance and area (5) |
| Tune Tracker | Arcade controls in its top-level view; its play button and list through `listenToPress` |
| Boids | Slider on `listenToPointer`, checkbox on `listenToPress` |
| Coral | Painting on `listenToPointer`; double tap counts only taps |
| Falling Sand | Pour on `listenToPointer` with `onHovered`; toolbar on `listenToPress` |
| Double Pendulum, Sudoku Digger, Reordering Lists | Buttons on `listenToPress` |
| Fruit Machine | Spin button on `listenToPress`; cabinet on `listenToElementPointer` |
| Penrose Tiling, Fractalscope | `createPanZoomTracker` |
| Sudoku, the puzzles' buttons and days | Keypad on the shared press view model; buttons on `listenToPress` |
| The site kit | `TouchInputView` on `listenToPointer`, its buttons' hold shown; the page's close-on-press-outside helper |

## 9. Settled here

Do not reopen without new information.

- **Dojo Duel's move table stays in its model.** `resolveInputDirection`
  turns left and right into forward and back from the way the fighter faces,
  and `resolveMove` turns that into a move. Facing is model state, and
  changes during an update, so the model must resolve it. "Up and forward
  is a high punch" is the game's rule, as a fighting game's moves are. Its
  50 ms settle for diagonals is timed in game time, in the model, so
  replays stay exact. Its leans are named for what the fighter does, as the
  model convention asks.
- **The models' names for held ways stay as they are.** `turning`,
  `headingX` and `thrustX` each say what the game means, and that is what
  the convention asks. Shared direction types would couple games that
  should be free to differ.
- **The sites keep their own looks for buttons.** Only the behaviour is
  shared (6.2).
- **No game listens to the arcade controls' keys itself.** Section 4.1.
- **They are called the arcade controls,** not a controller, a gamepad or a
  joypad. A controller is MVC's third part, which the book compares MVT
  with (Chapter 2). A gamepad is a real device, which the Gamepad API reads,
  and which may one day drive these controls. A joypad is a gamepad by
  another name. Each of the arcade controls is a control, such as `up` or
  `primary`, which is how How to play names them (4.4).

## 10. Open questions

- **Burrow Bust's and Fenceline's "latest axis wins"** are written
  differently. Which behaviour `createLatestWay` keeps needs a playtest of
  each.
- **Event timestamps for taps.** The DOM trackers time double taps with
  `event.timeStamp`. A position from an event is input data, and arguably so
  is its time. But a replay driven by ticks alone could not reproduce a
  double tap. Decide, and say so in Appendix A, or move tap timing into
  game time as the press view model does.
- **Controls held through a restart.** A new session's game view reports
  nothing as it is made (4.3), so a player holding Right through a restart
  must press it again. The arcade controls could report what is already held
  from a microtask once the new view listens. That's the axes and the
  holds, not the presses, or a held Space would fire a shot.
- **A check for relays during a frame.** The tests in section 3.1 cover the
  shared helpers. An entry's own relays are covered only by review. A
  development-only check could catch them: the page marks its frame, and a
  model action called inside it logs a warning. It would need a way to know
  which calls are actions.
- **`shared/`'s name**, once input has left it.
- **The puzzles' Restart and the arcade overlay.** Fire on a tap (6.2), or
  keep a press for Restart, since a game over has no other control to slide
  onto?
- **A Gamepad API and keys the visitor chooses**, as follow-ons once the
  arcade controls read a table.

## 11. Implementation steps

Each step ships on its own, with its tests, and is playtested where it
changes what a player feels.

1. Site kit layout (section 7): `input/pixi/`, `sound/`, `isTouchDevice`
   from `device/`. Moves and imports only, no change in behaviour.
2. The arcade controls on `listenToKeys` (4.2): `ARCADE_CONTROL_KEYS`,
   `createArcadeControls`, one listener per session, nothing reported as the
   host pauses. `listenToKeys`' stop lets go from a microtask (bug 12).
   Remove `listenToKeyboard` and `KeyboardInputView`. Tests for bugs 1, 2,
   3, 5 and 12, and that starting, pausing and stopping a session report
   nothing until a microtask has run.
3. `ArcadeControlsInputView` and the games' wiring moved into their game views
   (4.3), a game at a time, starting with Galaxy Raiders (the smallest).
   Tests that making and destroying it report nothing. `createHold` and
   `createLatestWay` (5) as their games move.
4. How to play names controls, and restart text from the table (4.4).
5. `listenToPress` (6.2), then the buttons, a site at a time.
6. `listenToPointer` everywhere it fits (6.1), and `TouchInputView`'s fixes,
   including a finger on the touch controls as they hide for a pause (4.2).
7. The press-and-hold view model (6.3).
8. `createPanZoomTracker` (6.4) and `listenToElementPointer` (6.5).
9. A task for `@mvtjs/three`'s picker (6.6).
10. Docs: Adding an Entry (input), AGENTS.md's site kit folders, Project
    Structure, the site kit's README, and the cheat sheets if a moved export
    appears on one.
