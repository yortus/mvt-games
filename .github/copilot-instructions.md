# Copilot Instructions

This project uses the **MVT (Model-View-Ticker)** architecture with TypeScript,
Pixi.js, and GSAP. Follow these conventions when generating code.

## Architecture

- **Models** own state and logic; advance via `update(deltaMs)` only - never wall-clock time.
- **Views** read via `bindings` object, write to Pixi scene graph. Views may hold cosmetic presentation state for transitions the model doesn't track; such views gain an `update(deltaMs)` method. Complex presentation logic can be extracted into a view model (an internal detail of the view).
- **Ticker** loop: `model.update(deltaMs)` → `view.update(deltaMs)` (views with state) → `view.refresh()` → render.
- **Cabinet** manages game selection; each game is a self-contained module under `src/games/<name>/`.
- **GameEntry** - descriptor: `{ id, name, screenWidth, screenHeight, start(stage) → GameSession }`
- **GameSession** - running instance: `{ update(deltaMs), destroy() }`

## Project Structure

```
src/
├── main.ts              Bootstrap cabinet, start ticker
├── cabinet/             Cabinet model & view (game selection)
├── games/               Game registry + per-game modules
│   ├── game-entry.ts    GameEntry & GameSession interfaces
│   └── pacman/          Pac-Man (data/, models/, views/)
└── common/              Shared helpers, views, and models (e.g. createWatch, keyboard input)
```

## Code Style

- Factory functions, not classes: `createXxxModel(options): XxxModel`
- Implementation as plain records satisfying an interface; private state in closure scope
- String-literal unions for enums: `type Kind = 'a' | 'b'`; never `enum` or const-object
- Use `Kind` not `Type` in type names
- 4-space indentation, `lower-kebab-case.ts` files
- `PascalCase` for types/interfaces, `camelCase` for functions/variables

## Imports

- Always import through barrel files (`index.ts`): `import { Foo } from './module'`
- Never reach past a barrel: ~~`import { Foo } from './module/foo'`~~
- Within the same directory: direct relative paths `./foo`

## Bindings

- **Reusable leaf views** accept a `bindings` object with:
    - `get*()` - read-only state accessors (e.g. `getScore(): number`)
    - `on*()` - user-input event handlers (e.g. `onDirectionChange(dir: Direction): void`)
- **Top-level application views** accept the model directly (application-specific, never reused)

## Hot Paths

`update()` and `refresh()` run every tick. Avoid per-tick allocations:

- No `array.map/filter/slice`, spread, `for...of`, destructuring, inline closures
- Use index-based `for` loops and pre-allocated structures
- Use arithmetic keys (`row * cols + col`) instead of template-string keys

## Full Documentation

- [Documentation Home](docs/index.md) - Landing page and reading paths
- [AGENTS.md](AGENTS.md) - Full AI agent orientation
- [Architecture Rules](docs/reference/architecture-rules.md)
- [Style Guide](docs/reference/style-guide.md)
- [Project Structure](docs/reference/project-structure.md)
