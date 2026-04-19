# Presentation State

> Most views are pure projections of model state. Occasionally a view needs
> its own state for cosmetic transitions that the model doesn't track. This
> page explains when presentation state is needed, how views own it, and
> when to extract it into a separately testable object called a view model.

**Related:** [Views (Learn)](../learn/views.md) ·
[View Composition](view-composition.md)

---

*Assumes familiarity with [Views](../learn/views.md) and [The Game Loop](../learn/game-loop.md).*

## When Is State "Cosmetic"?

A model is a standalone simulation. It determines game outcomes - scores,
deaths, matches, phase transitions. If you replayed the same inputs with no
view at all, every outcome would be identical. The model doesn't need to know
how those outcomes are communicated to the player.

State is **cosmetic** when removing it would not change any domain outcome.
It affects what the player sees, not what happens. Some concrete examples:

- A white flash overlay that fades out over 200ms when the player dies.
  The model already knows the player is dead. The flash is visual feedback.
- A score display that smoothly counts up from 100 to 200 when points are
  awarded. The model score jumped instantly. The smooth count-up is polish.
- A choreographed shake-then-popup sequence after a match event. The match
  is resolved in the model. The celebration is feedback.

These transitions need timers and progress values that advance with time -
but the model has no reason to track them, because no game logic depends on
whether the flash has finished fading or the popup has finished rising.

::: info Not all animation needs presentation state
Many view animations are driven directly from model values with no extra
state at all. A character moving across the screen reads model position. A
health bar shrinking reads model health. An entity flickering while
invulnerable reads a model flag and timer progress. These are just
`refresh()` reading model state - no presentation state involved.

Presentation state is only needed when the view introduces a transition
**that the model doesn't track** - typically a cosmetic flourish in
response to a model event.
:::

## Views With Presentation State

When a view needs presentation state, it owns that state directly. The view
gains an `update(deltaMs)` method - the same time-advancement concept used
by models - so the ticker can advance the view's state each frame.

```
Ticker loop:
  model.update(deltaMs)     -- domain state advances
  view.update(deltaMs)      -- view state advances (views that have it)
  view.refresh()            -- reads model + own state, writes to scene graph
```

Views without presentation state remain unchanged - no `update()` method,
just `refresh()`. Most views fall into this category.

### Example: Death Flash

A white flash overlay that plays for 200ms when the player dies. The view
maintains a timer and detects the dying transition:

```ts
function createDeathFlashView(bindings: DeathFlashViewBindings):
        Container & { update(deltaMs: number): void } {
    const view = new Container() as Container & { update(deltaMs: number): void };
    const gfx = new Graphics();
    gfx.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).fill(0xffffff);
    view.addChild(gfx);

    let timerMs = FLASH_DURATION_MS;
    let wasDying = false;

    view.update = (deltaMs) => {
        const isDying = bindings.isDying();
        if (isDying && !wasDying) timerMs = 0;
        wasDying = isDying;
        if (timerMs < FLASH_DURATION_MS) timerMs += deltaMs;
    };

    view.onRender = function refresh() {
        view.visible = timerMs < FLASH_DURATION_MS;
        view.alpha = timerMs < FLASH_DURATION_MS
            ? 1 - timerMs / FLASH_DURATION_MS
            : 0;
    };

    return view;
}
```

Parent views propagate `update()` to children that have it. This chains up
through the view tree so the entry file stays clean:

```ts
// Entry file - no awareness of child presentation state
const gameView = createGameView(gameModel);
return {
    update(deltaMs) {
        gameModel.update(deltaMs);
        gameView.update(deltaMs);
    },
};
```

### Receiving Time

Views with presentation state receive `deltaMs` through their `update()`
method. For the simplest cases (a single smoothed value with no edge
detection), a `getClockMs()` binding is an alternative that avoids adding
an `update()` method:

```ts
let displayedScore = 0;
let prevClockMs = 0;

function refresh(): void {
    const clockMs = bindings.getClockMs();
    const deltaMs = clockMs - prevClockMs;
    prevClockMs = clockMs;

    const target = bindings.getScore();
    const t = 1 - Math.pow(0.002, deltaMs / 1000);
    displayedScore += (target - displayedScore) * t;
    if (Math.abs(target - displayedScore) < 1) displayedScore = target;
    label.text = String(Math.round(displayedScore));
}
```

Either way, **do not hardcode frame deltas** (`timerMs += 16`). Time must
come from outside the view, keeping updates deterministic and
frame-rate-independent.

## Extracting a View Model

When a view's presentation logic grows complex - multi-step sequences,
choreographed timing across several effects, transition detection with
multiple edge triggers - the `update()` body becomes hard to read and hard
to test through the view's visual output alone.

In these cases, borrow a technique from the MVVM architecture: extract the
presentation state and its logic into a separate object called a **view
model**. The view model is a plain object with `update(deltaMs)` and
readable state - independently testable with no rendering context needed.

### When to extract

- The presentation logic involves multi-step sequences or choreography
- You want to unit test the timing and transition behaviour directly
- The `update()` body has grown large enough to obscure what the view does

### Example: Match Effects View Model

A match-3 game plays overlapping shake, dust, and popup effects when
cactii are matched. The edge detection and multi-step sequence warrant
extraction:

```ts
// match-effects-view-model.ts
interface MatchEffectsViewModel {
    readonly sequence: Sequence<'fade' | 'shake' | 'dust' | 'popup'>;
    update(deltaMs: number): void;
    createReaction(handlers: MatchEffectHandlers): () => void;
}

function createMatchEffectsViewModel(getIsMatching: () => boolean): MatchEffectsViewModel {
    const sequence = createSequence(MATCH_EFFECT_STEPS);
    let wasMatching = false;
    return {
        get sequence() { return sequence; },
        update(deltaMs) {
            const isMatching = getIsMatching();
            if (isMatching && !wasMatching) sequence.start();
            wasMatching = isMatching;
            sequence.update(deltaMs);
        },
        createReaction(handlers) {
            return createSequenceReaction(sequence, handlers);
        },
    };
}
```

The view creates the view model internally and delegates to it:

```ts
// board-view.ts
function createBoardView(bindings: BoardViewBindings):
        Container & { update(deltaMs: number): void } {
    const matchEffects = createMatchEffectsViewModel({
        getIsMatching: () => bindings.getPhase() === 'matching',
    });

    const view = new Container() as Container & { update(deltaMs: number): void };
    // ... scene graph setup ...

    const updateMatchEffects = createSequenceReaction(matchEffects.sequence, {
        shake: {
            inactive: () => boardContent.position.set(0, 0),
            active: (progress) => { /* apply shake offset */ },
        },
        popup: {
            entering: () => { /* compute popup text */ },
            active: (progress) => { /* position and fade popup */ },
        },
    });

    view.update = (deltaMs) => {
        matchEffects.update(deltaMs);
    };

    view.onRender = function refresh() {
        updateMatchEffects(); // dispatches lifecycle callbacks
    };

    return view;
}
```

### View model guidelines

- A view model is an internal detail of the view that uses it. The view
  creates and owns it.
- View models must not reference views or the scene graph (no Pixi.js
  imports).
- View models advance through `update(deltaMs)` only - the same time
  management rules as models.
- View models are closely coupled to their view. Place them as sibling
  files (e.g. `board-view.ts` and `match-effects-view-model.ts`), so that
  the extraction is visible and the view model is easy to find.
- Always place view models in separate files from their view, so that they
  can be imported and tested independently.
- Use factory functions like everything else: `createXxxViewModel()`.
- When two sibling views share a view model, the nearest common parent
  creates the shared instance and passes it to both children.

## The Boundary: When to Move State to the Model

If you find presentation state doing any of these, it belongs in the domain
model instead:

| Smell                                                               | Remedy                              |
| ------------------------------------------------------------------- | ----------------------------------- |
| Other code depends on the presentation state                        | Move to the model                   |
| The state influences what the model does next                       | Move to the model                   |
| Multiple views need to agree on the same animation progress         | Move to the model                   |
| The animation needs to be paused, replayed, or fast-forwarded       | Move to the model (ticker-driven)   |

The guiding question: **If the view were deleted and rewritten from scratch,
would the application still behave correctly?** If the answer is no, the
state is not purely presentational.

## Summary

| Where                 | What belongs there                                    |
| --------------------- | ----------------------------------------------------- |
| **Model**             | Domain state, domain logic, game rules                |
| **View**              | Stateless projection: reads state, writes to presentation output |
| **View (with state)** | Presentation state for cosmetic transitions the model doesn't track |
| **View model**        | Extracted presentation logic that warrants separate testing |
