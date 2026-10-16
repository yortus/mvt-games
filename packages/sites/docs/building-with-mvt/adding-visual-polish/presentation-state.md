# Presentation State

> Most views are pure projections of model state. Occasionally a view needs
> its own cosmetic state - a fade effect, a smoothed score counter, a screen
> shake - for visual feedback that the model doesn't track. This page explains
> what presentation state is, when it is useful, and how to implement it.

**Related:** [Views (Learn)](../presenting-the-world/views.md) -
[Taming Complex Views](taming-complex-views.md) -
[Phase-Based Transitions](../animating-transitions/phase-based-transitions.md) -
[View Composition](../presenting-the-world/view-composition.md) -
[The Game Loop](../the-game-loop.md) -
[Sound and Music](../presenting-the-world/sound.md)

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
health. A ship flickering while invulnerable reads a model flag and
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
step, just `refresh()`.

The two steps split the work cleanly: `update()` advances presentation state
and writes nothing else, and `refresh()` writes all presentation output from
model state and presentation state. That includes structure: adding or
removing child views and display objects is output, so it happens in
`refresh()` (or at construction, for structure that never changes), never in
`update()`. Three reasons:

- **A view refreshed without an update still shows everything.** Tests and
  thumbnails often refresh a view once without updating it. Output written in
  `update()`, including a child view created there, would be missing.
- **Output stays idempotent.** `refresh()` can run any number of times with
  the same result. Output written as a side effect of advancing time cannot.
- **Frozen time freezes only state.** Skipping a subtree's `update()` (a paused
  entity) stops its presentation state advancing; its output still follows
  the model.

A view that spawns short-lived effects, such as particles, follows the same
split: `update()` advances a pool of effect records, and `refresh()` projects
the pool into display objects.

In this project, a view sets its `update(deltaMs)` and `refresh()` steps on
its container with `setUpdate(view, update)` and `setRefresh(view, refresh)`.
That is a project convention, not an MVT requirement; see
[The Game Loop](../the-game-loop.md#in-this-project-updating-and-refreshing-views).

### Example: door fade

```ts
const FADE_DURATION_MS = 300;

function DoorView(bindings: DoorViewBindings): Container {
    const view = new Container();
    const sprite = new Sprite(doorTexture);
    view.addChild(sprite);
    setUpdate(view, update);
    setRefresh(view, refresh);

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

    return view;
}
```

The presentation state is `fadeProgress` - a value between 0 (fully
transparent, door open) and 1 (fully opaque, door closed). The `update()`
function moves it toward the model's current state at a fixed rate. The
`refresh()` function applies it to the sprite. If the model flips mid-fade,
the transition reverses smoothly.

### Start valid: the first refresh may come before the first update

`fadeProgress` starts matching the model, not at an arbitrary value that the
first `update()` corrects. A view's first `refresh()` can run before its first
`update()`:

- A view built during the refresh step (an item view for a newly added
  entity, a grid rebuilt when its size changes) is refreshed on the frame it
  appears, but its first update is on the next frame. The update step
  advances the views that existed when the frame's time step began; a view
  created after that has no elapsed time to catch up on.
- Tests and thumbnails often refresh a view once without updating it at all.

So initialise presentation state at construction, from the bindings if it
depends on them, and never write a `refresh()` that is only correct once
`update()` has run. The same holds for a view model: its state must be
readable, and sensible, before its first `update()`.

### No forwarding through the view tree

A view with presentation state is an ordinary `Container`. Its parent adds it
like any other child and does nothing else:

```ts
function GameView(bindings: GameViewBindings): Container {
    const view = new Container();
    view.addChild(
        DoorView(/* bindings */),
        ScoreDisplayView(/* bindings */),
    );
    return view;
}
```

The host updates and refreshes the whole stage once per frame, after the
models:

```ts
app.ticker.add((ticker) => {
    gameModel.update(ticker.deltaMS);
    updateView(app.stage, ticker.deltaMS);  // every update method
    refreshView(app.stage);                 // then every refresh method
});
```

`updateView` finds every update method in the tree, however deep, and calls
it before its descendants'. There is no chain of parents to keep in step: adding
presentation state to a view deep in the tree needs no change anywhere else.
Hand-forwarding `update()` through each parent, as earlier versions of this
project did, fails silently when any link is missed - the animation simply
never advances.

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
