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
| View types             | Suffix with `View`           | `MazeView`, `KeyboardPlayerInputView`         |
| Functions / Variables  | `camelCase`                  | `createScoreModel`, `deltaMs`                 |
| Factory functions      | `create` + `PascalCase` noun | `createScoreModel`, `createHudView`           |
| Boolean properties     | `is` / `has` / `can` prefix  | `isAlive`, `hasAutoTurn`, `canFire`           |
| Binding accessors      | `get` + description          | `getScore()`, `getEntityX()`                  |
| Binding event handlers | `on` + description           | `onDirectionChanged()`, `onResetClicked()`    |
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

Every directory under `src/` provides a barrel file (`index.ts`) that defines
its public API.

- **Cross-directory imports:** always go through `index.ts` (never past it).
- **Same-directory imports:** use direct relative paths (`./foo`).
- **No `.ts` extensions** in module specifiers - write `'./foo'`,
  not `'./foo.ts'`.
- **No declarations** in barrel files - only re-exports.
- **No self-imports** through barrels.

```ts
// ✅ Correct - import through barrel
import { ScoreModel } from './models';

// ❌ Wrong - reaching past the barrel
import { ScoreModel } from './models/score-model';

// ✅ Correct - within same directory, direct relative path
import { createTimerModel } from './timer-model';
```

Enforced by the `import/no-internal-modules` ESLint rule.

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

## No Classes

Use factory functions returning plain records that satisfy an interface.
Private state lives in the closure:

```ts
// ✅ Preferred
interface CounterModel {
    readonly count: number;
    increment(): void;
    update(deltaMs: number): void;
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
// --- Interface ---
// --- Options (if needed) ---
// --- Factory ---
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

## Full Reference

- [Style Guide](../reference/style-guide.md) - complete style conventions
- [Project Structure](../reference/project-structure.md) - directory layout
  and barrel files
