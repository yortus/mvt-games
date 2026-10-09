# Skill: Writing MVT Views

> Self-contained instructions for writing a correct MVT view in this
> project. Load this file before writing or modifying view code.

---

## File Structure

**[project convention]** Each view file follows this internal ordering:

```ts
// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

// XxxViewBindings - the contract between the view and the outside world

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

// The XxxView(bindings) function

// ---------------------------------------------------------------------------
// Internals (if needed)
// ---------------------------------------------------------------------------

// Internal types, constants, and helpers used only inside this file
```

Exports (bindings interface, view function) go above all internals. A view
with a JSX body is a `.tsx` file whose first line is
`/** @jsxImportSource @mvtjs/pixi */`.

**[project convention]** The full convention is in
[Style Guide: Views and Bindings](../reference/style-guide.md#views-and-bindings),
and lint enforces its naming.

## A View Is a Function

**[project convention]** Every view is a function taking one bindings object
and returning a Pixi `Container`:

```ts
export function HudView(bindings: HudViewBindings): Container
```

- `PascalCase`, ending in `View`, so it works as a JSX tag (`<HudView ... />`)
  and as a plain call (`HudView({ ... })`). A JSX tag calls your own function
  only if its name starts with a capital letter.
- The parameter is always `bindings`, of type `XxxViewBindings`. Never
  `props`, even in JSX files: in JSX, a view's bindings are written as
  attributes.

## Two Kinds of Views

**[MVT requirement]** Views fall into two categories based on how they access
state:

| Kind                    | State access               | When to use                        |
| ----------------------- | -------------------------- | ---------------------------------- |
| **Reusable leaf view**  | Query and relay bindings   | Views of single game objects (a ship, a bullet), HUD panels, any view that could be reused across contexts |
| **Top-level app view**  | The model itself           | Application-specific root views that are never reused |

**[project convention]** A top-level view takes the model as a fixed value in
its bindings, so it has the same signature as every other view:

```ts
export interface GameViewBindings {
    model: GameModel;
}

export function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    // ...
}
```

## The `refresh()` Contract

**[MVT requirement]** A view's `refresh()` function is called once per frame,
after all models have updated. It reads current state and updates the
presentation to match.

Key principles:

- **Reactive** - every value that may change between frames must be re-read
  in `refresh()`, never cached at construction time. The one exception is a
  query binding the view declares as a fixed value: the view reads it once,
  and does not support it changing.
- **Idempotent** - calling `refresh()` twice with the same state produces
  the same result.
- **No side effects** - `refresh()` reads state and writes to the presentation
  layer. It does not mutate models, emit events, or trigger transitions.

In a JSX body the runtime writes `refresh()` for you: every attribute given a
function is re-read each frame.

## Bindings

**[MVT requirement for reusable views]** A bindings object has two kinds of
member:

- **Query bindings** read the state the view presents.
- **Relay bindings** report user input out of the view. They are optional.

**[project convention]** Naming:

| Member | Rule | Example |
| --- | --- | --- |
| Query binding | Named for what it returns; no `get` prefix | `score`, `screenX`, `phase` |
| Boolean query binding | `is` / `has` / `can` | `isAlive`, `canFlip` |
| With a position or index | Ends in `At` | `tileKindAt(row, col)` |
| With a key | Ends in `For` | `colorFor(kind)` |
| Relay binding | `on` + what the user did, not what it should cause | `onFirePressed`, not `onShoot` |

Write every member as a function-valued property (`score: () => number`), not
with method syntax.

### Fixed and Changeable Binding Values

**[MVT requirement]** A query binding's type says whether the view supports
its value changing:

| Type | Use for | The view |
| --- | --- | --- |
| `() => T` | Model state, which changes | Supports change: calls it every refresh |
| `T` | A value the view does not (yet) support changing, such as a size its structure is built around | Reads it once, at construction. A stated limitation |
| `ValueOrGetter<T>` (from `@mvtjs/pixi`) | Views reused with both fixed and changing values | Supports change, and handles both forms |

Supporting change is the more flexible choice; declare `T` only as an honest
statement of a limitation. Widening `T` to `ValueOrGetter<T>` later relaxes
it without breaking callers.

**Never declare a query binding as a function and then read it only once.**
The view would silently stop following a value its bindings promise to
follow (rule V-reactive).

```ts
export interface TerrainViewBindings {
    /** Changes every frame. */
    scrollCol: () => number;
    /** Size the view's ring buffer, so read once. */
    visibleCols: number;
    visibleRows: number;
    tileSize: number;
    isSolidAt: (col: number, row: number) => boolean;
}
```

### Binding Rules

- **Relay bindings should usually be optional.** This keeps views usable in
  more contexts without forcing no-op handlers. Call them with `?.()`.
- **Bindings are wired at the construction site** (typically a parent view).
  The view does not know how it is connected to the model.

## Writing the Body: JSX or Plain TypeScript

**[project convention]** A view's body can be written in JSX or in plain
TypeScript. Neither is required. Both give the same outside, so callers
cannot tell which a view uses, and each view can choose whichever suits it.
The same rocket view both ways:

```tsx
/** @jsxImportSource @mvtjs/pixi */

export function RocketView(bindings: RocketViewBindings): Container {
    const { idle, launching } = textures.get().rocket;
    return (
        <container x={bindings.screenX} y={bindings.screenY}>
            <sprite texture={idle} anchor={0.5} visible={() => bindings.phase() === 'idle'} />
            <sprite texture={launching} anchor={0.5} visible={() => bindings.phase() !== 'idle'} />
        </container>
    );
}
```

```ts
export function RocketView(bindings: RocketViewBindings): Container {
    const { idle, launching } = textures.get().rocket;
    const idleSprite = new Sprite({ texture: idle, anchor: 0.5 });
    const launchSprite = new Sprite({ texture: launching, anchor: 0.5 });
    const view = new Container();
    view.addChild(idleSprite, launchSprite);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const isIdle = bindings.phase() === 'idle';
        idleSprite.visible = isIdle;
        launchSprite.visible = !isIdle;
        view.position.set(bindings.screenX(), bindings.screenY());
    }
}
```

| | Tends to suit | Why |
| --- | --- | --- |
| **JSX** (`.tsx`) | Views that are mostly a tree of display objects whose properties follow the model: sprites, text, HUDs, overlays, and views that compose child views or project collections with `<List>` | The structure reads at a glance, and the runtime writes the refresh step: a plain value is set once, a function is re-read every frame |
| **Plain TypeScript** (`.ts`) | Views whose work is mostly drawing, or managing their own display objects each frame (a pool, a ring buffer); views that need tight control of per-frame work, such as one read or change check shared by many writes; very large numbers of objects | Nothing sits between the view and Pixi. The JSX runtime's refresh costs 1.1-1.6x as much per property as a hand-written one, which matters only at that scale |

Mixing is fine: a JSX view can embed a plain TypeScript child, or reach a
Pixi object directly through a `ref`, and plain TypeScript can call any view
function, `List` included.

Either way, before writing a per-frame redraw, check whether drawing once and
then scaling, tinting or resizing would do. A burst that grows and fades is
one circle drawn at full size, then scaled and faded; a bar that fills is a
white sprite that is resized and tinted. That stops the view allocating every
frame.

### A JSX Body

A `.tsx` file whose first line is `/** @jsxImportSource @mvtjs/pixi */`. How
attributes behave:

- **A plain value is applied once.** A function is re-read every refresh.
  Pass values that never change as plain values: they cost nothing per frame.
- **A query binding can be passed straight to an attribute**
  (`x={bindings.screenX}`) when it already has the attribute's type.
- **A `visible` function is read first.** When it returns `false`, the
  element's other attributes and its whole subtree are skipped that frame.
- **`text`, `texture`, `tint`, `width`, `height`, `style` and `label` are
  written only when their value changes.** The function is still called every
  frame, so it must not build a new string each time: map a number to text
  only when the number changes, with `memoiseLast` from `@mvtjs/utils`, created once:
  `const scoreText = memoiseLast((n: number) => String(n))`, then
  `text={() => scoreText(bindings.score())}`.
- **`ref`** receives the element once it is built, e.g. to draw a `Graphics`
  once: `<graphics ref={(g) => drawPanel(g)} />`.
- **`onUpdate`** sets the element's `update(deltaMs)` step, for presentation
  state.
- **`onRefresh`** adds a per-frame step of the element's own, for what
  attributes cannot express. It receives the element, and runs after the
  element's function attributes (not at all while a `visible` function hides
  it).

For collections, project the model's collection with `<List>` rather than
building children by hand. A pool of bullets over a `SlotList`:

```tsx
<List items={model.bullets.slots}>
    {(slot) => (
        <BulletView
            screenX={() => (slot().value.worldCol - model.scrollCol) * TILE_SIZE}
            screenY={() => slot().value.worldRow * TILE_SIZE}
        />
    )}
</List>
```

A slot whose item is absent is hidden and skipped, so the item view needs no
presence binding. See [Presenting Collections](../building-with-mvt/presenting-the-world/collections.md)
for other shapes.

Any view can also be called as an expression inside a JSX body:
`{HudView({ ... })}`.

#### Reaching Pixi from a JSX body

1. **`ref` to draw once.** `<graphics ref={(g) => drawGlass(g, width, height)} />`.
2. **An `onRefresh` attribute**, for a per-frame step the other attributes
   cannot express, such as redrawing a `Graphics` when a value changes:

   ```tsx
   let drawnRadius = -1;

   <graphics x={bindings.x} y={bindings.y} onRefresh={refreshRing} />

   function refreshRing(g: Graphics): void {
       const radius = bindings.radius();
       if (radius === drawnRadius) return;
       drawnRadius = radius;
       g.clear().circle(0, 0, radius).stroke({ color: 0xffffff, width: 1 });
   }
   ```

   A `ref` that wraps the element's own refresh method with
   `setRefresh(g, (own) => ...)` does the same; the attribute is simpler to
   get right.
3. **An `onDestroyed` attribute** to release what the view made for the
   element: `<container onDestroyed={() => sharedContext.destroy()}>`. See
   [Releasing Resources](#releasing-resources).

When most of a view needs these, a plain TypeScript body is usually clearer.

### A Plain TypeScript Body

Build the scene graph once at construction time, then update it each frame in
`refresh()`:

```ts
export function TerrainView(bindings: TerrainViewBindings): Container {
    const { visibleCols, tileSize } = bindings; // fixed values: read once
    const view = new Container();
    const columns = createColumns(visibleCols + 4);
    view.addChild(...columns);

    setRefresh(view, refresh);
    return view;

    function refresh(): void {
        const scrollCol = bindings.scrollCol(); // followed every frame
        // ... recycle columns that scrolled off, redraw them, position the rest
    }
}
```

Key points:
- Create display objects (`Container`, `Graphics`, `Text`, `Sprite`) once.
- In `refresh()`, update properties (position, scale, alpha, visibility,
  text, tint) - do not recreate display objects.
- Child views are plain calls: `view.addChild(ShipView({ ... }))`. So is
  `List`: `List({ items: model.bullets.slots, children: (slot) => BulletView({ ... }) })`.
- Return the root `Container`. The parent view adds it to its own container.

## Using `setUpdate`, `setRefresh`, `updateView` and `refreshView`

**[project convention]** A view sets its per-frame steps on its container with
`setRefresh` and `setUpdate` from `@mvtjs/pixi` (`@mvtjs/three` and
`@mvtjs/html` re-export the same functions): `refresh()` always, and
`update(deltaMs)` only if it has presentation state. In a JSX body the runtime
sets the refresh method from the function attributes, and the update method
comes from the `onUpdate` attribute.

```ts
setRefresh(view, refresh);
setUpdate(view, update);     // only for views with presentation state
```

- `undefined` clears a method: `setRefresh(view, undefined)`.
- The host updates and refreshes the stage each frame, after the models:
  `model.update(deltaMs)`, then `updateView(app.stage, deltaMs)`, which calls
  every update method in the stage, then `refreshView(app.stage)`, which calls
  every refresh method. Game sessions advance only their models; the entry
  host (`packages/website/src/runner/`) updates and refreshes the stage once
  per frame, and pauses by leaving the entry's container out of `updateView`.
  Games know nothing about pause.
- **Never forward `update()` or `refresh()` to child views.** `updateView` and
  `refreshView` walk the whole tree, parents before children, and find every
  update and refresh method themselves. A view is an ordinary `Container`;
  return it as one.
- Either method may return `SKIP_DESCENDANTS` to skip its container's
  descendants for that call (a hidden subtree). Setting `visible = false`
  alone skips nothing, and a view may set its own `visible` freely.
- A container added, or given a refresh method, during `refreshView` is
  refreshed before `refreshView` returns, so a view may build children in its
  own `refresh()`. A container added during `updateView` is first updated on
  the next frame: it did not exist for this frame's time step.
- A method that declares a parameter for the one it replaces wraps it
  (`setRefresh(view, (own) => ...)`, `setUpdate(view, (deltaMs, own) => ...)`).
  Library code (`<List>`, `<Switch>`) uses this to gate a child's own step;
  views rarely need it.
- Do not use Pixi's `onRender` for view refresh. It is tied to render cadence
  and cannot skip subtrees.
- In tests, drive a view with `updateView(view, deltaMs)` and
  `refreshView(view)`, or either alone; no renderer or ticker is needed.

The language-neutral spec (`packages/docs/architecture/`) describes these only as a
view's `update(deltaMs)` and `refresh()` steps, and as ticking a view; it must
not mention these functions.

## Releasing Resources

**[project convention]** A view that holds something not destroyed with its
display objects (a `window` listener, a shared `GraphicsContext`, a texture it
made, a GSAP timeline) releases it on Pixi's `'destroyed'` event, next to
where it acquires it:

```ts
window.addEventListener('keydown', onKeyDown);
view.on('destroyed', () => window.removeEventListener('keydown', onKeyDown));
```

- In a JSX body, use the `onDestroyed` attribute on the element that owns it.
- Never replace `view.destroy` on an instance.
- `destroy()` without `{ children: true }` detaches children without
  destroying them, so their listeners never run. Code that ends a view's life
  (a session's `destroy()`) passes `{ children: true }`. Dev builds warn when
  a destroy without it would skip a `'destroyed'` listener below it.

## Change Detection (Watch)

**[project convention]** For query bindings that change rarely but trigger
expensive work (rebuilding a grid, recreating child views), use the `watch()`
helper:

```ts
import { watch } from '@mvtjs/utils';

const watcher = watch({
    rows: bindings.rows,
    cols: bindings.cols,
});

function refresh(): void {
    const w = watcher.poll();
    if (w.rows.changed || w.cols.changed) {
        rebuildGrid(w.rows.value, w.cols.value);
    }
    // Always update positions, etc.
    view.position.set(bindings.x(), bindings.y());
}
```

Each watched property has `changed`, `value` and `previous`. A numeric one
also has `increased` and `decreased`, which are true only when it changed to
a greater or a lesser number. Both are false on the first poll.

Use change detection for infrequent, expensive updates. For cheap per-frame
updates (position, alpha, visibility), read directly without watching.

## Audio Views

Sound is presentation, so views play it, never models. An **audio view** is
a view that plays sounds instead of drawing visuals. It polls its bindings
with `watch()`, and plays a sound when a value **changes**. It never plays
from a state alone, which would play the sound every frame.

- **[project convention]** It plays on the **Audio80**, a virtual sound chip
  from `@mvtjs/audio`. The chip is a fixed binding, `sound: Audio80`, which
  the view reads once. An entry gets it from the host as `sound`, in its
  start options.
- **A phase or a flag** finds most moments. Play when it changes to a value.
- **A count** (`shotsFired`) finds moments that repeat with no change of
  state. Play when it rises (`if (w.shots.increased)`). When the sound
  depends on which one, the model also keeps the last one's details
  (`lastBrokenRockSize`).
- **Poll once at construction** (`watcher.poll()` before returning). Then
  the first refresh plays nothing for the starting state. Skip the poll
  only when the starting state should sound, such as a fanfare.
- **Also poll at construction when the view's own first update can cause a
  change.** A metronome's first beat comes in the first update. Without the
  poll, the first refresh takes the count of 1 as its starting value, and
  the beat is silent.
- **In a `<List>`**, a slot's view is made once and reused for later items.
  So a poll at construction covers only the slot's first item. Play only on
  changes that a newly arrived item cannot cause, such as `isAlive` going
  from `true` to `false`. Otherwise, also watch the item's id, and play
  nothing in a poll where it changed.
- **An item removed in the tick it finishes** (a rock that breaks and leaves
  its `SlotList`) never shows its `<List>` view the change. Count it in the
  model, and play it from a view outside the list.
- **One moment, two changes.** When one moment changes two watched values in
  the same tick (a ship comes back and its fuel fills), play one sound. Best
  is a model count of the moment itself. Otherwise, read the values
  together.
- **Music and repeating sounds are presentation state.** A music player
  (`createMusicPlayer`, from `@mvtjs/audio`) or a metronome
  (`createMetronome`, from `@mvtjs/utils`) advances in the update step. The
  refresh step plays what is due. It calls `MusicPlayer.refresh` last, and
  plays a sound each time the metronome's `count` rises. A metronome only
  counts beats, at a tempo the view sets with `periodMs`. A period of 0
  stops it.
- **A new song cuts the old one short.** `MusicPlayer.play` releases the
  song playing and cancels any song queued. A jingle that starts a phase
  must be no longer than the phase. Check it with `computeSongDurationMs`.
- **Test** against a chip from `createHeadlessAudio80({ record: true })`, in
  `@mvtjs/audio/headless`. Advance its clock with `AudioControls.update`,
  tick the view, and check the chip's `log` property.

Full guide: [Sound and Music](../building-with-mvt/presenting-the-world/sound.md) ·
[Using the Audio80](https://github.com/yortus/mvt-games/blob/main/packages/audio/docs/using-the-audio80.md) ·
[Writing Tracker Music](https://github.com/yortus/mvt-games/blob/main/packages/audio/docs/writing-tracker-music.md)

## Presentation State

**[MVT requirement]** Most views are pure projections - read state, update
scene graph. Occasionally a view needs its own state for a cosmetic transition
that the model doesn't track (the model has no reason to track it because no
domain outcome depends on it).

Views with presentation state gain an `update(deltaMs)` step, set with
`setUpdate(view, update)` (or the `onUpdate` attribute) in this project.
`updateView` calls it after models update and before any refresh. Parent views
do not propagate it; `updateView` finds it.

**`update` advances state; `refresh` writes output.** `update(deltaMs)`
changes presentation state and nothing else. `refresh()` writes all
presentation output, including structure: add, remove and destroy display
objects and child views in `refresh()` (or at construction, for structure
that never changes), never in `update()`. Do not tween display objects
directly with a timeline advanced in `update()`: tween a plain state object,
and apply it in `refresh()`. A view that spawns effects keeps a pool of
effect records advanced in `update()`, projected into display objects in
`refresh()`. Relay bindings are input, not output, so `update()` may call
one (for example, reporting a launch once a zoom finishes).

When the presentation logic grows complex enough to warrant separate testing,
extract it into a **view model** - a technique borrowed from MVVM:
- The view model is a plain object with `update(deltaMs)` and readable state
- Created and owned by the view that uses it (an internal detail)
- Has no view or scene-graph dependencies (no Pixi.js imports)
- Independently testable
- Its options and members are named like bindings (`count`, `idAt(index)`,
  `xFor(cell)`, not `getCount`), since they are fed from and read by views

When multiple views share a view model, the nearest common parent creates
the view model and passes it to both views.

For the simplest cases (a single timer or tweened value with trivial logic),
inline presentation state in the view is acceptable:

```tsx
export function BaseAlertView(bindings: BaseAlertViewBindings): Container {
    // Presentation state: how long the alert has been flashing.
    let flashMs = 0;

    return (
        <container
            visible={bindings.isShown}
            alpha={() => (Math.sin(flashMs * 0.008) + 1) * 0.5}
            onUpdate={(deltaMs) => { flashMs += deltaMs; }}
        >
            <text text="DESTROY THE BASE!" anchor={0.5} style={ALERT_STYLE} />
        </container>
    );
}
```

As soon as the presentation state grows beyond a single value, or the timing
logic warrants unit testing, extract it into a view model. For common
patterns, `@mvtjs/utils` has tested helpers, all advanced with
`update(deltaMs)`. `createBooleanTween` and `createEdgeTween` turn a flag
into a value that tweens. `createSequence` runs timed steps.
`createMetronome` counts beats at a tempo the view can change, for anything
that repeats while something lasts. Never hardcode frame deltas
(`timerMs += 16`). Never compute `deltaMs` from `Date.now()`.

**Start presentation state valid.** A view's first `refresh()` can run before
its first `update(deltaMs)`: a view built during a refresh is refreshed that
frame but first updated the next, and tests and thumbnails often refresh
without updating. Initialise presentation state (and view-model state) at
construction, from the bindings if it depends on them
(`let fadeProgress = bindings.isOpen() ? 0 : 1`). Never write a `refresh()`
that is only correct once `update()` has run.

## Hot-Path Rules for `refresh()`

`refresh()`, and every function attribute in a JSX body, runs every tick
(~60fps). Avoid per-tick heap allocations:

| Avoid                                   | Prefer                                         |
| --------------------------------------- | ---------------------------------------------- |
| `array.map()`, `.filter()`, `.slice()`  | Index-based `for` loop                         |
| `for...of` on arrays                    | `for (let i = 0; i < arr.length; i++)`         |
| Template-string keys                    | Arithmetic encoding (`r * cols + c`)           |
| Inline closures                         | Hoisted functions or pre-bound references      |
| `String()` conversion every frame       | `memoiseLast`, or change detection, to update text only on change |
| Spread (`[...arr]`)                     | Direct index access                            |

Closures written in JSX attributes and `<List>` item callbacks are created
once, when the element is built, not per frame.

## Forbidden Patterns - Quick Reference

| Pattern                                    | Rule            | Fix                                           |
| ------------------------------------------ | --------------- | --------------------------------------------- |
| Domain state in a view                     | V-stateless     | Move to the model                             |
| Complex presentation logic in a view       | V-presentation  | Extract to a view model                       |
| Hardcoded frame delta (`timerMs += 16`)    | V-presentation  | Use the view's update method (`setUpdate`) |
| `refresh()` only correct after the first `update()` | V-presentation | Initialise presentation state at construction |
| Adding or removing display objects in `update()` | V-presentation | Change structure in `refresh()` |
| A timeline advanced in `update()` tweening display objects | V-presentation | Tween a state object; apply it in `refresh()` |
| Query binding declared as a function but read only at construction | V-reactive | Read it in `refresh()`, or declare it as `T` |
| Mutating models in `refresh()`             | V-readonly      | Report input through relay bindings           |
| `setTimeout` / `setInterval` in a view     | V-stateless     | Use the view's update method (`setUpdate`) |
| Computing own deltaMs from `Date.now()`    | V-presentation  | Receive `deltaMs` from the ticker             |
| `createXxxView`, `get*()` bindings, `props` in new code | Style | `XxxView(bindings)`, query bindings named for what they return |
| Using `class`                              | Style           | Factory function + plain record               |
| Using `enum` or const-object enum          | Style           | String-literal union                          |
| Using `null`                               | Style           | Use `undefined`                               |
| `array.map()` in `refresh()` hot path      | H-alloc         | Index-based `for` loop                        |

## Visual Tests

**[project convention]** A new or changed view gets a visual test. The
test goes in a `*.visual.ts` or `*.visual.tsx` file beside the view. Write
one declaration for each state the view's bindings can show:
`canvasTest(name, options?, pose)` for a Pixi or three.js view, or
`htmlTest(name, options?, pose)` for an HTML view. A file declares
one kind only. The `pose` function's only job is to return a view that
has been arranged into the pose that the test describes. It builds a leaf
view from fixed bindings, and a top-level view from a model in a known
state. If the view has presentation state, the pose advances it
with `advanceTime({ models, views, totalMs })`. Both functions come from
`@mvtjs/visual-testing`.

```tsx
describe('WinBannerView', () => {
    canvasTest('a win, counted', { artStyle: 'smooth' }, () => WinBannerView({
        isShown: () => true,
        amount: () => WIN,
        caption: () => CAPTION,
    }));
});
```

- Set `artStyle: 'smooth'` for a view that its game draws with
  antialiasing. The default is `'pixel'`.
- A three.js view also needs a `camera` option. If the view is lit by an
  environment map, pass the game's scene setup function as `scene`.
- Record the pictures with
  `npm run test:visual:update -- --picture <name>`, or run the whole
  update. Look at each new or changed PNG, and commit it with the view.
  Never accept a change you have not looked at.
- `npm run test:visual` must pass before you hand over. A failure gives
  the paths of the reference, the actual picture and a diff. Read the diff
  before you decide that the change is intended.
- You may repeat visual runs freely. Playwright's browser makes no Windows
  logon attempts. The installed Chrome does, and the thumbnail and
  load-time scripts use it.
- Assertions still test behaviour and structure, which is what a view does
  with its bindings. Pictures test how it looks. See
  [Visual Tests](../building-with-mvt/iterating-with-confidence/visual-tests.md).

## Complete Minimal Example

A reusable bullet view, shown in a `<List>` above, with a JSX body:

```tsx
/** @jsxImportSource @mvtjs/pixi */

import type { Container } from 'pixi.js';
import { textures } from '../data';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

export interface BulletViewBindings {
    screenX: () => number;
    screenY: () => number;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function BulletView(bindings: BulletViewBindings): Container {
    return <sprite texture={textures.get().bullet} anchor={0.5} x={bindings.screenX} y={bindings.screenY} />;
}
```

Or with a plain TypeScript body, in `bullet-view.ts`:

```ts
export function BulletView(bindings: BulletViewBindings): Container {
    const view = new Sprite({ texture: textures.get().bullet, anchor: 0.5 });
    setRefresh(view, () => { view.position.set(bindings.screenX(), bindings.screenY()); });
    return view;
}
```

## Full References

- [Style Guide: Views and Bindings](../reference/style-guide.md#views-and-bindings) - the view convention in full
- [Architecture: Bindings](../architecture/bindings.md) - query and relay bindings, fixed and changeable binding values
- [Presenting Collections](../building-with-mvt/presenting-the-world/collections.md) - projecting collections with `<List>`
- [Views (Learn)](../building-with-mvt/presenting-the-world/views.md) - introduction from scratch
- [Bindings (Learn)](../building-with-mvt/presenting-the-world/bindings.md) - the bindings pattern
- [Bindings in Depth](../building-with-mvt/presenting-the-world/bindings-in-depth.md) - advanced bindings topics
- [Change Detection](../building-with-mvt/reacting-to-changes/change-detection.md) - the Watch pattern
- [View Composition](../building-with-mvt/presenting-the-world/view-composition.md) - view hierarchies
- [Presentation State](../building-with-mvt/adding-visual-polish/presentation-state.md) - view models and presentation state
- [Architecture Rules](../architecture/rules.md) - all view rules (V-stateless through V-tree)
- [Hot Paths](../building-with-mvt/performance/hot-paths.md) - performance rules for `refresh()`
- [Visual Tests](../building-with-mvt/iterating-with-confidence/visual-tests.md) - writing, running and accepting visual tests
