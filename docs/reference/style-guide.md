# Style Guide

> Code conventions for this project: naming, formatting, file structure,
> enumeration types, and declaration order. These are style choices specific
> to this codebase, not MVT architectural requirements.

**Related:** [Architecture Rules](architecture-rules.md) ·
[Project Structure](project-structure.md) · [Glossary](glossary.md)

---

For MVT architectural rules (models own state, views are stateless, etc.),
see [Architecture Rules](architecture-rules.md). This page covers how code
is written and organized in this project.

## Quick Reference

| Convention            | Example                                | Section                                       |
| --------------------- | -------------------------------------- | --------------------------------------------- |
| File names            | `score-model.ts`                       | [File Naming](#file-naming)                   |
| Types / interfaces    | `ScoreModel`, `TileKind`               | [Naming Conventions](#naming-conventions)      |
| Functions / variables | `createScoreModel`, `deltaMs`          | [Naming Conventions](#naming-conventions)      |
| Factory functions     | `createXxxModel(options)`              | [Factory Functions](#factory-functions)        |
| View functions        | `HudView(bindings)`                    | [Views and Bindings](#views-and-bindings)      |
| Bindings              | `score: () => number`, `onFirePressed` | [Views and Bindings](#views-and-bindings)      |
| Enum-like types       | `type TileKind = 'wall' \| 'empty'`   | [Enumeration Types](#enumeration-types)        |
| Clear names           | `Kind` not `Type`, `phase` not `state` | [Easily Confused Names](#easily-confused-names)|
| Barrel imports        | `import { Foo } from './module'`       | [Project Structure](project-structure.md)      |
| Package imports       | `import { updateView } from '@mvtjs/pixi'` | [Between Packages](project-structure.md#between-packages) |
| Module specifiers     | `'./foo'` not `'./foo.ts'`             | [Project Structure](project-structure.md)      |
| Indentation           | 4 spaces                               | [Formatting](#formatting)                      |
| Unused parameters     | `_deltaMs`                             | [Naming Conventions](#naming-conventions)      |
| No `null`             | `undefined` over `null`                | [No `null`](#no-null)                          |
| No `this`             | Closures over `this` bindings          | [No `this`](#no-this)                          |
| Function members      | `update: (deltaMs: number) => void`    | [Function-Valued Properties in Types](#function-valued-properties-in-types) |
| Conditions            | `assert(loaded, 'call load() first')`  | [Assertions](#assertions)                      |

## Naming Conventions

| Element                | Convention                   | Example                                       |
| ---------------------- | ---------------------------- | --------------------------------------------- |
| Files                  | `lower-kebab-case.ts`        | `score-model.ts`, `tile-kind.ts`              |
| Types / Interfaces     | `PascalCase`                 | `ScoreModel`, `GameViewBindings`              |
| Model types            | Suffix with `Model`          | `ScoreModel`, `PlayerInputModel`              |
| View functions         | `PascalCase`, ending `View`  | `HudView`, `ShipView`                         |
| Functions / Variables  | `camelCase`                  | `createScoreModel`, `deltaMs`                 |
| Factory functions      | `create` + `PascalCase` noun | `createScoreModel`, `createSlotList`          |
| Boolean properties     | `is` / `has` / `can` prefix  | `isAlive`, `hasAutoTurn`, `canFire`           |
| Query bindings         | What they return             | `score`, `screenX`, `isAlive`, `tileKindAt`   |
| Relay bindings         | `on` + what the user did     | `onFirePressed`, `onTileTapped`               |
| Enum-like type names   | Use `Kind`, not `Type`       | `TileKind` ✅ · `TileType` ❌                |
| Lifecycle properties   | Use `phase`, not `state`     | `phase: GamePhase` ✅ · `state: GameState` ❌|
| Unused parameters      | `_` prefix                   | `update(_deltaMs: number)`                    |

### Boolean Properties

Boolean properties and accessors should read as yes/no questions. Prefer the
`is` prefix as the default; use `has` or `can` when they fit the semantics
better:

| Prefix   | When to use                             | Example                               |
| -------- | --------------------------------------- | ------------------------------------- |
| **`is`** | State or condition (default choice)     | `isAlive`, `isActive`, `isThrusting`  |
| **`has`**| Ownership or presence of something      | `hasAutoTurn`, `hasShield`            |
| **`can`**| Capability or permission                | `canFire`, `canClick`, `canMove`      |

When in doubt, try rewording the property name so that `is` works. Prefer
`isAlive` over `alive`, `isFuelEmpty` over `fuelEmpty`.

```ts
// ✅ Preferred - reads as a question
readonly isAlive: boolean;
readonly hasAutoTurn: boolean;
readonly canFire: boolean;

// ❌ Avoid - bare adjective / noun
readonly alive: boolean;
readonly autoTurn: boolean;
readonly fuelEmpty: boolean;
```

## File Naming

All file names use `lower-kebab-case.ts`:

```
score-model.ts    ✅
ScoreModel.ts     ❌
scoreModel.ts     ❌
score_model.ts    ❌
```

## Formatting

- Use **4 spaces** for indentation (no tabs).
- Formatting is enforced by ESLint Stylistic - run `npm run lint:fix` to
  auto-fix, or `npm run lint` to verify without fixing.

## Enumeration Types

Use **unions of string literals** rather than const-object patterns or
TypeScript `enum` declarations. Use `Kind` in type names, not `Type`.

```ts
// ✅ Preferred - string-literal union
type TileKind = 'empty' | 'wall' | 'dot' | 'spawn-point';

// ❌ Avoid - const-object enum pattern
const TileType = { Empty: 0, Wall: 1, Dot: 2 } as const;
type TileType = (typeof TileType)[keyof typeof TileType];

// ❌ Avoid - TypeScript enum
enum TileType {
    Empty,
    Wall,
    Dot,
}
```

**Why string literals?**

- Simple and type-safe
- Self-documenting in logs and debugger output (`'wall'` vs `1`)
- Work naturally with `switch` statements and discriminated unions

## Easily Confused Names

Some common English words carry a well-known meaning in programming. When
these words appear as identifier names with a different meaning, readers
pause to disambiguate. Avoid these in favour of more precise alternatives.

| Avoid       | Prefer                                               | Rationale                                                          |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| **`type`**  | `kind`                                               | Easily confused with the TypeScript `type` keyword and `typeof`.   |
| **`state`** | `phase`, `status`, `mode`, or a domain-specific name | Every property on a model is "state." A property called `state` is confusingly meta. Use `phase` for lifecycle stages, `status` for conditions, `mode` for operational modes. |

```ts
type EnemyType = 'mole' | 'salamander'; // ❌ clashes with the TS concept of a type
type EnemyKind = 'mole' | 'salamander'; // ✅ clearly means which kind of enemy

type GameState = 'idle' | 'playing' | 'gameover'; // ❌ confusingly meta
type GamePhase = 'idle' | 'playing' | 'gameover'; // ✅ clearly means lifecycle stage
```

**General principle:** if a word already has a common meaning in the codebase
or language and your intended meaning is different, choose a word that does
not require the reader to disambiguate.

## No `null`

Prefer `undefined` over `null` throughout the codebase to align with
JavaScript's own APIs (which consistently use `undefined`).

```ts
// ✅ Preferred
function find(id: string): Item | undefined;
let selected: Item | undefined;

// ❌ Avoid
function find(id: string): Item | null;
let selected: Item | null = null;
```

Our own code and APIs never introduce `null`. Third-party APIs still return
it (the DOM's `querySelector`, a Pixi container's `parent`), and where one
does, be explicit about it where the value arrives, and convert it before it
reaches our own APIs:

```ts
// ✅ Explicit where a third-party value arrives
if (node.parent === null) root.addChild(node);
const nav = document.querySelector('.site-nav') as HTMLElement | null;

// ✅ Converted at the boundary, so our own function never sees null
pick(params.get('view') ?? undefined, VIEWS, 'sprites');

// ❌ Our own API passing null on
function pick(value: string | null, ...): ...
```

Enforced by lint: `@mvtjs/no-null`, from this repo's `packages/eslint-plugin`.
It reports `null` as a value, and in a type outside a function body (an
interface, a type alias, a function's signature, a module-level variable),
and allows comparisons and local types. A declaration that has to accept
`null` from outside takes an `eslint-disable-next-line` comment saying why.

## No `this`

Avoid `this` throughout the codebase. In JavaScript, `this` is determined by
how a function is called, not where it is defined - which makes it fragile:

```ts
// ❌ Dangerous - `this` depends on call site
class Ship {
    x = 0;
    moveRight() { this.x += 1; }
}

const ship = new Ship();
const move = ship.moveRight;
move(); // 💥 `this` is undefined (strict mode) or globalThis
```

This breaks whenever a method is passed as a callback, destructured out of
an object, or stored in a variable. Workarounds exist (`.bind()`, arrow
methods in constructors), but they add ceremony and are easy to forget.

Avoiding `this` is straightforward with factory functions and closures, and
it enables patterns that `this`-dependent code cannot support:

```ts
// ✅ Destructuring - pull out just the methods you need
const { update, reset } = createCounterModel();

// ✅ Passing methods directly - no .bind() needed
ticker.add(model.update);

// ✅ Composition - mix methods from multiple sources freely
const combined = {
    ...createMovement(options),
    ...createHealth(options),
};
```

These patterns work because every function closes over its own state rather
than relying on a `this` binding at the call site.

Enforced by lint: `@mvtjs/no-this`. The few files that have no other way to
reach their instance, the renderer mixins' methods wrapped onto a library's
prototype and a Rollup plugin's hooks, are exempted by name in
`eslint.config.js`.

## Function-Valued Properties in Types

In interfaces and type declarations, write each function member as a
property holding a function, not with method syntax. This applies to every
kind of interface: models, bindings and options.

```ts
// ✅ Preferred
interface ToolbarViewBindings {
    selectedTool: () => ToolKind;
    onToolPressed?: (tool: ToolKind) => void;
}

// ❌ Avoid
interface ToolbarViewBindings {
    selectedTool(): ToolKind;
    onToolPressed?(tool: ToolKind): void;
}
```

Why:

- **Stricter checking.** TypeScript checks the parameters of a method
  signature loosely, even in strict mode: it accepts a function whose
  parameter is narrower than what it will be passed. A function-valued
  property gets the full check.

  ```ts
  interface Loose { onToolPressed?(tool: ToolKind): void }
  interface Strict { onToolPressed?: (tool: ToolKind) => void }

  const handler = (tool: 'sand') => { /* ... */ };
  const a: Loose = { onToolPressed: handler };  // accepted, though 'water' can arrive
  const b: Strict = { onToolPressed: handler }; // ❌ error, as it should be
  ```

- **It says what the member is.** Nothing in this project uses `this`
  ([No `this`](#no-this)), so every function member is a plain value that can
  be destructured, passed as a callback or stored. Property syntax says so;
  method syntax suggests a method that needs its object.

The rule is about types only. An object literal implementing the interface may
still use method shorthand (`update(deltaMs) { ... }`), and accessors
(`get count()`) are unaffected.

Enforced by lint: the `@typescript-eslint/method-signature-style` rule, set to
`'property'`, checks and auto-fixes it.

## Assertions

State a precondition, postcondition or invariant with `assert` from
`@mvtjs/utils`, rather than a hand-written `if` and `throw`. It reads as the
condition that must hold, and TypeScript narrows on it.

```ts
// ✅ Preferred
assert(loaded, 'crumb-chase: load() must be called before start()');
assert(texture, () => `Texture '${name}' not found`);

// ❌ Avoid
if (!loaded) throw new Error('crumb-chase: load() must be called before start()');
```

- **Build messages lazily.** A message made from values is passed as a
  function, so it is built only on failure.
- **Not on hot paths.** In code that runs every frame
  ([Hot Paths](../building-with-mvt/performance/hot-paths.md)), keep a plain
  `if` and `throw`: it costs only the condition, with no call and no message
  function to allocate.
- **It always checks.** A check too costly for a production build goes under
  the caller's own dev-only guard: `if (DEV) assert(...)`.

A `throw` that is not a check, such as "not found" after a search, stays a
`throw`.

## Factory Functions

This project uses factory functions and plain records instead of classes.
This is a project convention, not an MVT requirement.

- Define each model as a **pure interface** describing its public API. Views
  are functions of a different shape; see
  [Views and Bindings](#views-and-bindings).
- Expose a **factory function** (`createXxx`) that accepts one options object
  and returns an instance of the interface type. Required inputs go in the
  options object too: `createJsx({ target, elements })`, never
  `createJsx(target, elements)`.
- Implement as **plain records** satisfying the interface. Use closure scope
  for private state.

```ts
interface CounterModel {
    readonly count: number;
    readonly rate: number;
    increment: () => void;
    update: (deltaMs: number) => void;
}

interface CounterModelOptions {
    readonly initialCount?: number;
    readonly rate?: number;
}

function createCounterModel(options: CounterModelOptions = {}): CounterModel {
    const { initialCount = 0, rate = 1 } = options;
    let elapsed = 0;

    const model: CounterModel = {
        count: initialCount,
        rate,
        increment() {
            (model as { count: number }).count += 1;
        },
        update(deltaMs) {
            elapsed += deltaMs;
        },
    };

    return model;
}
```

Key points:

- The **interface** is the public contract - exported and referenced by other
  code.
- The **options object** makes factories extensible without breaking call sites.
  An ordered parameter list is fragile: arguments of the same type can be
  swapped without a type error, call sites do not say which value is which,
  and a new parameter can only go on the end, or break every caller. Named
  properties can be added, made optional or given defaults without touching
  a call site.
- **Private state** (`elapsed`) lives in the closure, invisible to consumers.
- **`readonly` properties** signal "read from outside, mutate only from within."

### Getter / Setter Pairs

When a model property is read-write (externally settable), use a **getter /
setter pair** on the interface - not a getter paired with a `setX()` method.
Setters are the idiomatic JavaScript mechanism for this and keep the
interface minimal.

```ts
// ✅ Preferred - getter/setter pair
interface FlockModel {
    separation: number;     // readable and writable
    readonly maxSpeed: number;  // readable only
}

// ❌ Avoid - getter + setX() method
interface FlockModel {
    readonly separation: number;
    setSeparation: (value: number) => void;
}
```

In the factory implementation, use `get` / `set` accessors backed by a
closure variable:

```ts
const model: FlockModel = {
    get separation() { return separation; },
    set separation(value) { separation = value; },
    // ...
};
```

**When a setter has side effects** (e.g. `boidCount` must add/remove boids),
the setter body contains that logic directly:

```ts
get boidCount() { return boids.length; },
set boidCount(count) {
    const target = Math.max(0, Math.round(count));
    while (boids.length < target) boids.push(randomBoid());
    while (boids.length > target) boids.pop();
},
```

## Views and Bindings

Every view is a function that takes one bindings object and returns a Pixi
`Container`. The same function works as a JSX tag and as a plain call, so a
view can be used from any code without an adapter. How the function builds
its container is up to the view: with JSX or with plain TypeScript (see
[Writing the Body](#writing-the-body)).

```ts
export interface ShipViewBindings {
    screenX: () => number;
    screenY: () => number;
    isAlive: () => boolean;
}

export function ShipView(bindings: ShipViewBindings): Container { /* ... */ }

// Used in a JSX body...
<ShipView screenX={() => ship.x * TILE_SIZE} screenY={() => ship.y * TILE_SIZE} isAlive={() => ship.isAlive} />

// ...or from plain TypeScript
view.addChild(ShipView({ screenX: () => ship.x * TILE_SIZE, screenY: () => ship.y * TILE_SIZE, isAlive: () => ship.isAlive }));
```

### Names

| Element | Rule | Example |
| --- | --- | --- |
| View function | `PascalCase` noun ending in `View`, so it can be used as a JSX tag: a tag calls your own function only if its name starts with a capital letter | `HudView`, `TerrainView` |
| Bindings type and parameter | `XxxViewBindings`, parameter `bindings`. Never `props`, even in JSX files | `HudViewBindings` |
| Query binding | Named for what it returns. No `get` prefix | `score`, `screenX`, `phase` |
| Boolean query binding | `is` / `has` / `can`, as for [Boolean Properties](#boolean-properties) | `isAlive`, `canFlip` |
| Query binding with a position or index | Ends in `At` | `tileKindAt(row, col)`, `isSolidAt(col, row)` |
| Query binding with a key | Ends in `For` | `colorFor(kind)` |
| Relay binding | `on` + what the user did, not what it should cause | `onFirePressed` ✅ · `onShoot` ❌ |
| View model option or member | The same as a query or relay binding: a view model is fed from its view's bindings, and its view reads it the same way | `count`, `idAt(index)`, `xFor(cell)` |

In JSX, a view's bindings are written as attributes. Other JSX libraries call
the same object *props*; this project does not, because the architecture's
word is *bindings*, and because an attribute on an intrinsic element sets a
Pixi *property*.

### Fixed and Changeable Binding Values

Each query binding's type says whether the view supports its value changing:

| Type | Use for | The view |
| --- | --- | --- |
| `() => T` | Model state, which changes | Supports change: calls it every refresh, with [change detection](../building-with-mvt/reacting-to-changes/change-detection.md) where the work is expensive |
| `T` | A value the view does not (yet) support changing, such as a size its structure is built around | Reads it once, at construction. A stated limitation |
| `ValueOrGetter<T>` (from `@mvtjs/pixi/jsx`) | Views reused with both fixed and changing values, where the convenience at many call sites repays the extra work | Supports change, and handles both forms |

Supporting change is the more flexible choice. Declare `T` only as an honest
statement that the view does not support the value changing, and relax it
when it does: widening `T` to `ValueOrGetter<T>` does not break callers.

Never declare a query binding as a function and then read it only once: the
view silently stops following a value its bindings promise to follow. That
breaks [V-reactive](../architecture/rules.md#view-rules). See
[Fixed and Changeable Binding Values](../architecture/bindings.md#fixed-and-changeable-binding-values).

### Top-Level Views

A top-level view takes the model as a fixed value in its bindings, so it has
the same signature as every other view:

```ts
export interface GameViewBindings {
    model: GameModel;
}

export function GameView(bindings: GameViewBindings): Container { /* ... */ }

const gameView = GameView({ model: gameModel });
```

### Writing the Body

A view's body can be written in JSX or in plain TypeScript. Neither is
required: both give the same outside, so callers cannot tell which a view
uses, and each view can choose whichever suits it. The same ship view both
ways:

```tsx
/** @jsxImportSource @mvtjs/pixi */

export function ShipView(bindings: ShipViewBindings): Container {
    return (
        <sprite
            texture={textures.get().ship}
            anchor={0.5}
            visible={bindings.isAlive}
            x={bindings.screenX}
            y={bindings.screenY}
        />
    );
}
```

```ts
export function ShipView(bindings: ShipViewBindings): Container {
    const view = new Sprite({ texture: textures.get().ship, anchor: 0.5 });
    setRefresh(view, () => {
        view.visible = bindings.isAlive();
        if (!view.visible) return;
        view.position.set(bindings.screenX(), bindings.screenY());
    });
    return view;
}
```

| | Tends to suit | Why |
| --- | --- | --- |
| **JSX** (`.tsx`, starting `/** @jsxImportSource @mvtjs/pixi */`) | Views that are mostly a tree of display objects whose properties follow the model: sprites, text, HUDs, overlays, and views that compose child views or project collections with `<List>` | The structure reads at a glance, and the runtime writes the refresh step: a plain value is set once, a function is re-read every frame |
| **Plain TypeScript** (`.ts`) | Views whose work is mostly drawing, or managing their own display objects each frame (a pool, a ring buffer); views that need tight control of per-frame work, such as one change check gating many writes; very large numbers of objects | Nothing sits between the view and Pixi. The JSX runtime's refresh costs 1.1-1.6x as much per property as a hand-written one ([measurements](../building-with-mvt/performance/measurements.md)), which matters only at that scale |

Mixing is fine: a JSX view can embed an imperative child, or reach a Pixi
object directly through a `ref` or an `onRefresh` attribute.

In either body, derive text (or anything else costly) from a changing value
only when the value changes. `memoiseLast` from `@mvtjs/utils` wraps a one-argument
function to do that; create it once, and call it every frame:

```tsx
const scoreText = memoiseLast((score: number) => String(score));

<text text={() => scoreText(bindings.score())} />
```

And before writing a per-frame redraw, check whether drawing once and then
scaling, tinting or resizing would do. The
[`mvt-view` skill](../ai-agents/skill-mvt-view.md) covers both kinds of body.

### Releasing Resources

A view that holds something not destroyed with its display objects (a
`window` listener, a shared `GraphicsContext`, a texture it made) releases it
on Pixi's `'destroyed'` event, `view.on('destroyed', ...)`, or with the
`onDestroyed` attribute in a JSX body. Never replace `destroy` on an
instance. See
[Releasing What a View Holds](../building-with-mvt/presenting-the-world/views.md#releasing-what-a-view-holds).

### Enforcement

Every view in the site and the packages follows this convention, and lint enforces its naming:
no `createXxxView` functions, no `get*` members in `XxxViewBindings`,
`XxxViewModel` or `XxxViewModelOptions` interfaces, and no `XxxViewProps`.
The playground is exempt, since it builds DOM views.

## Code Organisation

### File Sections

Each model or view file follows a consistent internal structure using section
dividers for navigability:

```ts
// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// Public interface definition

// ---------------------------------------------------------------------------
// Options (if needed)
// ---------------------------------------------------------------------------

// Options type for the factory function

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// createXxx() factory function implementation

// ---------------------------------------------------------------------------
// Internals (if needed)
// ---------------------------------------------------------------------------

// Internal types, constants, and helpers used only inside this file
```

The ordering is deliberate - readers see the **public contract** first
(interface), then the **configuration surface** (options), then the
**implementation** (factory), and finally **internals** at the bottom.

All exports (types, interfaces, factory functions) go above all internals.
Internal declarations - both types and runtime values (constants, helper
functions) - belong at the bottom, below every exported symbol.

**Type ordering within exported sections:**

- **Main types before helper types.** If an exported type references another
  exported helper type (e.g. `GameModel.particles: DebrisParticle[]`), the
  main type appears first, then the helper type it composes.

```ts
// ✅ Correct - main interface first, helper type second, internal type last
export interface DebrisModel {
    readonly particles: readonly DebrisParticle[];
    /* ... */
}

export interface DebrisParticle {
    readonly x: number;
    /* ... */
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface MutableParticle { /* ... used only inside the factory ... */ }
```

### Declaration Order Within Functions

Within factory functions and other non-trivial functions, follow a
**big-picture-first** ordering:

- **Exports and public API** at the top - the returned record, public
  interface, and main flow.
- **High-level helpers** in the middle - the major building blocks called by
  the public API.
- **Low-level / private helpers** at the bottom - small utilities, math
  functions, and internal details.

This mirrors the file-level convention (interface before factory) and lets
readers understand the function's purpose without scrolling. JavaScript's
function hoisting makes this possible - declare functions in conceptual order,
not in call-before-definition order.

```ts
export function createGameModel(options: GameModelOptions): GameModel {
    const { arenaWidth, arenaHeight } = options;

    // --- Initialise ---------------------------------------------------------
    const ship = buildShip();
    let asteroids: AsteroidModel[] = [];

    // --- Public record ------------------------------------------------------
    const model: GameModel = {
        get ship() { return ship; },
        get asteroids() { return asteroids; },
        update(deltaMs: number): void { /* main loop */ },
    };

    return model;

    // --- Child construction -------------------------------------------------

    function buildShip(): ShipModel { /* ... */ }

    // --- Helpers ------------------------------------------------------------

    function distSq(x1: number, y1: number, x2: number, y2: number): number {
        /* ... */
    }
}
```
