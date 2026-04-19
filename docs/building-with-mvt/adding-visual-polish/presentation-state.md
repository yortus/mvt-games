# Presentation State

> Most views are pure projections of model state. Occasionally a view needs
> its own cosmetic state - a fade effect, a smoothed score counter, a screen
> shake - for visual feedback that the model doesn't track. This page explains
> what presentation state is, when it is useful, and how to implement it.

**Related:** [Views (Learn)](../presenting-the-world/views.md) -
[Taming Complex Views](taming-complex-views.md) -
[Phase-Based Transitions](../animating-transitions/phase-based-transitions.md) -
[View Composition](../presenting-the-world/view-composition.md) -
[The Game Loop](../the-game-loop.md)

---

*Assumes familiarity with [Views](../presenting-the-world/views.md) and [The Game Loop](../the-game-loop.md).*

## What Is Presentation State?

A model is a standalone simulation. It determines outcomes - scores, deaths,
matches, phase transitions. If you replayed the same inputs with no view at
all, every outcome would be identical.

Most of the time, a view is a pure projection: it reads model state in
`refresh()` and updates the scene graph. A character's position on screen
tracks the model position. A health bar shrinks when model health decreases.
No extra state needed.

But sometimes a view wants to show something the model has no reason to
know about. A visual flourish, a smooth transition, an intermediate editing
state. The view needs its own state for this - state that exists purely for
presentation. We call this **cosmetic state** because removing it would not
change any domain outcome.

### Game example: door fade

A dungeon model tracks whether a door is open or closed - a boolean. That is
all the simulation needs. But the view wants to fade the door in and out
over 300ms rather than snapping it instantly.

The fade needs a progress value: "how far through the transition are we?"
That progress is presentation state. The model does not track it because
nothing in the simulation depends on whether the fade has finished. If you
replaced the fade with an instant snap, the game would still work
identically.

### Non-game example: editable text field

A form model holds a validated `email` string. A text field view lets the
user edit the value. While the user types, the view holds an intermediate
editing buffer - the in-progress text that hasn't been committed to the model
yet. The user might type "troy@exa", which is not yet a valid email, so it
stays in the view. The cursor position, the blinking caret timer, and any
text selection range are also presentation state - the model has no reason to
know where the cursor is or which characters are highlighted.

The editing buffer, cursor, and selection are all presentation state. The
model's `email` field only changes when the user commits (e.g. presses Enter
or blurs the field). The model never sees the half-typed value, the cursor
position, or the selection because they are irrelevant to the domain.

## When Is Presentation State Useful?

The common thread: the model has a discrete state change, but the view wants
to show a gradual transition.

| Model state | Presentation state | Why it's cosmetic |
|---|---|---|
| Door `open` boolean flips | Fade-in/fade-out over 300ms | The model door is already open |
| Score jumps from 100 to 200 | Smooth count-up animation | The model score is already 200 |
| Match event fires | Shake-then-popup celebration | The match is already resolved |
| Enemy takes a hit | Brief red flash on the sprite | No game logic depends on the flash |
| Menu item becomes `selected` | Scale-bounce highlight effect | Selection is already decided |

::: info Not all animation needs presentation state
Many animations are driven directly from model values with no extra state.
A moving character reads model position. A shrinking health bar reads model
health. An entity flickering while invulnerable reads a model flag and
timer progress.

Presentation state is only needed when the view introduces a transition
**that the model doesn't track**.
:::

## Views Must Not Create Their Own Timing

Before looking at the implementation pattern, one rule is essential:
**views must not generate their own time deltas**.

It is tempting to hardcode a frame delta (`progress += 16 / durationMs`) or
compute one from `Date.now()` inside `refresh()`. Both approaches break
fundamental guarantees:

- **Non-determinism.** Tests and replays produce different results depending
  on wall-clock speed. A test that checks "door is half-faded at 150ms"
  passes on one machine and fails on another.
- **Broken pause and fast-forward.** If the game pauses, wall-clock time
  keeps advancing but the model stops. A view using `Date.now()` would
  continue its animation through the pause. A view using a hardcoded `16`
  would advance even when the ticker is not running.
- **Frame-rate coupling.** Hardcoding `16` assumes 60fps. On a 120Hz
  display the animation runs at double speed. On a dropped frame it
  stutters.

Time must come from the ticker, passed through `update(deltaMs)`. This
keeps presentation state synchronized with the model and the rest of the
view tree.

## How to Implement It with `update(deltaMs)`

A view with presentation state gains an `update(deltaMs)` method. The
ticker calls it each frame, between the model update and the refresh:

```
Ticker loop:
  model.update(deltaMs)     -- domain state advances
  view.update(deltaMs)      -- presentation state advances
  view.refresh()            -- reads model state + own state, writes scene graph
```

Views without presentation state are unchanged - they have no `update()`
method, just `refresh()`.

### Example: door fade

```ts
const FADE_DURATION_MS = 300;

function createDoorView(bindings: DoorBindings):
        Container & { update(deltaMs: number): void } {
    const view = new Container();
    const sprite = new Sprite(doorTexture);
    view.addChild(sprite);
    view.onRender = refresh;

    // -- Presentation state --
    let fadeProgress = bindings.isOpen() ? 0 : 1; // start matching model

    function update(deltaMs: number) {
        const target = bindings.isOpen() ? 0 : 1;
        if (fadeProgress < target) {
            fadeProgress = Math.min(target, fadeProgress + deltaMs / FADE_DURATION_MS);
        } else if (fadeProgress > target) {
            fadeProgress = Math.max(target, fadeProgress - deltaMs / FADE_DURATION_MS);
        }
    }

    function refresh() {
        sprite.alpha = fadeProgress;
    }

    return Object.assign(view, { update });
}
```

The presentation state is `fadeProgress` - a value between 0 (fully
transparent, door open) and 1 (fully opaque, door closed). The `update()`
method moves it toward the model's current state at a fixed rate. The
`refresh()` method applies it to the sprite. If the model flips mid-fade,
the transition reverses smoothly.

### Propagating `update()` through the view tree

Parent views propagate `update()` to children that have it:

```ts
function createGameView(model: GameModel):
        Container & { update(deltaMs: number): void } {
    const view = new Container();
    const door = createDoorView(/* bindings */);
    const scoreDisplay = createScoreDisplayView(/* bindings */);
    view.addChild(door, scoreDisplay);
    view.onRender = refresh;

    function update(deltaMs: number) {
        door.update(deltaMs);
        scoreDisplay.update(deltaMs);
    }

    function refresh() {
        // parent refresh logic...
    }

    return Object.assign(view, { update });
}
```

The entry file stays clean:

```ts
const gameView = createGameView(gameModel);
return {
    update(deltaMs) {
        gameModel.update(deltaMs);
        gameView.update(deltaMs);
    },
};
```

## When is Presentation State Really Domain State?

If presentation state starts influencing domain outcomes, it belongs in a
model instead.

| Smell | Remedy |
|---|---|
| Other code depends on the presentation state | Move to the model |
| The state influences what the model does next | Move to the model |
| Multiple views need to agree on the same progress | Move to the model |

The guiding question: **if the view were deleted,
would the application still behave correctly?** If no, the state is not purely
presentational.

## Presentation State Adds Complexity

Presentation state is necessary for polished games. But it introduces a
second kind of state in the view layer - state that advances with time, has
edge-detection logic, and interacts with model state. This makes views
harder to read, harder to test, and harder to refactor.

Real games will have views with presentation state. You cannot fully avoid it.
But you can manage the complexity. The next page covers strategies for
keeping complex views understandable.

---

**Next:** [Taming Complex Views](taming-complex-views.md) -
strategies for keeping views with presentation state under control.
