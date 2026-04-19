# AGENTS.md - AI Agent Orientation

> Terse, structured reference for AI coding agents. For expanded orientation,
> see [docs/ai-agents/](docs/ai-agents/index.md). For task-specific
> instructions, load the relevant [skills file](#skills).

## Architecture: MVT (Model-View-Ticker)

- **Models** - own all state and domain logic; advance only via `update(deltaMs)`
- **Views** - read state through a `bindings` interface; refresh every frame via `refresh()`. Views may hold cosmetic presentation state for transitions the model doesn't track; such views gain an `update(deltaMs)` method. Complex presentation logic can be extracted into a view model (an internal detail of the view)
- **Ticker** - drives the loop each frame: `model.update(deltaMs)` then `view.update(deltaMs)` (views with state) then `view.refresh()` then renderer draws
- **Bindings** - plain object bridging view and model: `get*()` methods read state, `on*()` methods relay user input

Full reference: [Architecture Overview](docs/architecture/index.md) -
[Architecture Rules](docs/architecture/rules.md)

## Project Structure

```
src/
├── main.ts              Bootstrap: init Pixi app, create cabinet, start ticker
├── cabinet/             Cabinet (game-selection) model & view
├── games/               Game registry + per-game modules
│   ├── game-entry.ts    GameEntry & GameSession interfaces
│   └── <name>/          Self-contained game module
│       ├── data/        Static data and configuration constants
│       ├── models/      State & domain logic + domain types
│       └── views/       Pixi.js rendering
└── common/              Shared helpers, views, and models (e.g. change-detection watches, keyboard input)
```

Full reference: [Project Structure](docs/reference/project-structure.md)

## Cabinet Architecture

- **GameEntry** - descriptor for a game registered in the cabinet: `{ id, name, screenWidth, screenHeight, start(stage) -> GameSession }`
- **GameSession** - a running game instance: `{ update(deltaMs), destroy() }`
- **CabinetModel** - owns menu state, selected game, active session; delegates `update()` to the active session
- **CabinetView** - renders a menu in `'menu'` phase; hides menu and defers to the game's own container in `'playing'` phase
- To add a new game: create `src/games/<name>/` with its own data/models/views, export a `createXxxEntry(): GameEntry` factory, register it in `src/games/index.ts`. See [Adding a Game](src/games/README.md).

## Key Conventions

- **Barrel imports only** - never import past a directory's `index.ts`; enforced by ESLint `import/no-internal-modules`
- **Factory functions, not classes** - `createXxxModel(options)` returns an interface; implementation is a plain record with closure-scoped private state
- **Interfaces over implementations** - export the interface type, not the concrete object shape
- **String-literal unions for enums** - `type TileKind = 'empty' | 'wall' | 'dot'`; never use `enum` or const-object patterns
- **`Kind` over `Type`** in type names - avoids overloading the word "type" in TypeScript
- **Bindings for reusable views** - leaf views (entity renderers, HUDs) accept a `get*()`/`on*()` bindings object; top-level application views accept the model directly (they're application-specific, never reused)
- **`_` prefix** for intentionally unused parameters
- **4-space indentation**, `lower-kebab-case` file names, `PascalCase` types, `camelCase` everything else

Full reference: [Style Guide](docs/reference/style-guide.md)

## Commands

| Command                | Purpose                       |
| ---------------------- | ----------------------------- |
| `npm run dev`          | Start Vite dev server         |
| `npm run build`        | Type-check + production build |
| `npm run lint`         | Check lint and formatting     |
| `npm run lint:fix`     | ESLint auto-fix pass          |

## Tasks

The `tasks/` directory contains a lightweight task board. Check
[tasks/README.md](tasks/README.md) for the current backlog, active work, and
archive. To pick up a task, move it from `backlog/` to `active/`, work on it,
update its progress log, and move it to `archive/` when done.

## Critical Rules (Do Not Violate)

0. **No em-dashes** - use hyphens instead.
1. **Models must not use wall-clock time.** No `setTimeout`, `setInterval`, `requestAnimationFrame`, or auto-playing GSAP tweens. All state advances through `update(deltaMs)` only. [Time Management](docs/topics/time-management.md)
2. **Views hold no domain state.** No domain logic, no autonomous animations, no internal domain state. Read state from bindings (leaf views) or model properties (top-level application views), write to the presentation output. Views may hold cosmetic presentation state for transitions the model doesn't track (e.g. a death-flash timer, a smoothed score counter). Such views gain an `update(deltaMs)` method. When the presentation logic is complex enough to warrant separate testing, extract it into a view model - the view creates and owns it internally. [Presentation State](docs/topics/presentation-state.md)
3. **Never import past a barrel file.** All cross-directory imports go through `index.ts`. Within the same directory, use direct relative paths (`./foo`). [Project Structure](docs/reference/project-structure.md)
4. **No classes.** Use factory functions returning plain records that satisfy an interface. [Style Guide](docs/reference/style-guide.md)
5. **Hot-path awareness.** `update()` and `refresh()` run every tick (~60fps). Avoid per-tick allocations: no `array.map()`, no template-string keys, no `for...of` on arrays, no inline closures. Use index-based `for` loops and pre-allocated structures. [Hot Paths](docs/topics/hot-paths.md)
6. **Model coordinates must be domain-level, not pixels.** Grid-based entities expose fractional `row`/`col`/`direction` - not `x`/`y` in pixels. Views compute pixel positions from domain coordinates. [Models](docs/learn/models.md)

Full rules: [Architecture Rules](docs/reference/architecture-rules.md)

## File Organisation Within a Module

Each model/view file follows this internal ordering:

```
// --- Interface ---
// Public interface definition

// --- Options ---
// Options type for the factory function (if needed)

// --- Factory ---
// createXxx() factory function implementation

// --- Internals (if needed) ---
// Internal types, constants, and helpers used only inside this file
```

## Skills

Load the relevant skills file for task-specific instructions:

| Task                       | Skills file                                              |
| -------------------------- | -------------------------------------------------------- |
| Writing a new model        | [docs/ai-agents/skill-mvt-model.md](docs/ai-agents/skill-mvt-model.md) |
| Writing a new view         | [docs/ai-agents/skill-mvt-view.md](docs/ai-agents/skill-mvt-view.md)   |
| Following code conventions | [docs/ai-agents/skill-code-style.md](docs/ai-agents/skill-code-style.md) |
| Reviewing code             | [docs/ai-agents/skill-code-review.md](docs/ai-agents/skill-code-review.md) |
| Updating documentation     | [docs/ai-agents/skill-documentation.md](docs/ai-agents/skill-documentation.md) |

## Documentation

| Section          | Content                                   |
| ---------------- | ----------------------------------------- |
| [Architecture](docs/architecture/index.md) | Transferable MVT specification |
| [Building with MVT](docs/learn/quickstart.md) | Progressive guide from quickstart to advanced topics |
| [Topics](docs/topics/time-management.md) | In-depth topic pages      |
| [Reference](docs/reference/architecture-rules.md) | Rules, style, glossary |
| [AI Agents](docs/ai-agents/index.md) | Expanded agent orientation   |

## Tech Stack

TypeScript 5.9 - Pixi.js 8 - GSAP 3 - Vite 7 - ESLint 9 - ESLint Stylistic
