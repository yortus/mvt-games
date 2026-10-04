# AGENTS.md - AI Agent Orientation

> Terse, structured reference for AI coding agents. For expanded orientation,
> see [docs/ai-agents/](docs/ai-agents/index.md). For task-specific
> instructions, load the relevant [skills file](#skills).

## Architecture: MVT (Model-View-Ticker)

- **Models** - own all state and domain logic; advance only via `update(deltaMs)`
- **Views** - read state through a `bindings` interface; refresh every frame via `refresh()`. Views may hold cosmetic presentation state for transitions the model doesn't track; such views gain an `update(deltaMs)` step. Complex presentation logic can be extracted into a view model (an internal detail of the view). In this repo, a view sets its `update` and `refresh` steps on its container with `setUpdate(view, update)` and `setRefresh(view, refresh)`, from `@mvtjs/pixi` (and `@mvtjs/three`, `@mvtjs/html`)
- **Ticker** - drives the loop each frame: `model.update(deltaMs)` then `view.update(deltaMs)` (views with state) then `view.refresh()` then renderer draws. One turn is a **tick**: the ticker ticks the models, then the views. In this repo: each game session's `update(deltaMs)` advances only its models, then the host (`site/src/main.ts`) calls `updateView(app.stage, deltaMs)`, which calls every update method in the stage, then `refreshView(app.stage)`, which calls every refresh method, parents first. Views never forward these calls to their children. Pausing is the host's call: its game container sits out `updateView`
- **Bindings** - plain object bridging view and model: query bindings read state (a function called every refresh, or a fixed value read once), relay bindings (`on*`) report user input

Full reference: [Architecture Overview](docs/architecture/index.md) -
[Architecture Rules](docs/architecture/rules.md)

## Project Structure

An npm workspace: four libraries published under `@mvtjs`, and private
packages for everything else.

```
packages/
├── utils/               @mvtjs/utils: renderer-agnostic helpers (the tick API, watch, SlotList, tweens); JSX base at ./jsx
├── pixi/                @mvtjs/pixi: the tick API for Pixi containers, performance metrics, and Pixi's JSX runtime
├── three/               @mvtjs/three: the tick API for three.js objects, pointer picker, and its JSX runtime
├── html/                @mvtjs/html: the tick API for DOM elements, and its JSX runtime
└── eslint-plugin/       @mvtjs/eslint-plugin (private for now): this repo's lint rules, built before lint runs
site/                    The games, demos and playground (Vite): pages, src/, scripts/ (textures, spritesheet plugin)
docs/                    VitePress
benchmarks/              Performance benchmarks, for the libraries and the games
checks/                  Tests that the packages still fit together as decided
notes/                   Proposals and tasks
```

```
site/src/
├── main.ts              Bootstrap: init Pixi app, create cabinet, start ticker
├── cabinet/             Cabinet (game-selection) model & view
├── games/               Game registry + per-game modules
│   ├── game-entry.ts    GameEntry & GameSession interfaces
│   └── <name>/          Self-contained game module
│       ├── data/        Static data and configuration constants
│       ├── models/      State & domain logic + domain types
│       └── views/       Pixi.js rendering
├── demos/               Demo registry + per-demo modules
├── playground/          In-browser editor and sandbox; shares no code with the rest of the site
└── shared/              The site's shared views (overlay, input, pause menu, perfmon), imported as `#shared`
```

Inside the repo, the libraries resolve to their `src/` (an `@mvtjs/source`
`exports` condition), so nothing needs building to run the site or the tests.

Full reference: [Project Structure](docs/reference/project-structure.md)

## Cabinet Architecture

- **GameEntry** - descriptor for a game registered in the cabinet: `{ id, name, screenWidth, screenHeight, start(stage) -> GameSession }`
- **GameSession** - a running game instance: `{ update(deltaMs), destroy() }`
- **CabinetModel** - owns menu state, selected game, active session; delegates `update()` to the active session
- **CabinetView** - renders a menu in `'menu'` phase; hides menu and defers to the game's own container in `'playing'` phase
- To add a new game: create `site/src/games/<name>/` with its own data/models/views, export a `createXxxEntry(): GameEntry` factory, register it in `site/src/games/index.ts`, following its [originality rules](site/src/games/README.md#originality). See [Adding a Game](site/src/games/README.md).

## Key Conventions

- **Barrel imports only** - never import past a directory's `index.ts`, and never import your own or an ancestor's (`.`, `..`): import the file directly; enforced by ESLint `import/no-internal-modules` and `no-restricted-imports`. Between packages, import the package name (`@mvtjs/pixi`, `@mvtjs/utils/jsx`): its `exports` are its barrel
- **Declared dependencies** - every import names a dependency of the nearest `package.json` (lint: `import/no-extraneous-dependencies`); add it there rather than relying on npm's hoisting
- **Tick API from the renderer package** - in the site and benchmarks, import `updateView`, `refreshView`, `setUpdate`, `setRefresh`, `SKIP_DESCENDANTS`, `hasUpdate`, `hasRefresh`, the tick counter and the method types from the renderer package you use, which re-exports them, not from `@mvtjs/utils` (lint). They are one set of functions for every renderer, so code using two renderers imports them from either
- **No `null`, no `this`** - our own code and APIs never introduce `null` (`undefined` instead). Be explicit where a third-party `null` arrives (`node.parent === null`, a local `T | null`), and convert it (`?? undefined`) before it reaches our own APIs; a declaration that must accept one takes an `eslint-disable` comment saying why. Closures instead of `this`. Lint: `@mvtjs/no-null`, `@mvtjs/no-this`
- **Factory functions, not classes** - `createXxxModel(options)` returns an interface; implementation is a plain record with closure-scoped private state
- **Views are functions** - `XxxView(bindings: XxxViewBindings): Container`, usable as a JSX tag and as a plain call; never `createXxxView`, never `props`. The body may be JSX (`.tsx`, `/** @jsxImportSource @mvtjs/pixi */`) or plain TypeScript; neither is required, and callers can't tell the difference. JSX tends to suit trees of display objects that follow the model; plain TypeScript tends to suit views that mostly draw, manage their own display objects (pools, ring buffers), or need tight control of per-frame work. See [Style Guide: Writing the Body](docs/reference/style-guide.md#writing-the-body). Top-level views take `{ model }`.
- **Interfaces over implementations** - export the interface type, not the concrete object shape
- **Function-valued properties in types** - `update: (deltaMs: number) => void`, not `update(deltaMs: number): void`, in every interface and type declaration. Enforced by lint (`@typescript-eslint/method-signature-style`)
- **String-literal unions for enums** - `type TileKind = 'empty' | 'wall' | 'dot'`; never use `enum` or const-object patterns
- **`Kind` over `Type`** in type names - avoids overloading the word "type" in TypeScript
- **Bindings for reusable views** - leaf views (views of single game objects, HUDs) accept query and relay bindings; top-level application views take the model itself (they're application-specific, never reused). Query bindings are named for what they return (`score`, `isAlive`, `tileKindAt(row, col)`), no `get` prefix; relay bindings are `on` + what the user did (`onFirePressed`). A query binding's type says what the view supports: `() => T` changes, `T` is read once, `ValueOrGetter<T>` is either. Never declare a function and read it only once
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
| `npm test`             | Every workspace's tests (Vitest) |
| `npm run docs:dev`     | Start the VitePress dev server |
| `npm run build:packages` | Build the four libraries for publishing (tsdown, publint, attw) |
| `npx changeset` / `npm run release` | Record a change for the changelogs / version a release ([.changeset/](.changeset/README.md)) |
| `npm run bench`        | Performance benchmarks ([benchmarks/](benchmarks/README.md)) |

## Notes: Proposals and Tasks

The `notes/` directory holds planning material: `proposals/` (designs not yet
implemented), `tasks/backlog/` and `tasks/active/` (a lightweight task board),
and `archive/` (everything finished). Check [notes/README.md](notes/README.md)
for the index and how it works. To pick up a task, move it from `backlog/` to
`active/`, work on it, update its progress log, and move it to `archive/` when
done. Proposals and tasks share one number sequence.

## Critical Rules (Do Not Violate)

0. **No em-dashes** - use hyphens instead (lint: `@mvtjs/no-em-dash`, which auto-fixes).
1. **Models must not use wall-clock time.** No `setTimeout`, `setInterval`, `requestAnimationFrame`, or auto-playing GSAP tweens. All state advances through `update(deltaMs)` only. Lint (`@mvtjs/no-wall-clock`) checks model files. [Time Management](docs/building-with-mvt/simulating-the-world/time-management.md)
2. **Views hold no domain state.** No domain logic, no autonomous animations, no internal domain state. Read state from bindings (leaf views) or model properties (top-level application views), write to the presentation output. Views may hold cosmetic presentation state for transitions the model doesn't track (e.g. a death-flash timer, a smoothed score counter). Such views gain an `update(deltaMs)` step (in this repo, an update method set with `setUpdate`; never forwarded by hand from parent views). `update` advances presentation state only; `refresh` writes all presentation output, including adding and removing display objects. Presentation state starts valid at construction: a view's first `refresh` may come before its first `update`. When the presentation logic is complex enough to warrant separate testing, extract it into a view model - the view creates and owns it internally. [Presentation State](docs/building-with-mvt/adding-visual-polish/presentation-state.md)
3. **Never import past a barrel file.** All cross-directory imports go through `index.ts`. Within the same directory, use direct relative paths (`./foo`). Never import your own or an ancestor's barrel (`.`, `..`): from a subdirectory, import the ancestor's file directly (`../element-mixin`). [Project Structure](docs/reference/project-structure.md)
4. **No classes.** Use factory functions returning plain records that satisfy an interface. [Style Guide](docs/reference/style-guide.md)
5. **Hot-path awareness.** `update()` and `refresh()` run every tick (~60fps). Avoid per-tick allocations: no `array.map()`, no template-string keys, no `for...of` on arrays, no inline closures. Use index-based `for` loops and pre-allocated structures. [Hot Paths](docs/building-with-mvt/performance/hot-paths.md)
6. **Model coordinates must be domain-level, not pixels.** Grid-based game objects expose fractional `row`/`col`/`direction` - not `x`/`y` in pixels. Views compute pixel positions from domain coordinates. [Models](docs/building-with-mvt/simulating-the-world/models.md)
7. **Games and demos are original.** Inspired by a classic is fine; copying is not. No other game's titles, character names or designs, artwork, music or level layouts, and all art is drawn from scratch in the repo (a `site/scripts/generate-*-textures.ts` script, or the views). [Originality](site/src/games/README.md#originality)

Full rules: [Architecture Rules](docs/architecture/rules.md)

## File Organisation Within a Module

Each model/view file follows this internal ordering (view files name the
first section `Bindings` and the third `View`):

```
// --- Interface ---
// Public interface definition

// --- Options ---
// Options type for the factory function (if needed)

// --- Factory ---
// createXxx() factory function implementation (views: the XxxView function)

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
| [Building with MVT](docs/building-with-mvt/quickstart.md) | Progressive guide from quickstart to advanced topics |
| [Reference](docs/reference/style-guide.md) | Style guide, glossary, quick-reference rules |
| [AI Agents](docs/ai-agents/index.md) | Expanded agent orientation   |

## Tech Stack

TypeScript 5.9 - Pixi.js 8 - three.js (one demo) - GSAP 3 - Vite 8 - Vitest 5 - ESLint 9 - ESLint Stylistic
