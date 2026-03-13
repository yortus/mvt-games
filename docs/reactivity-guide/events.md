# Events (Pub/Sub)

The event pattern — also called publish/subscribe, observer, or event emitter —
is the oldest and most widely used reactivity mechanism in JavaScript.

> **Navigation:** [README](README.md) · [Push vs Pull](push-vs-pull.md) ·
> Events · [Signals](signals.md) · [Watchers](watchers.md) ·
> [Comparison](comparison.md) · [Examples](examples.md)

---

## How It Works

A **source** maintains a list of subscriber callbacks. When something
interesting happens, the source **emits** an event, calling each subscriber
with an optional payload. Subscribers register with `on()` (or `addEventListener`)
and unregister with `off()` (or `removeEventListener`).

```
Source                          Subscribers
──────                          ───────────
emit('score-changed', 500) ──► handler A(500)
                           ──► handler B(500)
                           ──► handler C(500)
```

This is a pure **push** model: the source decides when to notify, and
subscribers react immediately (synchronously in most JS implementations).

## Minimal Working Example

A score system for a Pac-Man-style game, implemented with the built-in browser
`EventTarget`:

```typescript
// --- Event source (model layer) ---

class ScoreModel extends EventTarget {
    #score = 0;
    #lives = 3;

    get score() { return this.#score; }
    get lives() { return this.#lives; }

    addPoints(points: number): void {
        this.#score += points;
        this.dispatchEvent(new CustomEvent('score-changed', { detail: this.#score }));
    }

    loseLife(): void {
        this.#lives--;
        this.dispatchEvent(new CustomEvent('lives-changed', { detail: this.#lives }));

        if (this.#lives <= 0) {
            this.dispatchEvent(new CustomEvent('game-over'));
        }
    }
}

// --- Subscriber (view layer) ---

function createHudView(scoreModel: ScoreModel, stage: Container): { destroy(): void } {
    const scoreText = new Text({ text: '0', style: { fill: 'white', fontSize: 24 } });
    const livesText = new Text({ text: '♥♥♥', style: { fill: 'red', fontSize: 24 } });
    livesText.y = 30;
    stage.addChild(scoreText, livesText);

    // Subscribe to events
    const onScoreChanged = (e: Event) => {
        scoreText.text = String((e as CustomEvent).detail);
    };
    const onLivesChanged = (e: Event) => {
        livesText.text = '♥'.repeat((e as CustomEvent).detail);
    };

    scoreModel.addEventListener('score-changed', onScoreChanged);
    scoreModel.addEventListener('lives-changed', onLivesChanged);

    return {
        destroy() {
            // MUST unsubscribe to avoid leaks
            scoreModel.removeEventListener('score-changed', onScoreChanged);
            scoreModel.removeEventListener('lives-changed', onLivesChanged);
            stage.removeChild(scoreText, livesText);
        },
    };
}

// --- Usage ---
const score = new ScoreModel();
const hud = createHudView(score, app.stage);

score.addPoints(100);  // HUD updates immediately
score.loseLife();       // HUD updates immediately
hud.destroy();          // Cleans up subscriptions
```

## Common Implementations in TS/JS

| Implementation | Environment | Notes |
|---|---|---|
| `EventTarget` / `addEventListener` | Browser DOM | Built-in; verbose with `CustomEvent`; no type safety for event names or payloads |
| Node.js `EventEmitter` | Node.js | String-keyed events; `on`/`off`/`emit`; supports `once()` |
| [mitt](https://github.com/developit/mitt) | Universal | ~200 bytes; typed event map; `on`/`off`/`emit` |
| [eventemitter3](https://github.com/primus/eventemitter3) | Universal | Fast; Node-style API; works in browsers |
| Custom typed emitter | Universal | Common in large codebases; see typed example below |

### Typed Event Emitter Pattern

A common pattern for type-safe events without a library:

```typescript
// Generic typed emitter
interface TypedEventMap {
    'score-changed': number;
    'lives-changed': number;
    'game-over': void;
}

type EventCallback<T> = T extends void ? () => void : (payload: T) => void;

interface TypedEmitter<TMap> {
    on<K extends keyof TMap>(event: K, handler: EventCallback<TMap[K]>): void;
    off<K extends keyof TMap>(event: K, handler: EventCallback<TMap[K]>): void;
    emit<K extends keyof TMap>(event: K, ...args: TMap[K] extends void ? [] : [TMap[K]]): void;
}

function createEmitter<TMap>(): TypedEmitter<TMap> {
    const handlers = new Map<keyof TMap, Set<Function>>();

    return {
        on(event, handler) {
            let set = handlers.get(event);
            if (!set) { set = new Set(); handlers.set(event, set); }
            set.add(handler);
        },
        off(event, handler) {
            handlers.get(event)?.delete(handler);
        },
        emit(event, ...args) {
            const set = handlers.get(event);
            if (set) { for (const fn of set) fn(...args); }
        },
    };
}
```

Usage:

```typescript
const events = createEmitter<TypedEventMap>();

events.on('score-changed', (score) => {
    // `score` is typed as `number` — no casting needed
    scoreText.text = String(score);
});

events.emit('score-changed', 500); // type-checked: must be number
events.emit('game-over');           // type-checked: no payload
```

## Benefits

### 1. Zero cost when nothing happens

If no event is emitted, no subscriber code runs. There is no per-tick polling,
no getter evaluation, no comparison. The system is completely idle between
events. This is uniquely efficient for **infrequent, discrete state changes** —
a game-over event, a level-complete transition, a user clicking a button.

### 2. Immediate, synchronous propagation

In most JS implementations, `emit()` calls subscribers synchronously and
in-order. The response to an event happens *within the same call stack* as the
emission. This is useful when the subscriber needs to act before the emitter
continues — for example, a "will-destroy" event that lets views clean up before
a model is removed.

### 3. Natural fit for discrete, one-off occurrences

Events model **things that happen** — a collision, a keypress, a network
response, a level transition. They are a natural fit for discrete occurrences
that don't have a persistent "current value." Contrast with signals or watchers,
which model **ongoing state** — "the score is 500", "the phase is spinning".

### 4. Decoupling without indirection

The source defines the events it can emit. Consumers subscribe to events they
care about. Neither needs to know about the other's implementation. This makes
events a good choice for **plugin architectures** and **loosely-coupled module
boundaries** — an audio manager subscribes to game events without the game
knowing about audio.

```typescript
// Game doesn't know about audio
gameModel.on('enemy-destroyed', () => audioManager.play('explosion'));
gameModel.on('power-up-collected', () => audioManager.play('power-up'));
```

### 5. Well-understood, no framework needed

Events are built into the browser (`EventTarget`, DOM events) and Node.js
(`EventEmitter`). Every JS developer has used them. The pattern requires no
external library, no build-time compilation, and no runtime framework.

## Drawbacks

### 1. Subscription lifecycle is manual and error-prone

Every `on()` must be paired with a corresponding `off()`. Forgetting the `off()`
is the single most common source of memory leaks in event-driven JS code.

```typescript
// Pac-Man ghost view — subscribes when created
const onPhaseChanged = (phase: string) => { /* update ghost appearance */ };
ghostModel.on('phase-changed', onPhaseChanged);

// If the ghost is destroyed but we forget to call off()...
// ghostModel STILL holds a reference to onPhaseChanged,
// which holds a reference to the ghost view's closure scope.
// The ghost view is never garbage collected.
```

In a game where entities are created and destroyed frequently — enemies in
Space Invaders, asteroids in Asteroids, blocks in Tetris — each lifecycle
boundary is a potential leak if cleanup is missed. The failure mode is silent:
no error is thrown, the handler just keeps firing on a detached view, consuming
CPU and preventing GC.

**Mitigation:** Centralise cleanup with a disposable pattern:

```typescript
function createDisposable(): { add(fn: () => void): void; dispose(): void } {
    const cleanups: (() => void)[] = [];
    return {
        add(fn) { cleanups.push(fn); },
        dispose() { for (const fn of cleanups) fn(); cleanups.length = 0; },
    };
}

// Usage in a view
const cleanup = createDisposable();
cleanup.add(() => model.off('score-changed', onScoreChanged));
cleanup.add(() => model.off('lives-changed', onLivesChanged));
// ...
// On destroy — one call, everything cleaned up
cleanup.dispose();
```

This helps, but the discipline of calling `cleanup.add()` for every subscription
remains a manual obligation.

### 2. No "current value" — late subscribers miss history

An event is a point-in-time notification. If a subscriber registers *after* an
event was emitted, it never sees it.

```typescript
scoreModel.emit('score-changed', 500);

// View subscribes AFTER the event — it has no idea the score is 500
scoreModel.on('score-changed', (score) => {
    scoreText.text = String(score);
});
// scoreText still shows the initial value, not 500
```

This is a common source of bugs in initialisation flows: a view is created
after the model has already been initialised, and misses the first state. The
typical workaround is to manually read the current value after subscribing:

```typescript
scoreModel.on('score-changed', (score) => { scoreText.text = String(score); });
scoreText.text = String(scoreModel.score); // manual initial sync
```

This duplicates the update logic and is easy to forget. Signals and watchers
avoid this problem entirely because they always expose the current value.

### 3. Event names are stringly-typed (in many implementations)

Without a typed event map (see above), event names are plain strings. Typos are
not caught at compile time:

```typescript
// Oops — 'socre-changed' will never fire. No error.
model.on('socre-changed', handler);
```

Typed event maps solve this but require investment in boilerplate or a
library. DOM events are particularly bad here — `addEventListener` accepts any
string.

### 4. Ordering and cascade risks

When an event handler emits another event, you get **cascading events** — a
chain of synchronous dispatches on the same call stack. This can cause:

- **Stack overflow** if events form a cycle (A → B → A → B → ...).
- **Out-of-order state** if a handler reads state that hasn't been fully
  updated yet (the emitter is still mid-mutation when the handler runs).
- **Debugging difficulty** — a single `emit()` call can trigger a deep chain
  of handlers across multiple modules. Stack traces become hard to follow.

```typescript
// Cascade example
scoreModel.on('score-changed', (score) => {
    if (score >= 10000) {
        livesModel.addLife();  // This emits 'lives-changed'...
        // ...which triggers the lives handler synchronously,
        // before this score handler has returned.
    }
});
```

**Mitigation:** Avoid emitting events from within event handlers. If
unavoidable, defer with `queueMicrotask()` or a deferred dispatch queue — but
this introduces asynchrony and ordering complexity.

### 5. Source must pre-declare events of interest

The source decides which events to emit. If the consumer wants to react to a
state change that the source doesn't emit an event for, the consumer is stuck.
Adding a new event requires modifying the source — breaking the decoupling that
events were meant to provide.

```typescript
// Consumer wants to know when score exceeds 10,000
// But ScoreModel only emits 'score-changed' — not 'high-score-reached'
// Options: modify ScoreModel (breaks decoupling), or do the check yourself
// in every 'score-changed' handler (duplicated across consumers)
```

Signals and watchers avoid this: consumers define what they watch, and can
derive any condition from any readable state.

## When Events Are a Good Fit

- **Discrete, one-off occurrences** that don't have a "current value": game
  over, level complete, achievement unlocked, network disconnected.
- **Cross-cutting concerns** where loose coupling matters: audio, analytics,
  logging, undo/redo systems.
- **Plugin or extension architectures** where the core system shouldn't know
  about its consumers.
- **User input in UI-driven apps**: button clicks, form submissions, route
  changes.

## When Events Are a Poor Fit

- **Continuous or per-frame state** like entity positions, animation progress,
  or tween values — emitting an event 60 times per second is expensive and
  misuses the abstraction.
- **State synchronisation** between model and view — events require manual
  initial sync and careful lifecycle management, whereas signals and watchers
  handle current-value access natively.
- **Derived state** — "react when score > 10,000" requires the consumer to
  check the condition on every `score-changed` event. Signals and watchers let
  the consumer express derived conditions directly.

## Testing Considerations

Events are straightforward to test. You can emit events and assert that handlers
run, or subscribe a spy and assert on emissions:

```typescript
// Test: ScoreModel emits 'score-changed' with the new score
const model = new ScoreModel();
const received: number[] = [];
model.on('score-changed', (score) => received.push(score));

model.addPoints(100);
model.addPoints(200);

assert.deepEqual(received, [100, 300]);
```

However, testing *subscription lifecycle* is harder. You need to verify that a
destroyed view actually unsubscribed — which typically means asserting on
internal state or listener counts, neither of which is ideal.

---

> **Next:** [Signals](signals.md) — push-pull reactivity with automatic
> dependency tracking.
