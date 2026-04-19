# Taming Complex Views

> Presentation state is necessary for polished games, but it makes views
> harder to understand, test, and refactor. This page covers strategies for
> keeping complex views under control.

**Related:** [Presentation State](presentation-state.md) -
[Views (Learn)](../learn/views.md) -
[View Composition](view-composition.md) -
[Testing Views](testing-views.md)

---

*Assumes familiarity with [Presentation State](presentation-state.md).*

## The Problem

A view with presentation state has more to manage than a pure projection:
edge detection, timers, progress values, intermediate states. Add multiple
such transitions to a single view and the `update()` and `refresh()` methods
grow tangled. The interactions between transitions become hard to reason
about, hard to test through visual output, and hard to change without
breaking something.

Real games have complex views. A board view might track match animations,
score popups, shake effects, and particle spawns. A player HUD might smooth
score counters, flash damage indicators, and animate status icons. You cannot
fully avoid this complexity - but you can structure it so each piece is
manageable on its own.

Three strategies, in order of preference:

## Strategy 1: Split Into Focused Sub-Views

The most effective way to manage complexity is to avoid it in a single view.
If a view tracks multiple independent transitions, each transition can often
be its own sub-view with a single responsibility.

**Before** - one view doing too much:

```ts
function createPlayerHudView(bindings: PlayerHudBindings):
        Container & { update(deltaMs: number): void } {
    // ... scene graph setup ...

    let displayedScore = 0;       // smooth score counter
    let flashTimerMs = 200;       // damage flash
    let wasDamaged = false;       // edge detection for flash
    let iconBounceMs = 300;       // status icon animation
    let wasBuffed = false;        // edge detection for icon

    function update(deltaMs) {
        // score smoothing...
        // damage flash logic...
        // icon bounce logic...
        // all interleaved, all in one place
    }

    function refresh() {
        // reads all five state variables plus bindings
        // hard to tell which state drives which visual
    }

    view.onRender = refresh;
    return Object.assign(view, { update });
}
```

**After** - each concern in its own sub-view:

```ts
function createPlayerHudView(bindings: PlayerHudBindings):
        Container & { update(deltaMs: number): void } {
    const view = new Container();
    const scoreCounter = createSmoothScoreView(/* score bindings */);
    const damageFlash = createDamageFlashView(/* health bindings */);
    const statusIcon = createStatusIconView(/* buff bindings */);
    view.addChild(scoreCounter, damageFlash, statusIcon);

    function update(deltaMs) {
        scoreCounter.update(deltaMs);
        damageFlash.update(deltaMs);
        statusIcon.update(deltaMs);
    }

    return Object.assign(view, { update });
}
```

Each sub-view has a single focus: one piece of presentation state, one edge
to detect, one visual to update. The parent composes them without knowing
their internals.

**When this works:** the transitions are independent - they don't interact
with each other and don't share state. Most transitions in practice are
independent.

## Strategy 2: Extract Reusable Helpers

Some presentation patterns recur across many views: smoothing a value toward
a target, tweening a boolean into a progress value, playing a one-shot
effect on a rising edge. Rather than reimplementing these inline each time,
extract them into small, tested utility modules.

### Boolean-to-progress tweens

A boolean model value (door open/closed, menu visible/hidden) needs to
become a 0-to-1 progress for smooth transitions. The `BooleanTween` helper
encapsulates this:

```ts
const doorTween = createBooleanTween({
    getSource: () => bindings.isDoorOpen(),
    offValue: 0,     // closed
    onValue: 1,      // open
    onDurationMs: 300,
    offDurationMs: 200,
    onEasing: easeOutQuad,
});

// In update():
doorTween.update(deltaMs);

// In refresh():
door.alpha = doorTween.value;
```

The tween handles mid-transition reversals (door opens while still closing),
easing curves, and the edge detection - all tested independently.

### One-shot edge tweens

A model event (enemy hit, item collected) should trigger a brief visual
effect that plays once and returns to rest. The `EdgeTween` helper handles
this:

```ts
const hitFlash = createEdgeTween({
    getSource: () => bindings.wasHit(),
    triggerValue: 1,   // full flash on hit
    restValue: 0,      // invisible at rest
    durationMs: 150,
    easing: easeOutExpo,
});

// In update():
hitFlash.update(deltaMs);

// In refresh():
overlay.alpha = hitFlash.value;
```

### Easing functions

Easing functions map linear progress (0-1) to curved progress. They are pure
functions with no state - trivially testable and reusable:

```ts
function easeOutQuad(t: number): number {
    return t * (2 - t);
}

function easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
```

### Why extract helpers?

- **Testable in isolation.** A `BooleanTween` can be tested by calling
  `update()` with known deltas and asserting on `value`. No scene graph,
  no rendering context.
- **Reusable.** The same tween logic works for doors, menus, fade-ins,
  highlights - any boolean-to-progress mapping.
- **Removes noise from the view.** The view's `update()` becomes a list
  of `helper.update(deltaMs)` calls. The view's `refresh()` reads
  `helper.value` instead of managing raw timers and edge detection.

## Strategy 3: Extract a View Model

When a view's presentation logic involves coordinated multi-step sequences -
overlapping effects with specific timing relationships, choreographed
transitions where one effect triggers or gates another - splitting into
sub-views may not work because the transitions are coupled, and extracting
helpers may not suffice because the coordination logic itself is complex.

In these cases, extract the presentation state and its coordination logic
into a **view model**: a plain object with `update(deltaMs)` and readable
state, independently testable with no scene graph dependency. This is a
technique borrowed from the MVVM architecture.

### When to extract a view model

- The presentation logic involves a multi-step sequence with coordinated
  timing (shake *then* popup, fade *while* sliding)
- Multiple pieces of presentation state interact with each other
- You want to unit test the timing and transition behaviour directly
- The `update()` body has grown large enough to obscure what the view does

View models should be **rare**. Most views are simple enough that strategies
1 and 2 handle the complexity. A view model is warranted when the
coordination between transitions is itself the complex part.

### Example: match effects

A match-3 game plays overlapping shake, dust, and popup effects when tiles
match. The effects are coupled - the popup starts during the shake, the dust
spawns at a specific point in the sequence. Splitting into independent
sub-views would lose the timing relationships.

```ts
// match-effects-view-model.ts
interface MatchEffectsViewModel {
    readonly isActive: boolean;
    readonly shakeProgress: number;  // 0..1
    readonly popupProgress: number;  // 0..1
    readonly dustSpawned: boolean;
    update(deltaMs: number): void;
}

function createMatchEffectsViewModel(
    getIsMatching: () => boolean,
): MatchEffectsViewModel {
    let wasMatching = false;
    let timerMs = TOTAL_DURATION_MS;

    return {
        get isActive() { return timerMs < TOTAL_DURATION_MS; },
        get shakeProgress() { /* compute from timerMs */ },
        get popupProgress() { /* compute from timerMs */ },
        get dustSpawned() { /* true after threshold */ },
        update(deltaMs) {
            const isMatching = getIsMatching();
            if (isMatching && !wasMatching) timerMs = 0;
            wasMatching = isMatching;
            if (timerMs < TOTAL_DURATION_MS) timerMs += deltaMs;
        },
    };
}
```

The view creates the view model internally and delegates to it:

```ts
// board-view.ts
function createBoardView(bindings: BoardViewBindings):
        Container & { update(deltaMs: number): void } {
    const matchEffects = createMatchEffectsViewModel(
        () => bindings.getPhase() === 'matching',
    );

    const view = new Container();
    // ... scene graph setup ...

    function update(deltaMs) {
        matchEffects.update(deltaMs);
    }

    function refresh() {
        if (matchEffects.isActive) {
            boardContent.x = shakeOffset(matchEffects.shakeProgress);
            popup.alpha = matchEffects.popupProgress;
            if (matchEffects.dustSpawned) spawnDustParticles();
        }
    }

    view.onRender = refresh;
    return Object.assign(view, { update });
}
```

The view model is testable by calling `update()` with known deltas and
asserting on its readable properties. No Pixi.js, no containers, no
rendering.

### View model guidelines

- A view model is an internal detail of the view. The view creates and
  owns it.
- View models must not reference the scene graph (no Pixi.js imports).
- View models advance through `update(deltaMs)` only - same time rules
  as models.
- Place view models in separate files from their view, as siblings
  (e.g. `board-view.ts` and `match-effects-view-model.ts`), so they can
  be imported and tested independently.
- Use factory functions: `createXxxViewModel()`.
- If two sibling views share a view model, the nearest common parent
  creates the instance and passes it to both.

## Choosing a Strategy

| Situation | Strategy |
|---|---|
| Multiple independent transitions in one view | Split into focused sub-views |
| Recurring pattern (boolean tween, edge trigger, easing) | Extract a reusable helper |
| Coupled multi-step sequence with coordinated timing | Extract a view model |
| Simple single transition | Keep it inline - no extraction needed |

Start simple. Most presentation state is a single timer or a single tween.
Keep it inline until it earns extraction. Split into sub-views before
reaching for a view model. View models are the heaviest tool - use them when
the coordination logic itself is what needs testing.

---

**Next:** [Phase-Based Transitions](phase-transitions.md) - modelling
components that cycle through mutually-exclusive phases.

**See also:** [View Composition](view-composition.md) -
[Testing Views](testing-views.md)
