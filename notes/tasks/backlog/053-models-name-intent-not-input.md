# Models Name What the Player Means, Not the Controls

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-16 |
| Updated  | 2026-10-16 |

## Description

Every game's model takes the player's input as fields named for the controls:
`restartPressed`, `firePressed`, `risePressed`, `swipeCount`, `tapCount`. Each
game's `start/load.ts` and game view copy the host's input straight into them:

```ts
onPrimaryButtonChanged: (pressed) => { gameModel.risePressed = pressed; },
onRestartButtonChanged: (pressed) => { gameModel.restartPressed = pressed; },
```

So the model knows there is a button, and knows what pressing it means. That
is not MVT. The architecture docs name a relay binding for what the user did
(`onFirePressed`), and leave what it means to whoever wires it
([Relay Bindings and Input Handling](../../../packages/sites/docs/architecture/bindings.md#relay-bindings-and-input-handling)).
The wiring is the place to say "the Rise button means blow the tanks". The
model should model what the player means: the tanks are being blown, or a
new run was asked for. It should not model which control said so.

Reading input in `update` is not the problem, and stays. The docs prefer it:
input "queued and processed on the next `update()` call" keeps the data
flowing one way each frame, and keeps the models deterministic.

### Two kinds of input, two fixes

**Controls held down are state, named for what they do.** A held button
maps onto something in the game that is on or off for as long as it is held.
Name the field for that, and let the wiring map the control onto it:

| Now | Instead, for example |
| --- | --- |
| Deep Dive's `risePressed` | `isBlowingTanks` |
| Astrovoid's `thrustPressed`, `firePressed` | `isThrusting`, `isFiring` |
| Neon Monsoon's `focusPressed` | `isFocused` |
| Burrow Bust's `pumpPressed` | `isPumping` |

Each game's names are its own to choose. Some, such as `firePressed` in an
autofire game, may need a moment's thought about what the game really
models.

**One-off commands are actions.** `restartPressed` is not state at all: the
model only cares that a new run was asked for. Holding it as a flag brings
the button's behaviour into the model:

- Holding Enter as a run ends restarts at once, because the flag is still
  true when the model looks.
- A tap whose press and release both land between two updates would be
  missed, because the model never sees the flag true. `OverlayView` works
  round this by holding the release back until its own update step
  (`isReleasePending` in `packages/sites/arcade/src/shared/overlay-view.tsx`).
- Kwazy Cactii's model runs `watch` over `restartPressed` to find the moment
  it is pressed. That is the model detecting a button's edge.

An action that records the request and acts on it at the next update fixes
all three:

```ts
/** Asks for a new run. It starts at the next update, if the last run is over. */
startNewRun: () => void;
```

The press calls it, and the release no longer matters. This is the
existing rule that control behaviour lives in views and wiring, and model
actions stay primitive and guarded.

### Gestures in models

Fenceline goes further. Its `PlayerInput` counts swipes and taps, and its
model decides what each means: a swipe sets the farmhand going that way
until the next swipe, and a tap stops it. That is control behaviour, and
belongs in the view or the wiring, with the model given the meaning, such as
`steer(direction)` and `stop()`. Its view test
(`fenceline/views/game-view.test.ts`) covers the swipes, and would move with
them.

### What else it touches

- **`PlayerInput` models.** Eight games keep their input in a
  `models/player-input.ts`: Astrovoid, Burrow Bust, Crumb Chase, Dojo Duel,
  Fenceline, Fuel Run, Galaxy Raiders and Neon Monsoon. Kwazy Cactii keeps
  one in its game model. Deep Dive and Garden Snake put the fields straight
  on their game models. Decide first whether an input record stays, renamed
  for what it holds (the ship's controls, the sub's helm), or whether its
  fields join the models they drive. Either way, nothing in it should be
  named for a control.
- **`direction`, `xDirection` and `yDirection`.** Crumb Chase's and Garden
  Snake's `direction` is already named for the player's intent ("the way the
  player last steered"), and is fine. `xDirection` and `yDirection`, in
  Dojo Duel, Fuel Run and Neon Monsoon, mirror the joystick's two axes. Judge
  each: some games mean a heading, and some do mean "pushing left".
- **`OverlayView`.** Once restarting is an action, its relay binding can
  report a plain tap (`onTapped`), and its held-back release can go, with
  its tests. Every game's view wires it.
- **The host's `inputConfig`.** It stays as it is: its callbacks are the
  host's relay bindings, and rightly named for the controls
  (`onPrimaryButtonChanged`). Only what each game wires them to changes.
- **Tests.** Model tests that set the flags, `galaxy-raiders/views/audio-views.test.ts`,
  and the visual tests' poses, such as Deep Dive's, that hold a control.
- **The docs.** [Style Guide](../../../packages/sites/docs/reference/style-guide.md)
  uses `PlayerInputModel` as its example of a model's name, and
  [View Composition](../../../packages/sites/docs/building-with-mvt/presenting-the-world/view-composition.md)
  wires `model.playerInput.direction`.

## Acceptance Criteria

- [ ] Decided: what an input record becomes, renamed or folded into the
      models, and recorded in this task
- [ ] No model's interface names a control or a gesture (`Pressed`, `Held`,
      `Tapped`, `Swiped`, `swipeCount`, `tapCount`). Held controls are state
      named for what they do; one-off commands, starting with restart, are
      actions that take effect at the next update
- [ ] No model watches its own input for the moment a control is pressed
      (Kwazy Cactii's `watch` over `restartPressed`)
- [ ] Fenceline's swipes and taps are read in its view or wiring, and its
      model is told what they mean
- [ ] `OverlayView` reports a plain tap, its held-back release is gone, and
      every game still restarts from a tap on its overlay
- [ ] Every game plays as before. Unit tests pass, and every visual test's
      reference image is unchanged
- [ ] The rule is written down: a model rule in
      [Architecture Rules](../../../packages/sites/docs/architecture/rules.md),
      a row in the style guide's naming table, a line in the model skill's
      forbidden patterns, and the docs' examples updated
- [ ] Considered: a lint rule, like `@mvtjs/no-wall-clock`, that flags
      control names in model files

## Progress Log

- 2026-10-16: Created. Raised while reviewing Deep Dive's `risePressed` and
  `restartPressed`. Every game has the same pattern, so the fix is one change
  across all of them, after the rule is written.
