# Worked Examples

Each example implements the same feature using all three approaches - events,
signals, and watchers - so you can compare them directly. Examples use classic
arcade games and common interactive patterns that are universally understood.

> **Navigation:** [README](README.md) · [Push vs Pull](push-vs-pull.md) ·
> [Events](events.md) · [Signals](signals.md) · [Watchers](watchers.md) ·
> [Comparison](comparison.md) · Examples

---

## Example 1: Score Display (Pac-Man)

**Scenario:** Pac-Man eats dots and moves every tick. The score changes
infrequently (on dot-eat). The elapsed time changes every tick. The HUD view
must update both - but the optimal strategy differs for each.

This tests the fundamental pattern: how does each approach handle a mix of
infrequently-changing and per-tick state?

### Events

```typescript
// --- Model ---
interface ScoreEvents {
    'score-changed': number;
}

function createScoreModel(emitter: TypedEmitter<ScoreEvents>) {
    let score = 0;
    let elapsed = 0;  // changes every tick

    return {
        get score() { return score; },
        get elapsed() { return elapsed; },
        addPoints(points: number) {
            score += points;
            emitter.emit('score-changed', score);
        },
        update(dt: number) {
            elapsed += dt;
            // No event for elapsed - it changes every tick.
            // Emitting 60 times/sec would cost ~3–12μs/sec in dispatch
            // overhead and create payload GC pressure for no benefit.
        },
    };
}

// --- View ---
function createScoreView(
    model: { score: number; elapsed: number },
    emitter: TypedEmitter<ScoreEvents>,
    stage: Container,
) {
    const scoreText = new Text({ text: '0', style: { fill: 'white' } });
    const timerText = new Text({ text: '0', style: { fill: 'grey' } });
    timerText.y = 30;
    stage.addChild(scoreText, timerText);

    // Initial sync - events don't carry history
    scoreText.text = String(model.score);

    // Subscribe to infrequent change
    const onScoreChanged = (score: number) => { scoreText.text = String(score); };
    emitter.on('score-changed', onScoreChanged);

    return {
        refresh() {
            // Frequently-changing value - read directly every tick
            timerText.text = String(Math.floor(model.elapsed));
        },
        destroy() {
            emitter.off('score-changed', onScoreChanged);  // Must clean up
            stage.removeChild(scoreText, timerText);
        },
    };
}
```

**Observations:**
- Model must know about the emitter and explicitly emit on every mutation.
- The model intentionally does NOT emit for per-tick values like `elapsed` -
  events are a poor fit for high-frequency state.
- View must manually initialise (read `model.score` after subscribing).
- View must clean up the subscription.
- The view still needs a `refresh()` loop for per-tick values - events alone
  are insufficient.

### Signals

```typescript
import { createSignal, createEffect, createRoot } from 'solid-js';

// --- Model ---

interface ScoreModel {
    readonly score: number;
    readonly elapsed: number;
    addPoints(points: number): void;
    update(dt: number): void;
}

function createScoreModel(): ScoreModel {
    const [score, setScore] = createSignal(0);
    const [elapsed, setElapsed] = createSignal(0);

    return {
        get score() { return score(); },
        get elapsed() { return elapsed(); },
        addPoints(points: number) { setScore(prev => prev + points); },
        update(dt: number) {
            setElapsed(prev => prev + dt);
            // This writes to a signal 60 times/sec, triggering dependency
            // tracking overhead and GC pressure on every tick - even though
            // the consumer would read it every tick anyway.
        },
    };
}

// --- View ---
function createScoreView(model: ScoreModel, stage: Container): { destroy(): void } {
    const scoreText = new Text({ text: '0', style: { fill: 'white' } });
    const timerText = new Text({ text: '0', style: { fill: 'grey' } });
    timerText.y = 30;
    stage.addChild(scoreText, timerText);

    const dispose = createRoot((dispose) => {
        createEffect(() => {
            scoreText.text = String(model.score);  // auto-tracks score signal
        });
        createEffect(() => {
            timerText.text = String(Math.floor(model.elapsed));
            // This effect re-runs every tick because elapsed() changes every tick.
            // The dependency tracking overhead is pure waste here.
        });
        return dispose;
    });

    return {
        destroy() {
            dispose();  // Must clean up reactive root
            stage.removeChild(scoreText, timerText);
        },
    };
}
```

**Observations:**
- No manual initial sync - the effect runs once on creation.
- No explicit dependency declaration - auto-tracked.
- Must manage reactive root lifecycle (`dispose()`).
- Per-tick values like `elapsed` work but incur signal overhead with no benefit.
- Requires SolidJS runtime.

### Watchers

```typescript
// --- Model (plain object) ---
function createScoreModel() {
    let score = 0;
    let elapsed = 0;

    return {
        get score() { return score; },
        get elapsed() { return elapsed; },
        addPoints(points: number) { score += points; },
        update(dt: number) { elapsed += dt; },
    };
}

// --- View ---
function createScoreView(model: { readonly score: number; readonly elapsed: number }): Container {
    const container = new Container();
    const scoreText = new Text({ text: '0', style: { fill: 'white' } });
    const timerText = new Text({ text: '0', style: { fill: 'grey' } });
    timerText.y = 30;
    container.addChild(scoreText, timerText);

    // Watch infrequently-changing state only
    const watched = createWatcher({
        score: () => model.score,
    });

    container.onRender = () => {
        watched.poll();
        if (watched.score.changed) {
            scoreText.text = String(watched.score.value);
        }
        // Per-tick value - just read directly, no watcher needed
        timerText.text = String(Math.floor(model.elapsed));
    };

    return container;
}
```

**Observations:**
- Model is a plain object - no emitters, no signal wrappers.
- No cleanup obligations - removing the container from the stage is sufficient.
- Infrequent changes (score) use a watcher; per-tick values (elapsed) are read
  directly. Both patterns coexist naturally.
- No framework dependency.

---

## Example 2: Ghost State Transitions (Pac-Man)

**Scenario:** Pac-Man's ghosts have multiple phases: `'chase'`, `'scatter'`,
`'frightened'`, `'eaten'`. When the phase changes, the ghost's appearance (sprite
texture, animation speed, colour) must update. Additionally, a sound effect
plays on certain transitions. The ghost's position changes every tick.

This tests **transition detection** - reacting not just to the new value, but
to specific from→to transitions - alongside per-tick state.

### Events

```typescript
// --- Model ---
interface GhostEvents {
    'phase-changed': { from: GhostPhase; to: GhostPhase };
}
type GhostPhase = 'chase' | 'scatter' | 'frightened' | 'eaten';

function createGhostModel(emitter: TypedEmitter<GhostEvents>) {
    let phase: GhostPhase = 'scatter';
    let col = 0;
    let row = 0;

    return {
        get phase() { return phase; },
        get col() { return col; },
        get row() { return row; },
        setPhase(newPhase: GhostPhase) {
            if (newPhase === phase) return;
            const from = phase;
            phase = newPhase;
            emitter.emit('phase-changed', { from, to: newPhase });
        },
        update(dt: number) {
            // move ghost - no event (per-tick)
            col += dt * 0.01;
        },
    };
}

// --- View ---
function createGhostView(
    model: { phase: GhostPhase; col: number; row: number },
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
        refresh() {
            // Per-tick position - direct read
            sprite.x = model.col * TILE_SIZE;
            sprite.y = model.row * TILE_SIZE;
        },
        destroy() {
            emitter.off('phase-changed', onPhaseChanged);
            stage.removeChild(sprite);
        },
    };
}
```

**Observations:**
- Events naturally carry `from`/`to` - the model packages transition data.
- Transition-specific logic is clean and readable.
- Per-tick position requires a separate `refresh()` loop - events don't help.
- Initial sync and cleanup are manual.

### Signals

```typescript
import { createSignal, createEffect, createRoot, on } from 'solid-js';

// --- Model ---

type GhostPhase = 'chase' | 'scatter' | 'frightened' | 'eaten';

interface GhostModel {
    readonly phase: () => GhostPhase;
    readonly col: () => number;
    readonly row: () => number;
    setPhase(p: GhostPhase): void;
    update(dt: number): void;
}

function createGhostModel(): GhostModel {
    const [phase, setPhase] = createSignal<GhostPhase>('scatter');
    const [col, setCol] = createSignal(0);
    const [row, setRow] = createSignal(0);

    return {
        phase,
        col,
        row,
        setPhase(p: GhostPhase) { setPhase(p); },
        update(dt: number) {
            setCol(prev => prev + dt * 0.01);
            // Writing to col 60 times/sec - signal overhead with no benefit
        },
    };
}

// --- View ---
function createGhostView(model: GhostModel, stage: Container): { destroy(): void } {
    const sprite = new Sprite();
    stage.addChild(sprite);

    const dispose = createRoot((dispose) => {
        // Phase changes - with previous value via `on()` helper
        createEffect(on(model.phase, (to, from) => {
            applyPhaseAppearance(sprite, to);

            if (to === 'frightened') {
                audioManager.play('power-pellet');
            }
            if (from === 'frightened' && to === 'chase') {
                audioManager.play('ghost-recover');
            }
        }));

        // Per-tick position - effect re-runs every tick due to signal writes
        createEffect(() => {
            sprite.x = model.col() * TILE_SIZE;
            sprite.y = model.row() * TILE_SIZE;
        });

        return dispose;
    });

    return {
        destroy() {
            dispose();
            stage.removeChild(sprite);
        },
    };
}
```

**Observations:**
- SolidJS's `on()` helper provides the previous value - clean API for
  transitions.
- Per-tick position values are signals, so the position effect re-runs every
  tick with full dependency-tracking overhead.
- Requires understanding SolidJS-specific `on()` helper for accessing previous
  values.
- Must dispose reactive root.

### Watchers

```typescript
// --- Model (plain object) ---
type GhostPhase = 'chase' | 'scatter' | 'frightened' | 'eaten';

function createGhostModel() {
    let phase: GhostPhase = 'scatter';
    let col = 0;
    let row = 0;

    return {
        get phase() { return phase; },
        get col() { return col; },
        get row() { return row; },
        setPhase(p: GhostPhase) { phase = p; },
        update(dt: number) { col += dt * 0.01; },
    };
}

// --- View ---
function createGhostView(
    model: { readonly phase: GhostPhase; readonly col: number; readonly row: number },
): Container {
    const container = new Container();
    const sprite = new Sprite();
    container.addChild(sprite);

    const watched = createWatcher({
        phase: () => model.phase,
    });

    container.onRender = () => {
        watched.poll();

        if (watched.phase.changed) {
            const from = watched.phase.previous;
            const to = watched.phase.value;
            applyPhaseAppearance(sprite, to);

            // Transition-specific logic - previous is built in
            if (to === 'frightened') {
                audioManager.play('power-pellet');
            }
            if (from === 'frightened' && to === 'chase') {
                audioManager.play('ghost-recover');
            }
        }

        // Per-tick position - direct read, no watcher
        sprite.x = model.col * TILE_SIZE;
        sprite.y = model.row * TILE_SIZE;
    };

    return container;
}
```

**Observations:**
- `watched.phase.previous` provides transition data without manual tracking.
- Per-tick position is a direct read - no watcher overhead.
- Model is plain - no emitter, no signals.
- No cleanup - removing container from stage is sufficient.

---

## Example 3: GSAP Tween Integration

**Scenario:** A Breakout-style game. When the ball hits a brick, the brick
plays a "shatter" animation using GSAP (scale up, fade out, remove). The game
model marks the brick as destroyed; the view must animate the destruction.
Assume GSAP's ticker has been replaced with Pixi's shared ticker (RAF-based),
so both run in the same frame loop.

This tests integration with an external animation library - a common real-world
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
  occurrence - exactly the kind of thing events model well.
- GSAP runs on Pixi's shared ticker; no need to bridge tween values into a
  reactive system.
- The animation fires directly from the event handler - simple and direct.

### Signals

```typescript
import { createSignal, createEffect, createRoot, batch } from 'solid-js';

// --- Model ---

interface BrickGridModel {
    isBrick(col: number, row: number): boolean;
    readonly lastDestroyed: () => { col: number; row: number } | null;
    readonly destroyVersion: () => number;
    destroyBrick(col: number, row: number): void;
}

function createBrickGridModel(): BrickGridModel {
    const bricks: boolean[][] = [/* initial grid */];
    const [lastDestroyed, setLastDestroyed] = createSignal<{ col: number; row: number } | null>(null);
    const [destroyVersion, setDestroyVersion] = createSignal(0);

    return {
        isBrick(col: number, row: number) { return bricks[row][col]; },
        lastDestroyed,
        destroyVersion,
        destroyBrick(col: number, row: number) {
            bricks[row][col] = false;
            batch(() => {
                setLastDestroyed({ col, row });
                setDestroyVersion(v => v + 1);
            });
        },
    };
}

// --- View ---
function createBrickGridView(
    model: BrickGridModel,
    brickSprites: Map<string, Sprite>,
    stage: Container,
): { destroy(): void } {
    const dispose = createRoot((dispose) => {
        createEffect(() => {
            model.destroyVersion();  // track the version signal
            const brick = model.lastDestroyed();
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

    return {
        destroy() {
            dispose();
            stage.removeChildren();
        },
    };
}
```

**Observations:**
- Signals are awkward for discrete events. There is no "fire and forget" -
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
function createBrickGridView(
    model: ReturnType<typeof createBrickGridModel>,
    stage: Container,
): Container {
    const container = new Container();
    const brickSprites = new Map<string, Sprite>();
    // ... populate initial sprites ...
    stage.addChild(container);

    const watched = createWatcher({
        destroyVersion: () => model.destroyVersion,
    });

    container.onRender = () => {
        watched.poll();
        if (watched.destroyVersion.changed) {
            const { col, row } = model.lastDestroyed!;
            const key = `${col},${row}`;
            const sprite = brickSprites.get(key);
            if (!sprite) return;

            gsap.to(sprite, {
                alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 0.3,
                ease: 'power2.out',
                onComplete: () => {
                    container.removeChild(sprite);
                    brickSprites.delete(key);
                },
            });
        }
    };

    return container;
}
```

**Observations:**
- Version stamp pattern works similarly to signals' version counter - both
  are working around the fact that poll/signal systems model state, not events.
- The watcher approach is slightly more direct: poll, check if changed, act.
- No cleanup needed. No framework dependency.
- For truly discrete events, an event emitter remains the most natural choice
  across all three approaches.

---

## Example 4: Asteroid Field (Asteroids)

**Scenario:** An Asteroids-style game. A dynamic collection of asteroids, each
with a position updated every tick, each needing a corresponding sprite.
Asteroids are created (when a large asteroid splits) and destroyed (when hit by
a bullet) frequently.

This tests **dynamic collections** and **per-frame updates** - a combination
that stresses lifecycle management and per-tick cost. It includes both
frequently-changing state (positions) and infrequently-changing state (collection
membership).

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
                // No event for position - changes every tick
            }
        },
        getAll() { return asteroids; },
    };
}

// --- View ---
function createAsteroidFieldView(
    field: ReturnType<typeof createAsteroidField>,
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
            // Per-frame position sync - events don't help here,
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
- Events handle add/remove well - discrete occurrences.
- Per-frame position updates still require direct reads in `refresh()` -
  events can't/shouldn't fire 60 times per second per asteroid.
- Cleanup requires two `off()` calls.
- Initial sync loop is needed for pre-existing asteroids.

### Signals

```typescript
import { createSignal, createEffect, createRoot } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

// --- Model ---

interface AsteroidFieldModel {
    readonly asteroids: Asteroid[];
    add(a: Asteroid): void;
    remove(id: string): void;
    update(dt: number): void;
}

function createAsteroidFieldModel(): AsteroidFieldModel {
    const [asteroids, setAsteroids] = createStore<Asteroid[]>([]);

    return {
        get asteroids() { return asteroids; },
        add(a: Asteroid) {
            setAsteroids(produce(list => list.push(a)));
        },
        remove(id: string) {
            setAsteroids(list => list.filter(a => a.id !== id));
        },
        update(dt: number) {
            setAsteroids(produce(list => {
                for (const a of list) {
                    a.x += a.vx * dt;
                    a.y += a.vy * dt;
                }
            }));
            // Triggers store reactivity every tick - all position effects re-run
        },
    };
}

// --- View ---
function createAsteroidFieldView(
    model: AsteroidFieldModel,
    stage: Container,
): { destroy(): void } {
    const sprites = new Map<string, Sprite>();

    const dispose = createRoot((dispose) => {
        createEffect(() => {
            const currentIds = new Set<string>();
            for (const a of model.asteroids) {
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

    return { destroy() { dispose(); stage.removeChildren(); } };
}
```

**Observations:**
- `update()` triggers the store's reactivity on every tick (positions change
  every frame). The effect re-runs every frame, iterating the full asteroid
  array - same O(n) cost as the other approaches, plus signal overhead.
- `produce()` (Immer-like) avoids creating new arrays but adds its own overhead.
- The `filter` call in `remove()` creates a new array, triggering a full
  re-run.
- SolidJS excels at list diffing inside JSX with `<For>`, but outside a
  component context (Canvas/WebGL rendering), you are doing the diffing
  manually - undermining the automatic-reactivity benefit.

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
            // No version bump - positions change every tick, no point watching
        },
    };
}

// --- View ---
function createAsteroidFieldView(
    field: ReturnType<typeof createAsteroidField>,
): Container {
    const container = new Container();
    const sprites: Sprite[] = [];

    const watched = createWatcher({
        version: () => field.version,
    });

    container.onRender = () => {
        watched.poll();

        // Rebuild sprite list only when asteroids are added/removed (infrequent)
        if (watched.version.changed) {
            while (sprites.length > field.asteroids.length) {
                container.removeChild(sprites.pop()!);
            }
            while (sprites.length < field.asteroids.length) {
                const s = new Sprite(asteroidTexture);
                sprites.push(s);
                container.addChild(s);
            }
        }

        // Per-frame position sync - direct read, no watcher
        for (let i = 0; i < sprites.length; i++) {
            sprites[i].x = field.asteroids[i].x;
            sprites[i].y = field.asteroids[i].y;
        }
    };

    return container;
}
```

**Observations:**
- Version stamp watches collection membership changes (add/remove), which are
  infrequent. Sprite creation/destruction only happens when the collection
  changes.
- Per-frame position sync is a direct indexed loop with no watcher overhead.
  The watcher system is *not used* for values that change every tick - direct
  reads are simpler and cheaper.
- No cleanup needed. No framework dependency.

### Summary

| Concern | Events | Signals | Watchers |
|---------|--------|---------|----------|
| Collection add/remove | Clean (discrete events) | Verbose (store + produce) | Version stamp |
| Per-frame position sync | Direct read (events don't help) | Effect re-runs (overhead) | Direct read |
| Sprite lifecycle | Event handlers | Manual diffing | Version-triggered rebuild |
| Cleanup | 2× `off()` | `dispose()` | None |
| Initial sync | Manual loop | Automatic (effect) | Automatic (first poll) |
| Per-tick state handling | Separate `refresh()` loop | 60 signal writes/sec | Direct read |

This example illustrates a key insight: **per-frame continuous values are best
handled by direct reads, not any reactive mechanism.** Watchers shine for
*infrequent* state changes (collection membership, phase transitions); direct
reads are optimal for *per-frame* values (positions, velocities). Events work
well for discrete occurrences (add/remove) but offer nothing for per-frame
updates. Signals handle both, but for per-frame values they add dependency-tracking overhead with no benefit.

---

## Quick-Reference: Which Approach for Which Pattern?

| Pattern | Events | Signals | Watchers |
|---------|--------|---------|----------|
| Scalar state → view sync | ⚠️ Manual init sync | ✅ Automatic | ✅ Automatic (with poll) |
| State transitions (from → to) | ✅ Payload includes both | ✅ `on()` helper | ✅ `previous` built into watcher |
| Discrete one-off events | ✅ Natural fit | ⚠️ Awkward (version counters) | ⚠️ Version stamp workaround |
| Per-frame continuous values | ❌ 60 emits/sec wasteful | ⚠️ 60 signal writes/sec | ✅ Direct read (no watcher needed) |
| Dynamic collections | ✅ Add/remove events | ⚠️ Store-based, verbose | ✅ Version stamp |
| External tween integration | ✅ Tween → event on complete | ⚠️ Bridge values to signals | ✅ Read tween target directly |
| Derived / computed values | ❌ Manual in every handler | ✅ `createMemo` | ⚠️ Model-layer derivation / getter |
| Cross-cutting (audio, analytics) | ✅ Loose coupling | ⚠️ Signal access = coupling | ⚠️ Readable via bindings |

---

> **Back to:** [README](README.md) · [Comparison](comparison.md)
