# AGENTS.md — AI Agent Orientation

> Terse, structured reference for AI coding agents. See linked docs for full details.

## Architecture: MVT (Model-View-Ticker)

- **Models** — own all state and domain logic; advance only via `update(deltaMs)`
- **Views** — stateless renderers; read state through a `bindings` interface; refresh every frame via `refresh()`
- **Ticker** — drives the loop each frame: `model.update(deltaMs)` → `view.refresh()` → renderer draws
- **Bindings** — plain object bridging view↔model: `get*()` methods read state, `on*()` methods relay user input

Full reference: [docs/mvt-guide.md](docs/mvt-guide.md)

## Project Structure

```
src/
├── main.ts              Bootstrap: init Pixi app, create cabinet, start ticker
├── cabinet/             Cabinet (game-selection) model & view
├── games/               Game registry + per-game modules
│   ├── game-entry.ts    GameEntry & GameSession interfaces
│   └── pacman/          Pac-Man game (self-contained)
│       ├── data/        Static maze data and configuration constants
│       ├── models/      State & domain logic + domain types
│       └── views/       Pixi.js rendering
└── utils/               General helpers (e.g. change-detection watches)
```

## Cabinet Architecture

- **GameEntry** — descriptor for a game registered in the cabinet: `{ id, name, screenWidth, screenHeight, start(stage) → GameSession }`
- **GameSession** — a running game instance: `{ update(deltaMs), destroy() }`
- **CabinetModel** — owns menu state, selected game, active session; delegates `update()` to the active session
- **CabinetView** — renders a menu in `'menu'` phase; hides menu and defers to the game's own container in `'playing'` phase
- To add a new game: create `src/games/<name>/` with its own data/models/views, export a `createXxxEntry(): GameEntry` factory, register it in `src/games/index.ts`

## Key Conventions

- **Barrel imports only** — never import past a directory's `index.ts`; enforced by ESLint `import/no-internal-modules`
- **Factory functions, not classes** — `createXxxModel(options)` returns an interface; implementation is a plain record with closure-scoped private state
- **Interfaces over implementations** — export the interface type, not the concrete object shape
- **String-literal unions for enums** — `type TileKind = 'empty' | 'wall' | 'dot'`; never use `enum` or const-object patterns
- **`Kind` over `Type`** in type names — avoids overloading the word "type" in TypeScript
- **`get*` / `on*` naming** in bindings — `get` for state accessors, `on` for user-input event handlers
- **`_` prefix** for intentionally unused parameters
- **4-space indentation**, `lower-kebab-case` file names, `PascalCase` types, `camelCase` everything else

Full reference: [docs/style-guide.md](docs/style-guide.md)

## Commands

| Command                | Purpose                       |
| ---------------------- | ----------------------------- |
| `npm run dev`          | Start Vite dev server         |
| `npm run build`        | Type-check + production build |
| `npm run lint`         | ESLint on `src/`              |
| `npm run format`       | Prettier format all files     |
| `npm run format:check` | Check formatting              |

## Critical Rules (Do Not Violate)

1. **Models must not use wall-clock time.** No `setTimeout`, `setInterval`, `requestAnimationFrame`, or auto-playing GSAP tweens. All state advances through `update(deltaMs)` only.
2. **Views must be stateless.** No domain logic, no autonomous animations. Read state from bindings, write to the scene graph, nothing else. (Exception: limited presentation-only state like score-counter tweens — see MVT guide.)
3. **Never import past a barrel file.** All cross-directory imports go through `index.ts`. Within the same directory, use direct relative paths (`./foo`).
4. **No classes.** Use factory functions returning plain records that satisfy an interface.
5. **Hot-path awareness.** `update()` and `refresh()` run every tick (~60fps). Avoid per-tick allocations: no `array.map()`, no template-string keys, no `for...of` on arrays, no inline closures. Use index-based `for` loops and pre-allocated structures.

## File Organisation Within a Module

Each model/view file follows this internal ordering:

```
// --- Interface ---
// Public interface definition

// --- Options ---
// Options type for the factory function (if needed)

// --- Factory ---
// createXxx() factory function implementation
```

## Tech Stack

TypeScript 5.9 · Pixi.js 8 · GSAP 3 · Vite 7 · ESLint 9 · Prettier 3
