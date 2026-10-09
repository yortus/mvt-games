# Skill: Code Style Conventions

> Self-contained code conventions for this project. Load this file before
> writing or modifying code to ensure consistency with the codebase.

---

All conventions below are **project-specific style choices**, not MVT
architectural requirements. Other codebases using MVT could use different
conventions.

## Naming Rules

| Element                | Convention                   | Example                                       |
| ---------------------- | ---------------------------- | --------------------------------------------- |
| Files                  | `lower-kebab-case.ts`        | `score-model.ts`, `tile-kind.ts`              |
| Types / Interfaces     | `PascalCase`                 | `ScoreModel`, `GameViewBindings`              |
| Model types            | Suffix with `Model`          | `ScoreModel`, `PlayerInputModel`              |
| View functions         | `PascalCase`, ending `View`  | `HudView`, `ShipView`                         |
| Bindings types         | `XxxViewBindings`            | `HudViewBindings` (never `Props`)             |
| Functions / Variables  | `camelCase`                  | `createScoreModel`, `deltaMs`                 |
| Factory functions      | `create` + `PascalCase` noun | `createScoreModel`, `createSlotList`          |
| Other functions        | Start with a verb; conversions `to` + target; predicates `is` / `has` / `can` | `measureLoudness`, `toInt16`, `isNoteInRange` |
| Boolean properties     | `is` / `has` / `can` prefix  | `isAlive`, `hasAutoTurn`, `canFire`           |
| Query bindings         | What they return, no `get`   | `score`, `screenX`, `isAlive`                 |
| ... with position/index | Suffix `At`                 | `tileKindAt(row, col)`                        |
| ... with a key         | Suffix `For`                 | `colorFor(kind)`                              |
| Relay bindings         | `on` + what the user did     | `onFirePressed`, `onTileTapped`               |
| Enum-like type names   | Use `Kind`, not `Type`       | `TileKind` not `TileType`                     |
| Lifecycle properties   | Use `phase`, not `state`     | `phase: GamePhase` not `state: GameState`     |
| Unused parameters      | `_` prefix                   | `update(_deltaMs: number)`                    |

## File Naming

All file names use `lower-kebab-case.ts`:

```
score-model.ts    ✅
ScoreModel.ts     ❌
scoreModel.ts     ❌
score_model.ts    ❌
```

## Formatting

- **4 spaces** for indentation (no tabs).
- Enforced by ESLint Stylistic - run `npm run lint:fix` to auto-fix.

## Barrel File Rules

Every directory under a package's `src/` provides a barrel file (`index.ts`) that defines
its public API.

- **Cross-directory imports:** always go through `index.ts` (never past it).
- **Same-directory imports:** use direct relative paths (`./foo`).
- **No `.ts` extensions** in module specifiers - write `'./foo'`,
  not `'./foo.ts'`.
- **No declarations** in barrel files - only re-exports.
- **No self-imports** through barrels, at any depth - not `'.'` or
  `'./index'` from beside the barrel, and not `'..'` or `'../index'` from a
  subdirectory. A subdirectory that needs an ancestor's module imports its
  file directly (`'../element-mixin'`).

```ts
// ✅ Correct - import through barrel
import { ScoreModel } from './models';

// ❌ Wrong - reaching past the barrel
import { ScoreModel } from './models/score-model';

// ✅ Correct - within same directory, direct relative path
import { createTimerModel } from './timer-model';

// ❌ Wrong - self-import through an ancestor barrel, from a subdirectory
import { createTimerModel } from '..';

// ✅ Correct - from a subdirectory, the ancestor's file directly
import { createTimerModel } from '../timer-model';
```

Enforced by ESLint: `import/no-internal-modules` for reaching past a barrel,
and `no-restricted-imports` for importing your own or an ancestor's.

Between packages ([details](../reference/project-structure.md#between-packages)):

- Import a package by name (`@mvtjs/pixi`, `@mvtjs/utils/jsx`), never a path
  into it; its `exports` are its barrel.
- Every import names a dependency of the nearest `package.json`; tests,
  scripts and config may use `devDependencies` (`import/no-extraneous-dependencies`).
- In the site and benchmarks, take `SKIP_DESCENDANTS`, `hasUpdate`,
  `hasRefresh`, the counters and the method types from the renderer package,
  not `@mvtjs/utils` (`no-restricted-imports`).
- `packages/website/src/playground/` and the rest of the site never import each other.

## String-Literal Unions

Use unions of string literals for enum-like types. Never use TypeScript `enum`
or const-object patterns:

```ts
// ✅ Preferred
type TileKind = 'empty' | 'wall' | 'dot' | 'spawn-point';

// ❌ Avoid
const TileType = { Empty: 0, Wall: 1 } as const;
type TileType = (typeof TileType)[keyof typeof TileType];

// ❌ Avoid
enum TileType { Empty, Wall, Dot }
```

## No `null`

Use `undefined` throughout. Aligns with JavaScript's own APIs:

```ts
// ✅ Preferred
function find(id: string): Item | undefined;
let selected: Item | undefined;

// ❌ Avoid
function find(id: string): Item | null;
let selected: Item | null = null;
```

## View Functions

A view is a function `XxxView(bindings: XxxViewBindings): Container`, usable
as a JSX tag and as a plain call. A top-level view takes the model in its
bindings: `GameView({ model })`. The body may be JSX (`.tsx`) or plain
TypeScript (`.ts`), whichever suits the view; neither is required. Each query
binding's type says what the view supports: `() => T` for changing state, `T`
for a value read once at construction, `ValueOrGetter<T>` (from `@mvtjs/pixi`)
for either. Never declare a function and read it only once. Full rules:
[Style Guide: Views and Bindings](../reference/style-guide.md#views-and-bindings);
how to write one: [skill-mvt-view.md](skill-mvt-view.md).

## No Classes

Use factory functions returning plain records that satisfy an interface.
Private state lives in the closure:

```ts
// ✅ Preferred
interface CounterModel {
    readonly count: number;
    increment: () => void;
    update: (deltaMs: number) => void;
}

function createCounterModel(): CounterModel {
    let count = 0;

    const model: CounterModel = {
        get count() { return count; },
        increment() { count += 1; },
        update(_deltaMs) { /* ... */ },
    };

    return model;
}

// ❌ Avoid
class CounterModel {
    private count = 0;
    increment() { this.count += 1; }
    update(deltaMs: number) { /* ... */ }
}
```

A factory takes **one options object**, required inputs included:
`createJsx({ target, elements })`, never `createJsx(target, elements)`.
Ordered parameters are fragile, and cannot grow without breaking callers.
See [Style Guide: Factory Functions](../reference/style-guide.md#factory-functions).

## Function-Valued Properties in Types

In interfaces and type declarations (models, bindings, options), write
function members as properties holding a function, never with method syntax:

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

Method signatures get looser parameter checks, even in strict mode, and
suggest a `this`-bound method, which this project never has. Object literals
implementing the interface may still use method shorthand. Enforced by lint.

## Assertions

State preconditions, postconditions and invariants with `assert` from
`@mvtjs/utils` (`assert(loaded, 'call load() first')`), not `if (...) throw`.
Pass a message built from values as a function, so it is built only on
failure. Not on hot paths: in code that runs every frame, keep a plain
`if` and `throw`. Costly checks go under the caller's `if (DEV)`. See
[Style Guide: Assertions](../reference/style-guide.md#assertions).

## Easily Confused Names

| Avoid       | Prefer                                                | Rationale                                  |
| ----------- | ----------------------------------------------------- | ------------------------------------------ |
| `type`      | `kind`                                                | Confused with the TypeScript `type` keyword |
| `state`     | `phase`, `status`, `mode`, or a domain-specific name  | Every property on a model is "state" - confusingly meta |

## Boolean Properties

Boolean properties and accessors should read as yes/no questions:

| Prefix   | When to use                         | Example                              |
| -------- | ----------------------------------- | ------------------------------------ |
| **`is`** | State or condition (default choice) | `isAlive`, `isActive`, `isThrusting` |
| **`has`**| Ownership or presence               | `hasAutoTurn`, `hasShield`           |
| **`can`**| Capability or permission            | `canFire`, `canClick`, `canMove`     |

## File Sections

Model and view files use section dividers for navigability:

```
// --- Interface ---           (views: Bindings)
// --- Options (if needed) ---
// --- Factory ---             (views: View)
// --- Internals (if needed) ---
```

Readers see the public contract first, then configuration, then
implementation, then internals.

## Declaration Order Within Functions

Within factory functions, follow big-picture-first ordering:

1. **Initialisation** at the top - set up state and child models.
2. **Public record** - the returned object with its methods.
3. **Return statement**.
4. **Child construction helpers** - functions that build sub-components.
5. **Low-level helpers** - small utilities, math functions.

JavaScript's function hoisting makes this possible - declare functions in
conceptual order, not call-before-definition order.

## Comments, Test Names and Messages

JSDoc, comments, test names and error messages follow the same writing rules
as the docs. See [Style Guide: Writing](../reference/style-guide.md#writing).

- **Short, complete sentences.** One idea in each. No fragments, and no long
  sentences joined by colons or semicolons.
- **Plain words.** Explain an unfamiliar term where it first appears.
- **Say what a function returns or does,** not who calls it.
- **Start a factory's JSDoc with "Creates".** For example: "Creates a music
  player with no song playing."
- **No in-house names in a package.** Say "the game loop", not "the host".
- **Wrap JSDoc and comments at about 80 columns.**

## Full Reference

- [Style Guide](../reference/style-guide.md) - complete style conventions
- [Project Structure](../reference/project-structure.md) - directory layout
  and barrel files
