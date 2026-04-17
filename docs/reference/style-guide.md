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
| Binding accessors     | `getScore()`, `onResetClicked()`       | [Naming Conventions](#naming-conventions)      |
| Enum-like types       | `type TileKind = 'wall' \| 'empty'`   | [Enumeration Types](#enumeration-types)        |
| Clear names           | `Kind` not `Type`, `phase` not `state` | [Easily Confused Names](#easily-confused-names)|
| Barrel imports        | `import { Foo } from './module'`       | [Project Structure](project-structure.md)      |
| Module specifiers     | `'./foo'` not `'./foo.ts'`             | [Project Structure](project-structure.md)      |
| Indentation           | 4 spaces                               | [Formatting](#formatting)                      |
| Unused parameters     | `_deltaMs`                             | [Naming Conventions](#naming-conventions)      |
| No `null`             | `undefined` over `null`                | [No `null`](#no-null)                          |
| No `this`             | Closures over `this` bindings          | [No `this`](#no-this)                          |

## Naming Conventions

| Element                | Convention                   | Example                                       |
| ---------------------- | ---------------------------- | --------------------------------------------- |
| Files                  | `lower-kebab-case.ts`        | `score-model.ts`, `tile-kind.ts`              |
| Types / Interfaces     | `PascalCase`                 | `ScoreModel`, `GameViewBindings`              |
| Model types            | Suffix with `Model`          | `ScoreModel`, `PlayerInputModel`              |
| View types             | Suffix with `View`           | `MazeView`, `KeyboardPlayerInputView`         |
| Functions / Variables  | `camelCase`                  | `createScoreModel`, `deltaMs`                 |
| Factory functions      | `create` + `PascalCase` noun | `createScoreModel`, `createHudView`           |
| Boolean properties     | `is` / `has` / `can` prefix  | `isAlive`, `hasAutoTurn`, `canFire`           |
| Binding accessors      | `get` + description          | `getScore()`, `getEntityX()`                  |
| Binding event handlers | `on` + description           | `onDirectionChanged()`, `onResetClicked()`    |
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
type EnemyType = 'pooka' | 'fygar'; // ❌ clashes with the TS concept of a type
type EnemyKind = 'pooka' | 'fygar'; // ✅ clearly means which kind of enemy

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

## Factory Functions

This project uses factory functions and plain records instead of classes.
This is a project convention, not an MVT requirement.

- Define each model/view as a **pure interface** describing its public API.
- Expose a **factory function** (`createXxx`) that accepts an options object
  and returns an instance of the interface type.
- Implement as **plain records** satisfying the interface. Use closure scope
  for private state.

```ts
interface CounterModel {
    readonly count: number;
    readonly rate: number;
    increment(): void;
    update(deltaMs: number): void;
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
    setSeparation(value: number): void;
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
