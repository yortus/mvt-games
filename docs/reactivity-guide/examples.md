# Worked Examples

Each example implements the same feature using all three approaches — events,
signals, and watchers — so you can compare them directly. Examples use classic
arcade games and common interactive patterns that are universally understood.

> **Navigation:** [README](README.md) · [Push vs Pull](push-vs-pull.md) ·
> [Events](events.md) · [Signals](signals.md) · [Watchers](watchers.md) ·
> [Comparison](comparison.md) · Examples

---

## Example 1: Score Display (Pac-Man)

**Scenario:** Pac-Man eats a dot. The score model increments. The HUD view
updates the score text.

This is the simplest reactive pattern: a scalar value changes, a single view
responds.

### Events

```typescript
// --- Model ---
interface ScoreEvents {
    'score-changed': number;
}

function createScoreModel(emitter: TypedEmitter<ScoreEvents>) {
    let score = 0;
    return {
        get score() { return score; },
        addPoints(points: number) {
            score += points;
            emitter.emit('score-changed', score);
        },
    };
}

// --- View ---
function createScoreView(
    model: { score: number },
    emitter: TypedEmitter<ScoreEvents>,
    stage: Container,
) {
    const text = new Text({ text: '0', style: { fill: 'white' } });
    stage.addChild(text);

    // Initial sync — events don't carry history
    text.text = String(model.score);

    // Subscribe
    const onScoreChanged = (score: number) => { text.text = String(score); };
    emitter.on('score-changed', onScoreChanged);

    return {
        destroy() {
            emitter.off('score-changed', onScoreChanged);  // Must clean up
            stage.removeChild(text);
        },
    };
}
```

**Observations:**
- Model must know about the emitter and explicitly emit on every mutation.
- View must manually initialise (read `model.score` after subscribing).
- View must clean up the subscription.
- Update logic is duplicated: once in the handler, once in initialisation.

### Signals

```typescript
import { createSignal, createEffect, createRoot } from 'solid-js';

// --- Model ---
const [score, setScore] = createSignal(0);

function addPoints(points: number) {
    setScore(prev => prev + points);
}

// --- View ---
function createScoreView(stage: Container): { dispose(): void } {
    const text = new Text({ text: '0', style: { fill: 'white' } });
    stage.addChild(text);

    const dispose = createRoot((dispose) => {
        createEffect(() => {
            text.text = String(score());  // auto-tracks score signal
        });
        return dispose;
    });

    return {
        dispose() {
            dispose();  // Must clean up reactive root
            stage.removeChild(text);
        },
    };
}
```

**Observations:**
- No manual initial sync — the effect runs once on creation.
- No explicit dependency declaration — auto-tracked.
- Must manage reactive root lifecycle (`dispose()`).
- Requires SolidJS runtime.

### Watchers

```typescript
// --- Model (plain object) ---
function createScoreModel() {
    const model = { score: 0 };
    return {
        get score() { return model.score; },
        addPoints(points: number) { model.score += points; },
    };
}

// --- View ---
function createScoreView(model: { readonly score: number }, stage: Container) {
    const text = new Text({ text: '0', style: { fill: 'white' } });
    stage.addChild(text);
    const scoreWatch = createWatch(() => model.score);

    return {
        refresh() {
            if (scoreWatch.changed()) {
                text.text = String(scoreWatch.value);
            }
        },
        destroy() {
            stage.removeChild(text);
            // No subscriptions to clean up
        },
    };
}
```

**Observations:**
- Model is a plain object — no emitters, no signal wrappers.
- No manual initial sync — if `initiallyChanged` is used, the first `changed()`
  poll triggers the update. Otherwise, the initial value is picked up on the
  first change.
- No cleanup obligations beyond removing the display object.
- Requires a tick loop to call `refresh()`.

---

## Example 2: Ghost State Transitions (Pac-Man)

**Scenario:** Pac-Man's ghosts have multiple phases: `'chase'`, `'scatter'`,
`'frightened'`, `'eaten'`. When the phase changes, the ghost's appearance (sprite
texture, animation speed, colour) must update. Additionally, a sound effect
plays on certain transitions.

This tests **transition detection** — reacting not just to the new value, but
to specific from→to transitions.

### Events

```typescript
// --- Model ---
interface GhostEvents {
    'phase-changed': { from: GhostPhase; to: GhostPhase };
}
type GhostPhase = 'chase' | 'scatter' | 'frightened' | 'eaten';

function createGhostModel(emitter: TypedEmitter<GhostEvents>) {
    let phase: GhostPhase = 'scatter';
    return {
        get phase() { return phase; },
        setPhase(newPhase: GhostPhase) {
            if (newPhase === phase) return;
            const from = phase;
            phase = newPhase;
            emitter.emit('phase-changed', { from, to: newPhase });
        },
    };
}

// --- View ---
function createGhostView(
    model: { phase: GhostPhase },
    emitter: TypedEmitter<GhostEvents>,
    stage: Container,
) {
    const sprite = new Sprite();
    stage.addChild(sprite);

    // Initial appearance
    applyPhaseAppearance(sprite, model.phase);

    const onPhaseChanged = ({ from, to }: { from: GhostPhase; to: GhostPhase }) => {
        applyPhaseAppearance(sprite, to);

        // Transition-specific logic
        if (to === 'frightened') {
            audioManager.play('power-pellet');
        }
        if (from === 'frightened' && to === 'chase') {
            audioManager.play('ghost-recover');
        }
    };

    emitter.on('phase-changed', onPhaseChanged);

    return {
        destroy() {
            emitter.off('phase-changed', onPhaseChanged);
            stage.removeChild(sprite);
        },
    };
}

function applyPhaseAppearance(sprite: Sprite, phase: GhostPhase) {
    switch (phase) {
        case 'chase':      sprite.texture = ghostNormalTexture; break;
        case 'scatter':    sprite.texture = ghostNormalTexture; break;
        case 'frightened': sprite.texture = ghostBlueTexture; break;
        case 'eaten':      sprite.texture = ghostEyesTexture; break;
    }
}
```

**Observations:**
- Events naturally carry `from`/`to` — the model packages transition data.
- Transition-specific logic is clean and readable.
- The model must construct the transition payload on every phase change.
- Initial sync is manual.

### Signals

```typescript
import { createSignal, createEffect, createRoot, on } from 'solid-js';

// --- Model ---
const [phase, setPhase] = createSignal<GhostPhase>('scatter');

// --- View ---
function createGhostView(stage: Container): { dispose(): void } {
    const sprite = new Sprite();
    stage.addChild(sprite);

    const dispose = createRoot((dispose) => {
        // Track phase changes (with previous value via `on()` helper)
        createEffect(on(phase, (to, from) => {
            applyPhaseAppearance(sprite, to);

            if (to === 'frightened') {
                audioManager.play('power-pellet');
            }
            if (from === 'frightened' && to === 'chase') {
                audioManager.play('ghost-recover');
            }
        }));

        return dispose;
    });

    return {
        dispose() {
            dispose();
            stage.removeChild(sprite);
        },
    };
}
```

**Observations:**
- SolidJS's `on()` helper provides the previous value — clean API for
  transitions.
- The effect auto-syncs on creation (no manual initial sync needed).
- Requires understanding SolidJS-specific `on()` helper for accessing previous
  values (not discoverable from core `createEffect` alone).

### Watchers

```typescript
// --- Model (plain object) ---
function createGhostModel() {
    let phase: GhostPhase = 'scatter';
    return {
        get phase() { return phase; },
        setPhase(p: GhostPhase) { phase = p; },
    };
}

// --- View ---
function createGhostView(model: { readonly phase: GhostPhase }, stage: Container) {
    const sprite = new Sprite();
    stage.addChild(sprite);
    const phaseWatch = createWatch(() => model.phase);

    return {
        refresh() {
            if (phaseWatch.changed()) {
                const to = phaseWatch.value;
                applyPhaseAppearance(sprite, to);

                // Transition-specific logic requires storing previous
                // (see "previous" field discussion in watchers.md)
                if (to === 'frightened') {
                    audioManager.play('power-pellet');
                }
            }
        },
        destroy() {
            stage.removeChild(sprite);
        },
    };
}
```

**Observations:**
- For transition-specific logic (from→to), the watcher needs a `previous`
  field (see [Watchers § Design Considerations](watchers.md#design-considerations)).
  The basic `createWatch` shown here only exposes `value`. To detect specific
  from→to transitions, either extend the watcher with `previous`, or track the
  previous value manually:
    ```typescript
    let prevPhase: GhostPhase | undefined;
    // ...
    if (phaseWatch.changed()) {
        const from = prevPhase;
        const to = phaseWatch.value;
        prevPhase = to;
        if (from === 'frightened' && to === 'chase') {
            audioManager.play('ghost-recover');
        }
    }
    ```
- Model is plain — no emitter, no signals.
- No cleanup.
- Requires the tick loop.

---

## Example 3: GSAP Tween Integration

**Scenario:** A Breakout-style game. When the ball hits a brick, the brick
plays a "shatter" animation using GSAP (scale up, fade out, remove). The game
model marks the brick as destroyed; the view must animate the destruction.

This tests integration with an external animation library — a common real-world
pattern that reveals how each approach handles externally-driven state.

### Events

```typescript
// --- Model ---
interface BrickEvents {
    'brick-destroyed': { col: number; row: number };
}

function createBrickGridModel(emitter: TypedEmitter<BrickEvents>) {
    const bricks: boolean[][] = [/* initial grid */];
    return {
        isBrick(col: number, row: number) { return bricks[row][col]; },
        destroyBrick(col: number, row: number) {
            bricks[row][col] = false;
            emitter.emit('brick-destroyed', { col, row });
        },
    };
}

// --- View ---
function createBrickGridView(
    emitter: TypedEmitter<BrickEvents>,
    brickSprites: Map<string, Sprite>,
    stage: Container,
) {
    const onBrickDestroyed = ({ col, row }: { col: number; row: number }) => {
        const key = `${col},${row}`;
        const sprite = brickSprites.get(key);
        if (!sprite) return;

        // Animate destruction with GSAP
        gsap.to(sprite, {
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 0.3,
            ease: 'power2.out',
            onComplete: () => {
                stage.removeChild(sprite);
                brickSprites.delete(key);
            },
        });
    };

    emitter.on('brick-destroyed', onBrickDestroyed);

    return {
        destroy() {
            emitter.off('brick-destroyed', onBrickDestroyed);
        },
    };
}
```

**Observations:**
- Events are a natural fit here: "brick destroyed" is a discrete, one-off
  occurrence — exactly the kind of thing events model well.
- GSAP runs independently; no need to bridge tween values into a reactive
  system.
- The animation fires directly from the event handler — simple and direct.

### Signals

```typescript
import { createSignal, createEffect, createRoot, batch } from 'solid-js';

// --- Model ---
// Store destruction events as a signal that changes on each destruction.
// One approach: a counter that increments, paired with the destroyed brick's coords.
const [lastDestroyed, setLastDestroyed] = createSignal<{ col: number; row: number } | null>(null);
const [destroyVersion, setDestroyVersion] = createSignal(0);

function destroyBrick(col: number, row: number) {
    batch(() => {
        setLastDestroyed({ col, row });
        setDestroyVersion(v => v + 1);
    });
}

// --- View ---
function createBrickGridView(
    brickSprites: Map<string, Sprite>,
    stage: Container,
): { dispose(): void } {
    const dispose = createRoot((dispose) => {
        createEffect(() => {
            destroyVersion();  // track the version signal
            const brick = lastDestroyed();
            if (!brick) return;

            const key = `${brick.col},${brick.row}`;
            const sprite = brickSprites.get(key);
            if (!sprite) return;

            gsap.to(sprite, {
                alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 0.3,
                ease: 'power2.out',
                onComplete: () => {
                    stage.removeChild(sprite);
                    brickSprites.delete(key);
                },
            });
        });
        return dispose;
    });

    return { dispose() { dispose(); stage.removeChildren(); } };
}
```

**Observations:**
- Signals are awkward for discrete events. There is no "fire and forget" —
  you must change a value and have the effect detect the change. Using a version
  counter is a workaround that recreates event semantics inside the signal model.
- An alternative is to use SolidJS stores with array mutations, but the core
  issue remains: signals model *state*, not *events*.
- This is a case where the wrong abstraction adds complexity. An event system
  would be more natural here.

### Watchers

```typescript
// --- Model ---
function createBrickGridModel() {
    const bricks: boolean[][] = [/* initial grid */];
    let lastDestroyed: { col: number; row: number } | undefined;
    let destroyVersion = 0;

    return {
        isBrick(col: number, row: number) { return bricks[row][col]; },
        get destroyVersion() { return destroyVersion; },
        get lastDestroyed() { return lastDestroyed; },
        destroyBrick(col: number, row: number) {
            bricks[row][col] = false;
            lastDestroyed = { col, row };
            destroyVersion++;
        },
    };
}

// --- View ---
function createBrickGridView(model: BrickGridModel, stage: Container) {
    const brickSprites = new Map<string, Sprite>();
    const destroyWatch = createWatch(() => model.destroyVersion);

    return {
        refresh() {
            if (destroyWatch.changed()) {
                const { col, row } = model.lastDestroyed!;
                const key = `${col},${row}`;
                const sprite = brickSprites.get(key);
                if (!sprite) return;

                gsap.to(sprite, {
                    alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 0.3,
                    ease: 'power2.out',
                    onComplete: () => {
                        stage.removeChild(sprite);
                        brickSprites.delete(key);
                    },
                });
            }
        },
        destroy() { stage.removeChildren(); },
    };
}
```

**Observations:**
- Version stamp pattern works similarly to signals' version counter — both
  are working around the fact that poll/signal systems model state, not events.
- The watcher approach is slightly more direct: read the version, check if
  changed, act.
- For truly discrete events, an event emitter remains the most natural choice
  across all three approaches.

---

## Example 4: Asteroid Field (Asteroids)

**Scenario:** An Asteroids-style game. A dynamic collection of asteroids, each
with a position updated every tick, each needing a corresponding sprite.
Asteroids are created (when a large asteroid splits) and destroyed (when hit by
a bullet) frequently.

This tests **dynamic collections** and **per-frame updates** — a combination
that stresses lifecycle management and per-tick cost.

### Events

```typescript
// --- Model ---
interface AsteroidFieldEvents {
    'asteroid-added': Asteroid;
    'asteroid-removed': string;  // asteroid ID
}

function createAsteroidField(emitter: TypedEmitter<AsteroidFieldEvents>) {
    const asteroids = new Map<string, Asteroid>();
    return {
        add(a: Asteroid) {
            asteroids.set(a.id, a);
            emitter.emit('asteroid-added', a);
        },
        remove(id: string) {
            asteroids.delete(id);
            emitter.emit('asteroid-removed', id);
        },
        update(dt: number) {
            for (const a of asteroids.values()) {
                a.x += a.vx * dt;
                a.y += a.vy * dt;
            }
        },
        getAll() { return asteroids; },
    };
}

// --- View ---
function createAsteroidFieldView(
    field: AsteroidField,
    emitter: TypedEmitter<AsteroidFieldEvents>,
    stage: Container,
) {
    const sprites = new Map<string, Sprite>();

    const onAdded = (a: Asteroid) => {
        const s = new Sprite(asteroidTexture);
        sprites.set(a.id, s);
        stage.addChild(s);
    };
    const onRemoved = (id: string) => {
        const s = sprites.get(id);
        if (s) { stage.removeChild(s); sprites.delete(id); }
    };

    emitter.on('asteroid-added', onAdded);
    emitter.on('asteroid-removed', onRemoved);

    // Initial sync for asteroids that already exist
    for (const a of field.getAll().values()) onAdded(a);

    return {
        refresh() {
            // Per-frame position sync — events don't help here,
            // so we fall back to direct reads
            for (const [id, a] of field.getAll()) {
                const s = sprites.get(id);
                if (s) { s.x = a.x; s.y = a.y; }
            }
        },
        destroy() {
            emitter.off('asteroid-added', onAdded);
            emitter.off('asteroid-removed', onRemoved);
            stage.removeChildren();
        },
    };
}
```

**Observations:**
- Events handle add/remove well — discrete occurrences.
- Per-frame position updates still require direct reads in `refresh()` —
  events can't/shouldn't fire 60 times per second per asteroid.
- Cleanup requires two `off()` calls.
- Initial sync loop is needed for pre-existing asteroids.

### Signals

```typescript
import { createSignal, createEffect, createRoot, For } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

// --- Model ---
const [asteroids, setAsteroids] = createStore<Asteroid[]>([]);

function addAsteroid(a: Asteroid) {
    setAsteroids(produce(list => list.push(a)));
}
function removeAsteroid(id: string) {
    setAsteroids(list => list.filter(a => a.id !== id));
}
function updateAsteroids(dt: number) {
    setAsteroids(produce(list => {
        for (const a of list) {
            a.x += a.vx * dt;
            a.y += a.vy * dt;
        }
    }));
}

// --- View ---
// In a SolidJS context, you would use <For> to reactively map the list.
// Outside SolidJS, you need manual effect tracking:
function createAsteroidFieldView(stage: Container): { dispose(): void } {
    const sprites = new Map<string, Sprite>();

    const dispose = createRoot((dispose) => {
        createEffect(() => {
            const currentIds = new Set<string>();
            for (const a of asteroids) {
                currentIds.add(a.id);
                let s = sprites.get(a.id);
                if (!s) {
                    s = new Sprite(asteroidTexture);
                    sprites.set(a.id, s);
                    stage.addChild(s);
                }
                s.x = a.x;
                s.y = a.y;
            }
            // Remove sprites for asteroids that no longer exist
            for (const [id, s] of sprites) {
                if (!currentIds.has(id)) {
                    stage.removeChild(s);
                    sprites.delete(id);
                }
            }
        });
        return dispose;
    });

    return { dispose() { dispose(); stage.removeChildren(); } };
}
```

**Observations:**
- `updateAsteroids()` triggers the store's reactivity on every tick (positions
  change every frame). This means the effect re-runs every frame, iterating the
  full asteroid array — same O(n) cost as the other approaches, plus signal
  overhead.
- `produce()` (Immer-like) avoids creating new arrays but adds its own
  overhead.
- The `filter` call in `removeAsteroid` creates a new array, triggering a full
  re-run.
- SolidJS excels at list diffing inside JSX with `<For>`, but outside a
  component context (Canvas/WebGL rendering), you are doing the diffing
  manually — undermining the automatic-reactivity benefit.

### Watchers

```typescript
// --- Model (plain) ---
function createAsteroidField() {
    const asteroids: Asteroid[] = [];
    let version = 0;  // bumped on add/remove, NOT on position updates

    return {
        get version() { return version; },
        get asteroids() { return asteroids; },
        add(a: Asteroid) { asteroids.push(a); version++; },
        remove(id: string) {
            const idx = asteroids.findIndex(a => a.id === id);
            if (idx >= 0) { asteroids.splice(idx, 1); version++; }
        },
        update(dt: number) {
            for (let i = 0; i < asteroids.length; i++) {
                asteroids[i].x += asteroids[i].vx * dt;
                asteroids[i].y += asteroids[i].vy * dt;
            }
            // No version bump — positions change every tick, no point watching
        },
    };
}

// --- View ---
function createAsteroidFieldView(field: AsteroidField, stage: Container) {
    const sprites: Sprite[] = [];
    const collectionWatch = createWatch(() => field.version);

    return {
        refresh() {
            // Rebuild sprite list only when asteroids are added/removed
            if (collectionWatch.changed()) {
                // Sync sprite array to asteroid array
                while (sprites.length > field.asteroids.length) {
                    stage.removeChild(sprites.pop()!);
                }
                while (sprites.length < field.asteroids.length) {
                    const s = new Sprite(asteroidTexture);
                    sprites.push(s);
                    stage.addChild(s);
                }
            }

            // Per-frame position sync — always runs, no watcher needed
            for (let i = 0; i < sprites.length; i++) {
                sprites[i].x = field.asteroids[i].x;
                sprites[i].y = field.asteroids[i].y;
            }
        },
        destroy() { stage.removeChildren(); },
    };
}
```

**Observations:**
- Version stamp watches collection membership changes (add/remove), which are
  infrequent. Sprite creation/destruction only happens when the collection
  changes.
- Per-frame position sync is a direct indexed loop with no watcher overhead.
  The watcher system is *not used* for values that change every tick — direct
  reads are simpler and cheaper.
- No cleanup needed.
- No framework dependency.

### Summary

| Concern | Events | Signals | Watchers |
|---------|--------|---------|----------|
| Collection add/remove | Clean | Verbose (store + produce) | Version stamp |
| Per-frame position sync | Direct read (events don't help) | Effect re-runs (overhead) | Direct read |
| Sprite lifecycle | Event handlers | Manual diffing | Version-triggered rebuild |
| Cleanup | 2× `off()` | `dispose()` | None |
| Initial sync | Manual loop | Automatic (effect) | Automatic (first refresh) |

This example illustrates a key insight: **per-frame continuous values are best
handled by direct reads, not any reactive mechanism.** Watchers shine for
*infrequent* state changes (collection membership); direct reads are optimal for
*per-frame* values (positions). Events work well for discrete occurrences
(add/remove) but offer nothing for per-frame updates.

---

## Quick-Reference: Which Approach for Which Pattern?

| Pattern | Events | Signals | Watchers |
|---------|--------|---------|----------|
| Scalar state → view sync | ⚠️ Manual init sync | ✅ Automatic | ✅ Automatic (with tick) |
| State transitions (from → to) | ✅ Payload includes both | ✅ `on()` helper | ⚠️ Needs `previous` tracking |
| Discrete one-off events | ✅ Natural fit | ⚠️ Awkward (version counters) | ⚠️ Version stamp workaround |
| Per-frame continuous values | ❌ 60 emits/sec wasteful | ⚠️ 60 signal writes/sec | ⚠️ Direct read is simpler |
| Dynamic collections | ✅ Add/remove events | ⚠️ Store-based, verbose | ✅ Version stamp |
| External tween integration | ✅ Tween → event on complete | ⚠️ Bridge values to signals | ✅ Read tween target directly |
| Derived / computed values | ❌ Manual in every handler | ✅ `createMemo` | ⚠️ Model-layer derivation |
| Cross-cutting (audio, analytics) | ✅ Loose coupling | ⚠️ Signal access = coupling | ⚠️ Polling = coupling |

---

> **Back to:** [README](README.md) · [Comparison](comparison.md)
