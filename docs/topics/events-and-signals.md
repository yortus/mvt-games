# Events and Signals in Game Contexts

> Events and signals are powerful reactivity tools - but game loops impose
> constraints that change the cost-benefit calculation. This page examines
> where each approach helps, and where it creates friction.

**Related:** [Reactivity: Why MVT Uses Polling](reactivity.md) -
[Change Detection](change-detection.md) -
[The Game Loop](../learn/game-loop.md)

---

## The Case for Events

Events - also called pub/sub or the observer pattern - are the oldest and most
widely used reactivity mechanism in JavaScript. A source emits named events;
subscribers register callbacks. When the event fires, each subscriber runs
synchronously.

**Zero cost when idle.** If no event fires, no subscriber code runs. There is
no per-tick polling, no getter evaluation. For infrequent, discrete
occurrences - a game-over, a level transition, a collision - events are
uniquely efficient.

**Natural fit for discrete occurrences.** Events model *things that happen*: a
keypress, a power-up collected, an enemy destroyed. These are point-in-time
notifications that don't have a persistent "current value." This is a genuine
strength that polling cannot fully replicate - if a model event fires and the
relevant state resets within the same `update()` call, polling never sees it.
Events are the only mechanism of the three that naturally models one-shot
occurrences with no persistent state.

**Decoupling without indirection.** The source defines its event contract;
consumers subscribe to what they care about. An audio manager can react to
`'enemy-destroyed'` without the game model knowing about audio.

**Discoverable API.** A model's event list serves as documentation.
`ghostModel.on('eaten', ...)` tells a new developer what the model can report.
With polling, the consumer must know which getters to watch and what
transitions are meaningful - that knowledge lives in the view, not in the
model's API surface.

**No framework needed.** `EventTarget` is built into the browser. `EventEmitter`
is built into Node. Every JS developer has used events.

## Challenges with Events

Each challenge is illustrated with an example and observations about its
implications in game development.

---

### Challenge: Synchronous events and inconsistent state

Events fire synchronously, mid-call-stack. If a model emits an event before
finishing its update, handlers see partially-updated state.

```ts
function update(deltaMs: number): void {
    score += combo * pointsPerGhost;
    emit('score-changed', score);
    // ... still updating other state ...
    combo = 0;  // handler already ran with the old combo value
}
```

The handler for `'score-changed'` runs immediately at the `emit()` call. If it
reads other model properties (like `combo`), it may see values that are about
to change on the very next line.

**Observations:**

- The fix is disciplined emit-after-mutation ordering - emit only after all
  related state is settled. But nothing enforces this. The obligation is
  invisible and easily violated during refactoring.
- In a polling system, this problem does not exist: `model.update()` finishes
  entirely before `view.refresh()` runs. Every read sees consistent
  post-update state.

---

### Challenge: Implicit coupling - model must anticipate views

The source decides what events to emit. If a new view needs to react to a
state change that no event covers, the view cannot subscribe to it. Adding the
view requires changing the model.

```ts
// Ghost model emits phase changes.
ghostModel.on('phase-changed', handler);

// A new view needs to know when the ghost enters a tunnel.
// There is no 'entered-tunnel' event.
// Options:
//   A) Add the event to GhostModel (model now serves a specific view's needs)
//   B) Poll position each tick (abandons events for this case)
```

**Observations:**

- Each new view requirement risks a model change. Over time, the model
  accumulates events that exist for specific consumers, not for the domain.
- The coupling runs backwards: views should depend on models, but here the
  model's event API evolves to serve its views.
- Polling avoids this entirely. The view watches any getter it likes. The
  model does not need to anticipate what views will care about.

---

### Challenge: Reacting to non-events (mixing paradigms)

Not everything worth reacting to is a discrete event. Conditions like "health
dropped below 25%" or "ghost is frightened AND near the player" span multiple
values and have no natural emission point.

```ts
let ghostFrightened = false;

ghostModel.on('phase-changed', (phase) => {
    ghostFrightened = phase === 'frightened';
});

// Still need a tick loop to check proximity - events can't express this.
function refresh(): void {
    if (ghostFrightened && distance(ghost, player) < 3) {
        showWarning();
    }
}
```

**Observations:**

- The view now uses two reactivity mechanisms: events for phase, polling for
  proximity. Two systems, two mental models, two sources of truth for the
  same concern.
- If watchers (change-detection) are introduced for these cases, you maintain
  both an event subscription system and a polling system side by side.
- Polling handles both cases uniformly. A single `watch()` can express any
  derived condition from any combination of readable state.

---

### Challenge: Implicit control flow (event spaghetti)

As subscriber count grows, the runtime flow of logic becomes implicit and
distributed. A single `emit()` can trigger a deep chain of handlers across
multiple modules.

```ts
// What happens when a ghost is eaten?
ghostModel.emit('ghost-eaten', ghost);

// To find out, search the entire codebase for subscribers:
//   scoreView.ts:42      - updates score display
//   audioManager.ts:17   - plays eat sound
//   comboTracker.ts:88   - increments ghost combo
//   analytics.ts:55      - logs event
//   achievementSystem.ts - checks chain-eat achievement
```

When a handler emits another event, you get cascading dispatches on the same
call stack - potentially leading to stack overflows, out-of-order state reads,
and debugging difficulty.

**Observations:**

- This is well-documented in event-based systems: the decoupling that makes
  events attractive also makes the system harder to reason about as it grows.
- The execution path through a complex event-driven system is only fully
  discoverable at runtime, not by reading the code.
- In a polling system, all reactive behaviour lives in the `refresh()` method,
  readable top-to-bottom. The execution path is the source code.

---

## The Case for Signals

Signals are reactive primitives that automatically track dependencies and
propagate changes through a computation graph. Read a signal inside an effect,
and the effect automatically re-runs when the signal changes. No manual
subscriptions, no event names, no wiring.

**Automatic dependency tracking.** Write `score()` inside an effect and the
system knows the dependency. No manual declaration, no forgotten subscriptions.

**Precise updates.** When `setScore(500)` is called, only effects that read
`score()` re-run. Effects depending on `lives()` are untouched. The system
does the minimum work necessary.

**Derived state is declarative.** `createMemo(() => enemies.filter(e => e.alive).length)` - the cache invalidates automatically when dependencies change.

**Well-supported in UI frameworks.** Signals are the reactivity foundation in
SolidJS, Angular, Vue, and the TC39 proposal. If you are building a UI app,
signals are the idiomatic choice.

**Evolving toward frame-level scheduling.** Some signal runtimes are adding
schedulers that batch signal reads to frame boundaries - converging toward
polling's timing semantics while keeping the declarative API. This is an
interesting development but does not currently eliminate the other challenges
listed below.

## Challenges with Signals

---

### Challenge: Continuous state creates a dilemma

In games, many values change every frame - positions, velocities, animation
progress. This continuous state creates a dilemma with no good resolution:

**If continuous values are signals**, every write (60/sec per value) triggers
the full reactive pipeline: dependency tracking, dirty-marking, subscriber
notification, effect re-execution. The cost is pure overhead - the view would
read these values every frame anyway.

**If continuous values are NOT signals**, effects cannot react to them. The view
must read them manually, outside the reactive system. Now you have two tiers:
some state is reactive, some is not. The distinction is invisible at the call
site.

```ts
createEffect(() => {
    // model.score is a signal - this effect reacts.
    scoreText.text = String(model.score);
});

// model.x is NOT a signal. Must read directly in a render loop.
// Cannot use inside an effect - the effect won't re-run when x changes.
function refresh(): void {
    sprite.x = model.x * SCALE;
}
```

**Observations:**

- Wrapping everything in signals means paying reactive overhead for values
  where the answer to "when should I re-evaluate?" is already "every frame."
- Not wrapping everything means the automatic tracking promise is only
  partially fulfilled - you end up managing per-frame reads manually anyway.
- Polling handles both cases uniformly: watch discrete changes, read
  continuous values directly. No dilemma.

---

### Challenge: Can effects be combined? Will behaviour change?

Three one-line effects and one three-line effect look like they should be
equivalent. They may not be.

```ts
// Version A: three separate effects
createEffect(() => { scoreText.text = String(model.score); });
createEffect(() => { livesText.text = '♥'.repeat(model.lives); });
createEffect(() => { phaseText.text = model.phase.toUpperCase(); });

// Version B: one combined effect
createEffect(() => {
    scoreText.text = String(model.score);
    livesText.text = '♥'.repeat(model.lives);
    phaseText.text = model.phase.toUpperCase();
});
```

**Observations:**

- In Version A, changing `score` only re-runs the score effect. In Version B,
  changing `score` re-runs all three updates - `lives` and `phase` text are
  redundantly rewritten.
- Combining effects changes the granularity of reactivity. Splitting them
  changes it too. The developer must understand the dependency tracking model
  to know which is correct.
- This is not a concern the developer should have to reason about. In a
  polling system, the `refresh()` method runs top-to-bottom every frame. The
  structure of the code does not affect which values are read.

---

### Challenge: Batching - an invisible correctness requirement

When multiple signals change in the same operation, effects must see the final
state, not intermediate states. Signal runtimes provide `batch()` for this.

```ts
batch(() => {
    setScore(newScore);
    setLevel(newLevel);
});
// Effects see both changes together, not score-then-level.
```

**Observations:**

- Without `batch()`, effects may fire between the two writes, seeing
  inconsistent state (new score, old level). Whether this causes a visible bug
  depends on what the effect does - making the failure mode intermittent.
- The developer must know when batching is needed, which writes are "related,"
  and what happens if they forget. The runtime provides the mechanism; the
  developer provides the discipline.
- In a polling system, batching is unnecessary. All model updates complete
  before any view reads. Consistency is structural, not opt-in.

---

### Challenge: Signals vs plain functions - the invisible boundary

Signal accessors and ordinary functions look identical at the call site. A
developer reading an effect must know *which* calls are signals to understand
what the effect reacts to.

```ts
createEffect(() => {
    const speed = getBaseSpeed() * getDifficultyMultiplier();
    enemySprite.animationSpeed = speed;
});
```

If `getBaseSpeed` is a signal but `getDifficultyMultiplier` is a plain getter,
this effect reacts to speed changes but *silently ignores* difficulty changes.

**Observations:**

- The bug is invisible in code review. It manifests only when difficulty
  changes independently of speed - a scenario that may be rare in testing.
- Refactoring a signal to a plain getter (or vice versa) silently changes
  reactive behaviour. The type system cannot enforce the distinction.
- Third-party values that are not signal-wrapped cannot participate in effects
  at all. If you consume values from a library that uses plain properties,
  you must bridge them into your own signals each tick - recreating the
  polling you were trying to avoid.
- Polling treats all readable state uniformly. Any getter can be watched,
  regardless of how the source implemented it.

---

### Challenge: Complex state - nested objects, arrays, and collections

Games have complex state: arrays of enemies, nested tile grids, inventories
with items that have their own properties. Modelling these with signals is
non-trivial.

| Strategy | Tradeoff |
|----------|----------|
| Signal holding an array | Loses granularity - any item change replaces the entire array |
| Map of signals (one per item property) | Granular but verbose; lifecycle management for each signal |
| Framework stores (SolidJS `createStore`) | Automatic granularity but framework-specific; complex mental model |
| Version counter signal | Recreates event semantics - defeats the purpose of automatic tracking |

```ts
// Approach: signal holding an array
const [enemies, setEnemies] = createSignal<Enemy[]>([]);

// Adding an enemy requires immutable update:
setEnemies(prev => [...prev, newEnemy]);
// This allocates a new array every time. Effects that read enemies()
// re-run on every add/remove, even if they only care about one enemy.

// Per-tick position updates?
// Option A: Each enemy.x is a signal → 60 signal writes/sec × N enemies
// Option B: Positions are plain → effects can't track them
```

**Observations:**

- There is no single clear way to model collections with signals. Each
  strategy has tradeoffs that leak into how models are written.
- The choice of signal granularity (per-collection vs per-item vs
  per-property) affects both performance and what effects can react to.
  This couples the model's internal structure to the view's reactive needs.
- Framework-specific solutions (SolidJS stores) work within that framework
  but are not portable. If your game code needs to work outside a specific
  framework, stores are not an option.
- With polling, models use plain arrays and objects. Views watch derived
  scalars like `() => enemies.length` to detect structural changes. No
  immutable update patterns, no granularity decisions, no framework coupling.

---

## Other Approaches

Events and signals are the most common alternatives, but a few other patterns
appear in game development.

### Command / message queues

A model produces messages during `update()` (e.g. `{ kind: 'enemy-destroyed', id: 42 }`); the view consumes them during `refresh()` and clears the queue.
This is a push model that avoids the synchronous-emission problems of events
because messages are deferred, not dispatched inline. It also solves the
transient-state problem - a change-and-revert within one `update()` still
leaves a message in the queue.

The tradeoff is that models now maintain a queue, consumers must drain it each
frame, and the queue itself becomes part of the model's API. For cross-cutting
fire-and-forget concerns (audio cues, analytics), a message queue can be a
clean complement to polling.

### State machines / statecharts

For discrete state like game phases, entity modes, and lifecycle stages,
formalised state machines (e.g. XState-style statecharts) offer structured
transition logic and guard conditions. In MVT, the model often *is* a state
machine internally - the view polls the current state each frame. State
machines are a modelling technique for the *model layer*, orthogonal to the
reactivity mechanism between model and view.

### Reactive streams (RxJS-style)

Observable streams compose asynchronous event sequences with operators like
`debounce`, `throttle`, `combineLatest`. In game contexts, streams are rarely
used for continuous state (the overhead is significant) but can be useful for
input processing pipelines. The subscription and disposal lifecycle adds the
same cleanup burden as events. For most game view-update needs, polling is
simpler.

### Diffing / snapshots

Some ECS-style architectures snapshot model state and diff it automatically.
This is structurally similar to polling but automated at the framework level.
The `watch()` helper is a lightweight, manual version of the same idea -
applied selectively where the developer chooses, rather than applied globally
by a framework.

---

## Summary

Events and signals are well-proven tools in the right context. Events excel at
discrete, cross-cutting notifications in loosely-coupled systems. Signals excel
at automatic dependency tracking in UI-driven applications where there is no
natural polling point.

In a tick-based game loop, both approaches introduce friction that polling
avoids:

| Concern | Events | Signals | Polling |
|---------|--------|---------|---------|
| Model complexity | Must emit events | Must wrap values in signals | Plain getters |
| Consistency | Emit-after-mutation discipline | Batching discipline | Free (update-then-read) |
| Cleanup | Manual `off()` | Manual `dispose()` | None |
| Continuous state | Wasteful or excluded | Wasteful or excluded | Direct read |
| Consumer flexibility | Limited to declared events | Limited to signal-wrapped values | Any getter |
| Control flow | Implicit, distributed | Implicit, scheduler-dependent | Explicit, top-to-bottom |
| Complex state | Event granularity decisions | Signal granularity decisions | Plain data structures |

This does not make events and signals wrong in absolute terms - they are the
right choice for many applications. It means that in a frame-based game loop
where the ticker already provides a natural polling point, the problems they
solve are already solved more simply, and the problems they introduce are
unnecessary.

---

**See also:** [Reactivity: Why MVT Uses Polling](reactivity.md) -
[Change Detection](change-detection.md)
