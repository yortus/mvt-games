# Push vs Pull Reactivity

A conceptual framework for understanding how state changes propagate through an
application.

> **Navigation:** [Overview](./) · Push vs Pull ·
> [Events](events.md) · [Signals](signals.md) · [Watchers](watchers.md) ·
> [Comparison](comparison.md) · [Examples](examples.md)

---

## The Core Question

When state changes somewhere in your application, _how does dependent code find
out?_ Every reactivity system answers this question, and the answer is some combination of two broad approaches: **push** and **pull**.

## Push: The Source Notifies

In a **push** model, the thing that changed is responsible for telling
interested parties. The source _pushes_ the update outward.

```
┌────────┐  "I changed!"   ┌────────────┐
│ Source │ ──────────────► │ Consumer A │
│        │ ──────────────► │ Consumer B │
└────────┘                 └────────────┘
```

The consumer registers interest in advance (subscribes). When the source
changes, it iterates its subscriber list and notifies each one. The consumer
does not need to do anything per-tick - it receives updates automatically.

**Canonical examples:** DOM events, Node.js `EventEmitter`, RxJS observables,
SolidJS/Angular signals (effects are pushed to), the Observer pattern.

**Key characteristics:**

| Property                    | Push                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Who initiates propagation?  | The source                                                                                             |
| When does the consumer run? | When notified (asynchronous or synchronous, depending on implementation)                               |
| Cost when nothing changes   | Zero - no notifications, no consumer work                                                              |
| Cost when something changes | Proportional to number of subscribers                                                                  |
| Consumer setup              | Must subscribe (and later unsubscribe)                                                                 |
| Timing control              | Determined by the source or a scheduler                                                                |
| GC pressure                 | Subscriber list and callback closures are long-lived; low churn unless subscriptions change frequently |

## Pull: The Consumer Checks

In a **pull** model, the consumer is responsible for checking whether something
changed. The consumer _pulls_ the current state at a time of its choosing.

```
┌────────┐  "Did you change?"  ┌────────────┐
│ Source │ ◄─────────────────  │  Consumer  │
│        │ ──────────────────► │            │
└────────┘  "Here's my value"  └────────────┘
```

There is no subscription. The consumer reads the source on its own schedule -
typically on each tick of a loop or in response to a user action. The source
does not know it is being observed.

**Canonical examples:** game-loop polling, React's `render()` with virtual DOM
diffing, Angular's original dirty-checking (pre-Ivy), the watcher pattern
described in this guide.

**Key characteristics:**

| Property                    | Pull                                                                             |
| --------------------------- | -------------------------------------------------------------------------------- |
| Who initiates propagation?  | The consumer                                                                     |
| When does the consumer run? | On its own schedule (e.g. every tick)                                            |
| Cost when nothing changes   | Fixed - consumer always checks                                                   |
| Cost when something changes | Same as when nothing changes                                                     |
| Consumer setup              | Just read - no subscription needed                                               |
| Timing control              | Consumer decides when to check                                                   |
| GC pressure                 | Minimal - a cached value and a getter closure per watcher; no subscription graph |

## Hybrid: Push Notification, Pull Value

Most real systems are hybrids. Signals, for example, are often described as
"push-pull": notification of a change is _pushed_ (the dependency graph triggers
re-evaluation), but the actual value is _pulled_ (the computation reads the
signal's current value when it runs).

```
┌────────┐  "Something changed"  ┌───────────┐  "Give me the value"   ┌────────┐
│ Signal │ ────────────────────► │ Scheduler │ ─────────────────────► │ Signal │
│ Write  │                       │           │ ◄───────────────────── │ Read   │
└────────┘                       └───────────┘  "Here: 42"            └────────┘
```

This hybrid model aims to combine the efficiency of push (no wasted work) with
the consistency of pull (read current values at a controlled time). The
trade-off is complexity: the system needs a scheduler to coordinate when pulls
happen after pushes.

## State vs Change

Pull-based systems model state, while push-based
systems model change. In each paradigm, one of _state_ and _transition_ is
explicit while the other is implicit.

|                      | State (current value)                              | Transition (what changed)                            |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| **Push** (events)    | Implicit - consumer must read or remember it       | Explicit - the notification IS the change            |
| **Pull** (watchers)  | Explicit - the consumer always reads current value | Implicit - detected by comparing current to previous |
| **Hybrid** (signals) | Explicit (signal holds current value)              | Explicit (write triggers notification)               |

In a push system, you _know something changed_ but must take extra steps to know
the current state. A late subscriber has no state to read. In a pull system, you
_always know the current state_ but must do work to detect that a change
occurred.

This duality shapes each approach's strengths and failure modes:

- **Events** excel at reacting to transitions ("Pac-Man ate a power pellet")
  but may not make the current state available ("What is the score right now?"). Late
  subscribers may miss history.
- **Watchers** excel at reflecting current state ("The score is 5,000") but
  require per-tick work to detect transitions ("the score just changed"). Changes are never missed - the
  current value is always available.
- **Signals** aim to be explicit in both dimensions - you can read the current
  value and react to changes - at the cost of a more complex runtime to
  coordinate these two responsibilities.

Understanding this duality helps explain why most real systems benefit from
mixing approaches: events for discrete transitions, watchers or signals for
continuous state.

## Where Each Approach in This Guide Falls

| Approach                | Model              | Notification                              | Value retrieval                           |
| ----------------------- | ------------------ | ----------------------------------------- | ----------------------------------------- |
| [Events](events.md)     | Push               | Source emits to subscriber list           | Payload delivered with the notification   |
| [Signals](signals.md)   | Hybrid (push-pull) | Dependency graph marks computations dirty | Computation re-reads signals when it runs |
| [Watchers](watchers.md) | Pull               | Consumer polls on each tick               | Getter evaluated and compared to cache    |

Understanding where each approach falls on the push-pull spectrum helps explain
its performance characteristics, correctness properties, and failure modes -
all of which are covered in detail in the individual sections.

## Other Approaches Worth Knowing

For completeness, several other reactivity mechanisms exist in the TS/JS
ecosystem. They are not covered in depth in this guide, but are briefly
described here for context.

### Observable Streams (RxJS)

RxJS models reactivity as **streams of values over time**, composed with
operators (`map`, `filter`, `debounce`, `combineLatest`, etc.). It is a
push-based model where the source emits values and the consumer subscribes.

```typescript
import { fromEvent, map, throttleTime } from 'rxjs';

const mouseX$ = fromEvent<MouseEvent>(document, 'mousemove').pipe(
    throttleTime(16),
    map((e) => e.clientX),
);

const subscription = mouseX$.subscribe((x) => {
    paddle.position.x = x; // Breakout paddle follows mouse
});

// Cleanup:
subscription.unsubscribe();
```

RxJS excels at modelling **asynchronous data flows** - HTTP responses, WebSocket
messages, user input sequences, complex event coordination. It is less natural
for synchronous per-frame state like game entity positions, where the
stream-of-events model adds indirection over a simple property read.

**When to consider:** async data flows, complex event composition (debounce,
throttle, retry, race conditions), server-push architectures.

**When to avoid:** synchronous per-frame rendering, simple state→view bindings
where the overhead of stream operators is unnecessary.

### Proxy-Based Observation (MobX, Vue 3 Reactivity)

MobX and Vue's reactivity system use JavaScript `Proxy` (or
`Object.defineProperty`) to intercept property reads and writes, automatically
building a dependency graph without explicit signal declarations.

```typescript
import { makeAutoObservable, autorun } from 'mobx';

class ScoreModel {
    score = 0;
    lives = 3;
    constructor() {
        makeAutoObservable(this);
    }
}

const model = new ScoreModel();

autorun(() => {
    scoreDisplay.text = `Score: ${model.score}`;
    // MobX tracks that this function reads `model.score`
    // and re-runs it when `score` changes.
});

model.score += 100; // autorun re-fires automatically
```

This shares the same push-pull hybrid model as signals but with **implicit**
rather than explicit observable declarations. The trade-off: less boilerplate to
declare observables, but harder to reason about what is and isn't tracked. The
proxy interception also adds overhead to every property access, not just those
inside reactive contexts. Additionally, the proxy layer creates objects on reads
(trapped getter results), contributing to **GC pressure** under high-frequency
access patterns.

### Dirty Flags / Version Stamps

A lightweight pull mechanism where the source maintains a version counter or
dirty flag, and the consumer checks only the counter rather than the full value:

```typescript
// Source
let items: Item[] = [];
let version = 0;

function addItem(item: Item) {
    items.push(item);
    version++;
}

// Consumer
let lastVersion = -1;
function refresh() {
    if (version !== lastVersion) {
        lastVersion = version;
        rebuildView(items);
    }
}
```

This is technically a variant of the pull model with O(1) comparison cost. It
requires cooperation from the source (every mutation must bump the version),
but avoids both the subscription overhead of push models and the per-element
comparison cost of deep-checking pull models. Because there is no subscription
graph and comparisons are integer-only, GC pressure is near zero. It is commonly
used in game engines and ECS (Entity Component System) architectures.

---

> **Next:** [Events](events.md) - the first of the three primary approaches.
