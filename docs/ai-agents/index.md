# AI Agent Orientation

> Expanded reference for AI coding agents working in this codebase. Start
> here, then load the relevant skills file for your current task.

**Related:** [Architecture Rules](../reference/architecture-rules.md) ·
[Style Guide](../reference/style-guide.md) ·
[Project Structure](../reference/project-structure.md) ·
[Glossary](../reference/glossary.md)

---

## Architecture: MVT (Model-View-Ticker)

- **Models** - own all state and domain logic; advance only via
  `update(deltaMs)`.
- **Views** - stateless renderers; read state through a `bindings` interface;
  refresh every frame via `refresh()`.
- **Ticker** - drives the loop each frame: `model.update(deltaMs)` then
  `view.refresh()` then renderer draws.
- **Bindings** - plain object bridging view and model: `get*()` methods read
  state, `on*()` methods relay user input.

Full details: [Architecture Overview](../learn/architecture-overview.md) ·
[Architecture Rules](../reference/architecture-rules.md)

## Critical Rules

These are non-negotiable. Violating any of these produces incorrect code.

0. **No em-dashes** - use hyphens instead.
1. **Models must not use wall-clock time.** No `setTimeout`, `setInterval`,
   `requestAnimationFrame`, or auto-playing GSAP tweens. All state advances
   through `update(deltaMs)` only.
   [Time Management](../guide/time-management.md)
2. **Views must be stateless.** No domain logic, no autonomous animations.
   Read state from bindings (leaf views) or model properties (top-level
   application views), write to the presentation output, nothing else.
   Exception: limited presentation-only state.
   [Views](../learn/views.md) ·
   [Presentation State](../guide/presentation-state.md)
3. **Never import past a barrel file.** All cross-directory imports go
   through `index.ts`. Within the same directory, use direct relative paths
   (`./foo`).
   [Project Structure](../reference/project-structure.md)
4. **No classes.** Use factory functions returning plain records that satisfy
   an interface.
   [Style Guide](../reference/style-guide.md)
5. **Hot-path awareness.** `update()` and `refresh()` run every tick (~60fps).
   Avoid per-tick allocations: no `array.map()`, no template-string keys, no
   `for...of` on arrays, no inline closures. Use index-based `for` loops and
   pre-allocated structures.
   [Hot Paths](../guide/hot-paths.md)
6. **Model coordinates must be domain-level, not pixels.** Grid-based entities
   expose fractional `row`/`col`/`direction` - not `x`/`y` in pixels. Views
   compute pixel positions from domain coordinates.
   [Models](../learn/models.md)

## Project Structure

```
src/
├── main.ts              Bootstrap: init Pixi app, create cabinet, start ticker
├── cabinet/             Cabinet model & view (game selection)
├── games/               Game registry + per-game modules
│   ├── game-entry.ts    GameEntry & GameSession interfaces
│   └── <name>/          Self-contained game module
│       ├── data/        Static data and configuration constants
│       ├── models/      State & domain logic + domain types
│       └── views/       Pixi.js rendering
└── common/              Shared helpers, views, and models
```

## Cabinet Architecture

- **GameEntry** - descriptor for a game registered in the cabinet:
  `{ id, name, screenWidth, screenHeight, start(stage) -> GameSession }`
- **GameSession** - a running game instance:
  `{ update(deltaMs), destroy() }`
- To add a new game: create `src/games/<name>/` with data/models/views,
  export a `createXxxEntry(): GameEntry` factory, register it in
  `src/games/index.ts`.
  [Adding a Game](../guide/adding-a-game.md)

## Key Conventions

- **Barrel imports only** - never import past a directory's `index.ts`.
- **Factory functions, not classes** -
  `createXxxModel(options)` returns an interface; implementation is a plain
  record with closure-scoped private state.
- **Interfaces over implementations** - export the interface type, not the
  concrete object shape.
- **String-literal unions for enums** -
  `type TileKind = 'empty' | 'wall' | 'dot'`; never use `enum` or
  const-object patterns.
- **`Kind` over `Type`** in type names.
- **`phase` over `state`** for lifecycle properties.
- **Bindings for reusable views** - leaf views accept a `get*()`/`on*()`
  bindings object; top-level application views accept the model directly.
- **`_` prefix** for intentionally unused parameters.
- **4-space indentation**, `lower-kebab-case` file names, `PascalCase` types,
  `camelCase` everything else.
- **No `null`** - use `undefined`.

Full details: [Style Guide](../reference/style-guide.md)

## File Organisation Within a Module

Each model/view file follows this internal ordering:

```
// --- Interface ---
// Public interface definition

// --- Options (if needed) ---
// Options type for the factory function

// --- Factory ---
// createXxx() factory function implementation

// --- Internals (if needed) ---
// Internal types, constants, and helpers
```

## Commands

| Command                | Purpose                       |
| ---------------------- | ----------------------------- |
| `npm run dev`          | Start Vite dev server         |
| `npm run build`        | Type-check + production build |
| `npm run lint`         | Check lint and formatting     |
| `npm run lint:fix`     | ESLint auto-fix pass          |

## Tech Stack

TypeScript 5.9 - Pixi.js 8 - GSAP 3 - Vite 7 - ESLint 9 - ESLint Stylistic

## Skills Files

For task-specific guidance, load the relevant skills file before starting work:

| Task                       | Skills file                                        |
| -------------------------- | -------------------------------------------------- |
| Writing a new model        | [skill-mvt-model.md](skill-mvt-model.md)           |
| Writing a new view         | [skill-mvt-view.md](skill-mvt-view.md)             |
| Following code conventions | [skill-code-style.md](skill-code-style.md)         |
| Updating documentation     | [skill-documentation.md](skill-documentation.md)   |

Each skills file is self-contained and combines both MVT architectural rules
and this project's code conventions. Constraints are labelled as either
**MVT requirement** or **project convention** so you know which are
universally applicable and which are specific to this codebase.

## Detailed Documentation

For full explanations of any topic, see the docs:

| Topic                       | Page                                                         |
| --------------------------- | ------------------------------------------------------------ |
| What is MVT?                | [learn/what-is-mvt.md](../learn/what-is-mvt.md)             |
| Architecture overview       | [learn/architecture-overview.md](../learn/architecture-overview.md) |
| Models                      | [learn/models.md](../learn/models.md)                        |
| Views                       | [learn/views.md](../learn/views.md)                          |
| The ticker                  | [learn/ticker.md](../learn/ticker.md)                        |
| Bindings                    | [learn/bindings.md](../learn/bindings.md)                    |
| Time management             | [guide/time-management.md](../guide/time-management.md)      |
| Bindings in depth           | [guide/bindings-in-depth.md](../guide/bindings-in-depth.md)  |
| Change detection            | [guide/change-detection.md](../guide/change-detection.md)    |
| Model composition           | [guide/model-composition.md](../guide/model-composition.md)  |
| View composition            | [guide/view-composition.md](../guide/view-composition.md)    |
| Presentation state          | [guide/presentation-state.md](../guide/presentation-state.md)|
| Hot paths                   | [guide/hot-paths.md](../guide/hot-paths.md)                  |
| Testing                     | [guide/testing.md](../guide/testing.md)                      |
| Adding a game               | [guide/adding-a-game.md](../guide/adding-a-game.md)          |
| Common mistakes             | [guide/common-mistakes.md](../guide/common-mistakes.md)      |
| Architecture rules          | [reference/architecture-rules.md](../reference/architecture-rules.md) |
| Style guide                 | [reference/style-guide.md](../reference/style-guide.md)      |
| Project structure           | [reference/project-structure.md](../reference/project-structure.md) |
| Glossary                    | [reference/glossary.md](../reference/glossary.md)            |
| Proven patterns             | [foundations/proven-patterns.md](../foundations/proven-patterns.md) |
| Contributing                | [contributing.md](../contributing.md)                        |
