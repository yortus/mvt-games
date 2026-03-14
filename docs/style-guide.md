# TypeScript Style Guide

Coding conventions, naming rules, and project structure for this codebase.

> **Related:** [MVT Architecture Guide](mvt-guide.md) for the architectural
> pattern · [Documentation Hub](README.md) for glossary and orientation

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Naming Conventions](#naming-conventions)
- [File Naming](#file-naming)
- [Formatting](#formatting)
- [Project Structure](#project-structure)
- [Modules and Barrel Files](#modules-and-barrel-files)
- [Enumeration Types](#enumeration-types)
- [Easily Confused Names](#easily-confused-names)
- [No `null`](#no-null)
- [Models](#models)
- [Views](#views)
- [Code Organisation](#code-organisation)
- [GSAP Gotchas](#gsap-gotchas)

---

## Quick Reference

| Convention            | Example                             | Section                                               |
| --------------------- | ----------------------------------- | ----------------------------------------------------- |
| File names            | `score-model.ts`                    | [File Naming](#file-naming)                           |
| Types / interfaces    | `ScoreModel`, `TileKind`            | [Naming Conventions](#naming-conventions)             |
| Functions / variables | `createScoreModel`, `deltaMs`       | [Naming Conventions](#naming-conventions)             |
| Factory functions     | `createXxxModel(options)`           | [Models](#models)                                     |
| Binding accessors     | `getScore()`, `onResetClick()`      | [Views](#views)                                       |
| Enum-like types       | `type TileKind = 'wall' \| 'empty'` | [Enumeration Types](#enumeration-types)               |
| Confused names        | `Kind` not `Type`, `phase` not `state` | [Easily Confused Names](#easily-confused-names)     |
| Barrel imports        | `import { Foo } from './module'`    | [Modules and Barrel Files](#modules-and-barrel-files) |
| Module specifiers     | `'./foo'` not `'./foo.ts'`          | [Modules and Barrel Files](#modules-and-barrel-files) |
| Indentation           | 4 spaces                            | [Formatting](#formatting)                             |
| Unused parameters     | `_deltaMs`                          | [Naming Conventions](#naming-conventions)             |

---

## Naming Conventions

All naming rules collected in one place for easy reference.

| Element                | Convention                   | Example                                 |
| ---------------------- | ---------------------------- | --------------------------------------- |
| Files                  | `lower-kebab-case.ts`        | `score-model.ts`, `tile-kind.ts`        |
| Types / Interfaces     | `PascalCase`                 | `ScoreModel`, `GameViewBindings`        |
| Model types            | Suffix with `Model`          | `ScoreModel`, `PlayerInputModel`        |
| View types             | Suffix with `View`           | `MazeView`, `KeyboardPlayerInputView`   |
| Functions / Variables  | `camelCase`                  | `createScoreModel`, `deltaMs`           |
| Factory functions      | `create` + `PascalCase` noun | `createScoreModel`, `createHudView`     |
| Binding accessors      | `get` + description          | `getScore()`, `getEntityX()`            |
| Binding event handlers | `on` + description           | `onDirectionChange()`, `onResetClick()` |
| Enum-like type names   | Use `Kind`, not `Type`       | `TileKind` ✅ · `TileType` ❌           |
| Lifecycle properties   | Use `phase`, not `state`     | `phase: GamePhase` ✅ · `state: GameState` ❌ |
| Unused parameters      | `_` prefix                   | `update(_deltaMs: number)`              |

See [Easily Confused Names](#easily-confused-names) for the reasoning
behind the `Kind`/`Type` and `phase`/`state` rules.

---

## File Naming

- All file names use `lower-kebab-case.ts`.

```
score-model.ts    ✅
ScoreModel.ts     ❌
scoreModel.ts     ❌
score_model.ts    ❌
```

---

## Formatting

- Use **4 spaces** for indentation (no tabs).
- Formatting is enforced by Prettier — run `npm run format` to auto-fix, or
  `npm run format:check` to verify.

---

## Project Structure

Every directory under `src/` is a **module** with a specific responsibility.
Each module has a barrel file (`index.ts`) that defines its public API.

```
src/
├── main.ts              Bootstrap: init Pixi app, create cabinet, start ticker
├── cabinet/             Cabinet model & view (game selection)
├── games/               Game registry + per-game modules
│   ├── game-entry.ts    GameEntry & GameSession interfaces
│   └── <name>/          Self-contained game module
│       ├── data/        Static data and configuration constants
│       ├── models/      State and domain logic + domain types
│       └── views/       Rendering and user-input handling
└── common/              Shared helpers, views, and models
```

| Directory | Contains                                                         | Typical Exports                                           |
| --------- | ---------------------------------------------------------------- | --------------------------------------------------------- |
| `data/`   | Constants, configuration, static datasets                        | Data objects, lookup tables                               |
| `models/` | Model interfaces, options types, factory functions, domain types | `ScoreModel`, `createScoreModel`, `Direction`, `TileKind` |
| `common/` | Shared helpers, views, and models                                 | `createWatch`, `Watch`, `createKeyboardPlayerInputView`   |
| `views/`  | View factory functions, bindings interfaces                      | `createHudView`, `HudViewBindings`                        |

---

## Modules and Barrel Files

- Every directory under `src/` must provide a barrel file (`index.ts`).
- All imports from **outside** a directory must go through the barrel — never
  reach past it into individual files.
- Imports **within** the same directory use direct relative paths (`./foo`).
- **Never include `.ts` extensions** in module specifiers — write `'./foo'`, not
  `'./foo.ts'`. The importer should not know or care whether a module resolves
  to a file or a directory; that detail can change without breaking the import.
- A barrel file defines the **public API** of the module. Internal-only files
  should not be re-exported.
- This is enforced by the `import/no-internal-modules` ESLint rule.

```mermaid
flowchart LR
    subgraph views["views/"]
        VI["index.ts (barrel)"]
        GV["grid-view.ts"]
        HV["hud-view.ts"]
    end

    subgraph models["models/"]
        MI["index.ts (barrel)"]
        SM["score-model.ts"]
    end

    main["main.ts"]

    main -- "import from './views'" --> VI
    main -- "import from './models'" --> MI
    GV -. "./hud-view" .-> HV

    main -. "❌ import from './views/grid-view'" .-x GV
    main -. "❌ import from './models/score-model'" .-x SM

    style main fill:#e8f5e9
    style VI fill:#bbdefb
    style MI fill:#bbdefb
    style GV fill:#fff9c4
    style HV fill:#fff9c4
    style SM fill:#fff9c4
```

```ts
// ✅ Correct — importing from the barrel
import { createScoreModel } from './models';
import type { Direction } from '../models';

// ❌ Wrong — reaching past the barrel into a specific file
import { createScoreModel } from './models/score-model';
import type { Direction } from '../models/common';
```

### Barrel File Contents

Barrel files (`index.ts`) contain **only re-exports** — no declarations, no
logic, no side effects. They define which symbols are part of the module's
public API:

```ts
// index.ts — ✅ correct: re-exports only
export { createCounterModel } from './counter-model';
export type { CounterModel, CounterModelOptions } from './counter-model';
export { createTimerModel } from './timer-model';
export type { TimerModel } from './timer-model';
```

```ts
// index.ts — ❌ wrong: barrel contains a declaration
export function createFooEntry(): FooEntry { /* ... */ }
export { createHelperModel } from './helper-model';
```

Move any declarations that live in a barrel into their own file and re-export
them instead:

```ts
// foo-entry.ts          ← declaration lives here
export function createFooEntry(): FooEntry { /* ... */ }

// index.ts              ← barrel re-exports it
export { createFooEntry } from './foo-entry';
```

**Why no declarations in barrels?**

- **Locatability** — definitions in an `index.ts` are hard to find because every
  directory has one and editors highlight them all. A dedicated file gives the
  definition a clear, searchable name.
- **Cyclic-import safety** — when a barrel both declares code and re-exports
  sibling modules, those siblings may try to import the barrel-declared symbol.
  This creates a cycle through the barrel, which can cause subtle runtime
  errors (e.g. accessing an import before its module has finished executing).
  Keeping barrels declaration-free eliminates this risk entirely.

Internal-only files (helpers, constants used only within the module) are **not**
re-exported. This keeps the public surface intentional — consumers can only
depend on what you explicitly choose to expose.

### No Self-Imports Through the Barrel

Files inside a directory module must **never** import from their own barrel
(`index.ts`). Always use direct relative paths to the sibling file instead:

```ts
// Inside models/score-model.ts

// ✅ Correct — direct relative import to sibling
import { type Direction } from './common';

// ❌ Wrong — importing from own barrel creates a cycle
import { type Direction } from '.';          // resolves to ./index.ts
import { type Direction } from './index';    // same problem, explicit
```

**Why?** Importing from your own barrel creates a circular dependency: the
barrel re-exports you, and you import from the barrel. Even when the cycle is
technically resolvable, it makes the dependency graph harder to reason about
and can cause runtime issues where an imported value is `undefined` because
the exporting module hasn't finished initializing.

**Why barrel files?**

- **Encapsulation** — internal implementation files can be renamed, split, or
  restructured without breaking consumers. Only the barrel's exports are the
  contract.
- **Discoverability** — one file lists everything a module offers. No need to
  hunt through individual files.
- **Enforceability** — the `import/no-internal-modules` ESLint rule makes this
  a hard constraint, not just a guideline.

---

## Enumeration Types

- Use **unions of string literals** rather than const-object "enum" patterns or
  TypeScript `enum` declarations.
- Use `Kind` in type names, not `Type`.

```ts
// ✅ Preferred — string-literal union
type TileKind = 'empty' | 'wall' | 'dot' | 'spawn-point';

// ❌ Avoid — const-object enum pattern
const TileType = { Empty: 0, Wall: 1, Dot: 2 } as const;
type TileType = (typeof TileType)[keyof typeof TileType];

// ❌ Avoid — TypeScript enum
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

---

## Easily Confused Names

Some common English words already carry a well-known meaning in programming.
When these words appear as identifier names with a _different_ meaning, readers
have to pause and work out which sense is intended. The words below are
especially prone to this — avoid them in favour of more precise alternatives.

| Avoid       | Prefer           | Rationale                                                                                                                |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **`type`**  | `kind`           | Easily confused with the TypeScript concept of a _type_ (`type` keyword, `typeof`, type parameters). Use `kind` instead. |
| **`state`** | `phase`, `status`, `mode`, or a domain-specific name | Every property on a model is "state." A property _called_ `state` is confusingly meta — `game.state` could mean "all of the game's state" or "one specific enum value." Use a precise name: `phase` for lifecycle stages, `status` for conditions, `mode` for operational modes, or something domain-specific. |

```ts
type EnemyType = 'pooka' | 'fygar';               // ❌ 'type' clashes with the TS concept of a type
type EnemyKind = 'pooka' | 'fygar';               // ✅ clearly means which kind of enemy

type GameState = 'idle' | 'playing' | 'gameover'; // ❌ confusingly meta — all properties are "state"
type GamePhase = 'idle' | 'playing' | 'gameover'; // ✅ clearly means lifecycle stage
```

**General principle:** if a word already has a common meaning in the codebase
or language, and your intended meaning is different, choose a word that doesn't
require the reader to disambiguate. If a name could reasonably describe _all_
properties on the object (`state`, `data`, `info`, `value`), it's too vague —
pick something that distinguishes this property from the others.

---

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

---

## Models

- Define each model as a **pure interface** describing its public API.
- Expose a **factory function** (`createXxx`) that accepts an options object and
  returns an instance of the interface type.
- Implement models as **plain records** satisfying the interface. Use closure
  scope for private state — no classes.
- Include an `update(deltaMs)` method for time-based state advancement (see
  [MVT Guide — Models](mvt-guide.md#models)). When using GSAP timelines,
  structure `update()` as _advance then orchestrate_ — see
  [Structuring update()](mvt-guide.md#structuring-update--advance-then-orchestrate).

```ts
// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

interface CounterModel {
    readonly count: number;
    readonly rate: number;
    increment(): void;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface CounterModelOptions {
    readonly initialCount?: number;
    readonly rate?: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

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
            // ... time-based logic using elapsed ...
        },
    };

    return model;
}
```

Key points:

- The **interface** is the public contract — this is what gets exported and
  referenced by other code.
- The **options object** makes factories extensible without breaking call sites.
- **Private state** (`elapsed`) lives in the closure, invisible to consumers.
- **`readonly` properties** signal "read from outside, mutate only from within."

---

## Views

- Expose each view as a **factory function** that returns a Pixi.js
  `Container`.
- **Top-level application views** accept the application model (and textures)
  directly. They're application-specific and have no reuse scenario.
- **Leaf/reusable views** accept a `bindings` object with `get*()` and `on*()`
  members. This keeps them decoupled from any particular model shape.
- No view properties or methods need to be exposed beyond what `Container`
  already provides.
- Use Pixi's `onRender` property to schedule the internal `refresh` function —
  set it once at construction time so rendering is automatic.

**Top-level application view** (accepts model directly, wires sub-view bindings):

```ts
// Example: a game's top-level view
function createGameView(game: GameModel, textures: GameViewTextures): Container {
    const container = new Container();

    container.addChild(createHudView({
        getScore: () => game.score.score,
    }));

    container.addChild(createKeyboardInputView({
        onDirectionChange: (dir) => { game.playerInput.direction = dir; },
    }));

    // ... sub-views ...

    container.onRender = refresh;
    return container;
}
```

**Leaf/reusable view** (accepts bindings):

```ts
// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

interface HudViewBindings {
    getScore(): number;
    getHighScore(): number;
    getLives(): number;
    onResetClick?(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createHudView(bindings: HudViewBindings): Container {
    const container = new Container();

    const scoreLabel = new Text({ text: '0', style: labelStyle });
    container.addChild(scoreLabel);

    // ... build rest of scene graph ...

    function refresh(): void {
        scoreLabel.text = String(bindings.getScore());
        // ... update other display objects from bindings ...
    }

    container.onRender = refresh;
    return container;
}
```

Key points:

- The **bindings interface** is a complete manifest of everything the view needs.
  `get*()` for reading state, `on*()` for relaying user input.
- **`refresh()`** is internal — it's called automatically by the renderer via
  `onRender`, not exposed publicly.
- The view creates the scene graph once at construction time, then updates it
  incrementally in `refresh()`.

---

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
```

The ordering is deliberate — readers see the **public contract** first
(interface), then the **configuration surface** (options), then the
**implementation** (factory).

---

## GSAP Gotchas

We use GSAP timelines for model-driven tweening (paused, manually advanced via
`update(deltaMs)`). The patterns below address pitfalls specific to this usage.

### Use `autoRemoveChildren` and explicit positioning

Create paused timelines with `autoRemoveChildren: true` and position new tweens
explicitly at the current playhead:

```ts
const timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

function scheduleMove(): void {
    const t = timeline.time();
    timeline.to(state, { x: nextCol, y: nextRow, duration, ease: 'none' }, t);
    timeline.set(state, { row: nextRow, col: nextCol, moving: false }, t + duration);
}
```

Benefits:

- **Scales to complex models** — multiple overlapping tweens can coexist on one
  timeline. New tweens are added without disturbing in-progress ones.
- **Explicit positioning** — every tween states exactly where it sits on the
  timeline. No implicit assumptions about the playhead being at 0.
- **Automatic cleanup** — completed tweens are removed by GSAP without manual
  intervention. (GSAP’s child-iteration captures `_next` before rendering each
  child, so mid-iteration removal is safe.)
- **Cancellation is just `clear()`** — to abort in-progress tweens (e.g.
  direction reversal), call `timeline.clear()`. No `time(0)` reset needed.

> **Simple alternative:** for very simple timelines that only ever run one
> sequence at a time, `timeline.clear().time(0)` before each new sequence is a
> valid shortcut that avoids explicit positioning entirely. This doesn’t scale
> to timelines with overlapping or concurrent tweens.

### Prefer `timeline.set()` over `onComplete` for state transitions

`timeline.set()` is more declarative and compact than `onComplete` callbacks:

```ts
// ✅ Declarative — intent is clear in the timeline layout
timeline.to(state, { x: 5, duration: 0.2 });
timeline.set(state, { arrived: true }, 0.2);

// ❌ Imperative — harder to read
timeline.to(state, {
    x: 5,
    duration: 0.2,
    onComplete() {
        state.arrived = true;
    },
});
```

### Guard against zero-duration tweens

Ensure that tweens added to a paused, manually-advanced timeline always have a
positive duration. GSAP has deliberate but nuanced handling of zero-duration
children on paused timelines (via its internal `_zTime` bookkeeping): when a
zero-duration `to()` and a `set()` are both placed at time 0, the playhead is
already at their position when they're inserted, so GSAP treats them as "already
passed" and skips them on the next `time()` advance.

A common way this arises is computing `duration = distance / speed` where the
distance can be zero. In tile-based movement, a direction reversal that
coincides with arriving at a tile boundary advances the logical position to the
destination while the visual position is already there — producing a
zero-distance, and therefore zero-duration, tween.

```ts
// ❌ Can produce duration = 0 → zero-duration tween → set() skipped
const dist = Math.abs(nextCol - state.x) + Math.abs(nextRow - state.y);
const duration = dist / speed;

// ✅ Floor the distance so the tween always has positive duration
const dist = Math.abs(nextCol - state.x) + Math.abs(nextRow - state.y) || 0.001;
const duration = dist / speed;
// At speed = 8, 0.001 / 8 = 0.000125 s ≈ 0.1 ms — completes within one frame.
```

The `|| 0.001` idiom is preferable to early-return snapping because it stays on
the normal code path (no branching) and the sub-frame duration is visually
imperceptible.

### Never auto-play timelines in models

All GSAP timelines in models must be created `paused: true` and advanced only
inside `update(deltaMs)`. Auto-playing would couple model state to wall-clock
time, violating the MVT contract. See
[MVT Guide — Models](mvt-guide.md#models).

```ts
// ✅ Correct — manual advancement
const tl = gsap.timeline({ paused: true });
// in update():
tl.time(tl.time() + 0.001 * deltaMs);

// ❌ Wrong — auto-plays on wall-clock time
const tl = gsap.timeline();
```
